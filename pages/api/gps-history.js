import { getDatabase, getSession, getVehicleHistory } from "../../lib/server-store";

// GET /api/gps-history?vehicleId=TR-214&from=2026-10-17T06:00:00Z&to=2026-10-17T18:00:00Z&limit=2000
// Admins can read any vehicle; drivers only the vehicles assigned to them.
export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = getSession(req);
  if (!user || !["admin", "driver"].includes(user.role)) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const vehicleId = typeof req.query.vehicleId === "string" ? req.query.vehicleId : "";
  if (!vehicleId) return res.status(400).json({ error: "vehicleId is required" });

  const db = getDatabase();
  if (!db.prepare("SELECT id FROM vehicles WHERE id = ?").get(vehicleId)) {
    return res.status(404).json({ error: "Unknown vehicle" });
  }
  if (user.role === "driver") {
    const assigned = db.prepare("SELECT 1 FROM driver_vehicle_assignments WHERE driver_id = ? AND vehicle_id = ?").get(user.id, vehicleId);
    if (!assigned) return res.status(403).json({ error: "This vehicle is not assigned to you" });
  }

  const parseTime = (value) => {
    if (typeof value !== "string" || !value) return undefined;
    const time = new Date(value);
    return Number.isNaN(time.getTime()) ? null : time.toISOString();
  };
  const from = parseTime(req.query.from);
  const to = parseTime(req.query.to);
  if (from === null || to === null) return res.status(400).json({ error: "from and to must be valid dates" });

  const points = getVehicleHistory(vehicleId, { from, to, limit: req.query.limit });
  return res.status(200).json({ vehicleId, count: points.length, points });
}
