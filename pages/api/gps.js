let vehicles = {};

export default function handler(req, res) {
  if (req.method === "POST") {
    const { vehicleId, latitude, longitude, speed } = req.body;

    if (!vehicleId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Invalid data" });
    }

    vehicles[vehicleId] = {
      latitude,
      longitude,
      speed: speed || 0,
      lastUpdated: new Date().toISOString(),
    };

    return res.json({ message: "GPS updated" });
  }

  if (req.method === "GET") {
    return res.json(vehicles);
  }
}
