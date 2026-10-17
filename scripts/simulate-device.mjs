// Simulates an ESP32 GPS tracker driving a UMP shuttle route and posting to POST /api/gps.
// Usage (from the project folder, with the dev server running):
//   node --env-file=.env.local scripts/simulate-device.mjs
//   node --env-file=.env.local scripts/simulate-device.mjs --vehicle TR-108 --interval 3 --speed 50
// Options: --url (default http://localhost:3000), --vehicle (default TR-214),
//          --interval seconds between reports (default 5), --speed km/h (default 40), --once (one lap then stop)

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]?.startsWith("--") || all[index + 1] === undefined ? true : all[index + 1]]);
  return pairs;
}, []));

const baseUrl = args.url || process.env.SIMULATOR_URL || "http://localhost:3000";
const vehicleId = args.vehicle || "TR-214";
const intervalSeconds = Number(args.interval) || 5;
const speedKmh = Number(args.speed) || 40;
const token = process.env.GPS_DEVICE_TOKEN;

if (!token) {
  console.error("GPS_DEVICE_TOKEN is not set. Run with: node --env-file=.env.local scripts/simulate-device.mjs");
  process.exit(1);
}

// Approximate waypoints for a UMP Mbombela campus <-> Riverside <-> Mbombela CBD shuttle loop.
// Adjust these to the real stops (copy coordinates from Google Maps: right-click > the lat,lng line).
const route = [
  { name: "UMP Mbombela campus", lat: -25.4365, lng: 30.9830 },
  { name: "R40 / Government Blvd", lat: -25.4400, lng: 30.9740 },
  { name: "Riverside Mall", lat: -25.4372, lng: 30.9605 },
  { name: "Samora Machel Dr", lat: -25.4560, lng: 30.9650 },
  { name: "Mbombela CBD taxi rank", lat: -25.4745, lng: 30.9700 },
  { name: "Ilanga Mall", lat: -25.4655, lng: 30.9900 },
  { name: "UMP Mbombela campus", lat: -25.4365, lng: 30.9830 },
];

function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Pre-compute points spaced by how far the vehicle travels between reports.
function buildTrack() {
  const step = (speedKmh / 3.6) * intervalSeconds;
  const points = [];
  for (let i = 0; i < route.length - 1; i += 1) {
    const from = route[i];
    const to = route[i + 1];
    const segments = Math.max(1, Math.round(distanceMeters(from, to) / step));
    for (let s = 0; s < segments; s += 1) {
      const t = s / segments;
      points.push({ lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t, stop: s === 0 ? from.name : null });
    }
  }
  points.push({ ...route[route.length - 1], stop: route[route.length - 1].name });
  return points;
}

async function send(point) {
  // Small random speed variation and GPS jitter (about +/- 3 m) so the data looks like a real receiver.
  const jitter = () => (Math.random() - 0.5) * 0.00006;
  const speed = point.stop ? 0 : Math.max(0, speedKmh + (Math.random() - 0.5) * 10);
  const body = { vehicleId, latitude: point.lat + jitter(), longitude: point.lng + jitter(), speed: Number(speed.toFixed(1)) };
  const response = await fetch(`${baseUrl}/api/gps`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-device-token": token },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  const label = point.stop ? ` @ ${point.stop}` : "";
  console.log(`${new Date().toLocaleTimeString()} ${vehicleId} ${body.latitude.toFixed(5)},${body.longitude.toFixed(5)} ${body.speed} km/h${label} -> ${response.status} ${result.message || result.error || ""}`);
  if (response.status === 401 || response.status === 404 || response.status === 503) process.exit(1);
}

const track = buildTrack();
console.log(`Simulating ${vehicleId}: ${track.length} reports per lap, every ${intervalSeconds}s at ~${speedKmh} km/h -> ${baseUrl}/api/gps`);
let index = 0;
const timer = setInterval(async () => {
  try {
    await send(track[index]);
  } catch (error) {
    console.error(`Could not reach ${baseUrl}: ${error.message}`);
  }
  index += 1;
  if (index >= track.length) {
    if (args.once) { clearInterval(timer); console.log("Lap complete."); }
    index = 0;
  }
}, intervalSeconds * 1000);
