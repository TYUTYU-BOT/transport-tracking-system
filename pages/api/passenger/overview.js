import { getDatabase, getSession } from "../../../lib/server-store";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const user = getSession(req);
  if (!user || !["passenger", "admin"].includes(user.role)) {
    return res.status(401).json({ message: "Passenger sign-in required" });
  }

  const db = getDatabase();
  const vehicles = db.prepare(`
    SELECT v.id, v.label, v.status, r.origin, r.destination, r.departure, r.arrival, r.status AS routeStatus,
      g.latitude, g.longitude, g.speed, g.updated_at AS lastUpdated
    FROM vehicles v LEFT JOIN routes r ON r.id = v.route_id
    LEFT JOIN gps_locations g ON g.vehicle_id = v.id ORDER BY v.id
  `).all();
  const notifications = db.prepare("SELECT message, created_at AS createdAt FROM notifications WHERE recipient_role IN ('all', 'passenger') ORDER BY id DESC LIMIT 10").all();

  return res.status(200).json({ vehicles, notifications });
}
