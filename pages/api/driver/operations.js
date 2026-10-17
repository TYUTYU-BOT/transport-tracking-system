import { getAssignedVehicles, getDatabase, getSession, updateVehicleLocation } from "../../../lib/server-store";

const vehicleStatuses = new Set(["Ready", "In transit", "Rest break", "Maintenance"]);

export default function handler(req, res) {
  const user = getSession(req);
  if (!user || !["driver", "admin"].includes(user.role)) {
    return res.status(401).json({ message: "Driver sign-in required" });
  }

  const db = getDatabase();
  const vehicles = getAssignedVehicles(user.id);

  if (req.method === "GET") {
    const activeTrips = db.prepare("SELECT id, vehicle_id AS vehicleId, status, started_at AS startedAt FROM trips WHERE driver_id = ? AND status = 'in_progress' ORDER BY id DESC").all(user.id);
    const incidents = db.prepare("SELECT message, created_at AS createdAt FROM incidents WHERE driver_id = ? ORDER BY id DESC LIMIT 10").all(user.id);
    const notifications = db.prepare("SELECT message, created_at AS createdAt FROM notifications WHERE recipient_role IN ('all', 'driver') ORDER BY id DESC LIMIT 10").all();
    return res.status(200).json({ vehicles, activeTrips, incidents, notifications });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (user.role !== "driver") return res.status(403).json({ message: "Only drivers can submit driver operations" });
  const vehicleId = typeof req.body?.vehicleId === "string" ? req.body.vehicleId : "";
  const vehicle = vehicles.find((assignedVehicle) => assignedVehicle.id === vehicleId);
  if (!vehicle) return res.status(409).json({ message: "Select a vehicle assigned to your account." });

  const { action } = req.body || {};
  const now = new Date().toISOString();

  try {
    if (action === "startTrip") {
      const activeTrip = db.prepare("SELECT id FROM trips WHERE driver_id = ? AND status = 'in_progress'").get(user.id);
      if (activeTrip) return res.status(409).json({ message: "A trip is already in progress" });
      const result = db.prepare("INSERT INTO trips (driver_id, vehicle_id, route_id, status, started_at) VALUES (?, ?, ?, 'in_progress', ?)")
        .run(user.id, vehicle.id, vehicle.route_id, now);
      db.prepare("UPDATE vehicles SET status = 'In transit' WHERE id = ?").run(vehicle.id);
      return res.status(201).json({ trip: { id: Number(result.lastInsertRowid), status: "in_progress", startedAt: now } });
    }

    if (action === "endTrip") {
      const activeTrip = db.prepare("SELECT id FROM trips WHERE driver_id = ? AND status = 'in_progress' ORDER BY id DESC LIMIT 1").get(user.id);
      if (!activeTrip) return res.status(409).json({ message: "There is no active trip to end" });
      db.prepare("UPDATE trips SET status = 'completed', ended_at = ? WHERE id = ?").run(now, activeTrip.id);
      db.prepare("UPDATE vehicles SET status = 'Ready' WHERE id = ?").run(vehicle.id);
      return res.status(200).json({ message: "Trip ended" });
    }

    if (action === "updateStatus") {
      const status = req.body?.status;
      if (!vehicleStatuses.has(status)) return res.status(400).json({ message: "Invalid vehicle status" });
      db.prepare("UPDATE vehicles SET status = ? WHERE id = ?").run(status, vehicle.id);
      return res.status(200).json({ status });
    }

    if (action === "reportIncident") {
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
      if (!message || message.length > 2000) return res.status(400).json({ message: "Incident must contain 1 to 2000 characters" });
      db.prepare("INSERT INTO incidents (driver_id, vehicle_id, message, created_at) VALUES (?, ?, ?, ?)").run(user.id, vehicle.id, message, now);
      return res.status(201).json({ message: "Incident reported" });
    }

    if (action === "sendLocation") {
      const latitude = Number(req.body?.latitude);
      const longitude = Number(req.body?.longitude);
      const speed = Number(req.body?.speed || 0);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(speed) || speed < 0) {
        return res.status(400).json({ message: "Invalid GPS coordinates" });
      }
      updateVehicleLocation(vehicle.id, latitude, longitude, speed, "driver-phone");
      return res.status(200).json({ message: "Vehicle location updated", vehicleId: vehicle.id, updatedAt: now });
    }

    return res.status(400).json({ message: "Unknown driver operation" });
  } catch (error) {
    console.error("Driver operation failed:", error.message);
    return res.status(500).json({ message: "Unable to save driver operation" });
  }
}
