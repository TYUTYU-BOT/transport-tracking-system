import { timingSafeEqual } from "node:crypto";
import { getDatabase, getSession, getVehicleLocations, updateVehicleLocation } from "../../lib/server-store";

function validDeviceToken(providedToken, configuredToken) {
  if (typeof providedToken !== "string" || !configuredToken) return false;
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(configuredToken);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export default function handler(req, res) {
  if (req.method === "POST") {
    const configuredToken = process.env.GPS_DEVICE_TOKEN;
    if (!configuredToken) {
      return res.status(503).json({ error: "GPS device ingestion is not configured" });
    }

    const providedToken = req.headers["x-device-token"];
    if (!validDeviceToken(providedToken, configuredToken)) {
      return res.status(401).json({ error: "Invalid GPS device credentials" });
    }

    const { vehicleId, latitude, longitude, speed } = req.body;
    const numericLatitude = Number(latitude);
    const numericLongitude = Number(longitude);
    const numericSpeed = Number(speed || 0);

    if (!vehicleId || !Number.isFinite(numericLatitude) || numericLatitude < -90 || numericLatitude > 90 || !Number.isFinite(numericLongitude) || numericLongitude < -180 || numericLongitude > 180 || !Number.isFinite(numericSpeed) || numericSpeed < 0) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const vehicle = getDatabase().prepare("SELECT id FROM vehicles WHERE id = ?").get(vehicleId);
    if (!vehicle) return res.status(404).json({ error: "Unknown vehicle" });

    updateVehicleLocation(vehicleId, numericLatitude, numericLongitude, numericSpeed);
    return res.status(200).json({ message: "GPS updated" });
  }

  if (req.method === "GET") {
    const user = getSession(req);
    if (!user || !["admin", "driver", "passenger"].includes(user.role)) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const locations = getVehicleLocations();
    if (user.role === "driver") {
      const assignedVehicles = getDatabase().prepare("SELECT vehicle_id FROM driver_vehicle_assignments WHERE driver_id = ?").all(user.id);
      const assignedLocations = Object.fromEntries(assignedVehicles
        .filter((assignment) => locations[assignment.vehicle_id])
        .map((assignment) => [assignment.vehicle_id, locations[assignment.vehicle_id]]));
      return res.status(200).json(assignedLocations);
    }
    return res.status(200).json(locations);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
