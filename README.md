This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/pages/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Local data and authentication

The API uses Node.js built-in SQLite. Use Node.js 22.5 or newer; Node.js 24 LTS is recommended. The first auth API request creates `data/transport.sqlite`, imports accounts from `data/users.json` with scrypt password hashes, and clears the plaintext JSON after the migration succeeds. The SQLite database is ignored by Git and remains on the local machine between restarts.

Copy `.env.example` to `.env.local` before the first run of a fresh database. Local development generates private PII-encryption and activation keys under the current user's home directory if those variables are absent. Production must explicitly set unique 32-byte base64 values for `DRIVER_PII_ENCRYPTION_KEY` and `SMS_ACTIVATION_SECRET`, plus a `GPS_DEVICE_TOKEN`. Configure the Twilio SID, auth token, and sender number to deliver Driver activation codes. Do not commit `.env.local` or share these values. The initial Admin variables are only used when the database has no accounts. Existing migrated accounts keep their current passwords.

Driver applications collect name, phone, and license number. License numbers are encrypted in SQLite. Admins review applications and assign one or more vehicles; approval triggers a short-lived SMS activation code derived with a server secret and random nonce. Drivers activate at `/activate-driver`, then sign in. Driver trip start/end, vehicle status, incidents, and browser GPS submissions are session-authenticated and saved in SQLite. External GPS devices must send JSON with `vehicleId`, `latitude`, `longitude`, and optional `speed` to `POST /api/gps`, along with the `x-device-token` header.

**Deployment limitation:** this SQLite file is suitable for a local prototype only. Vercel's serverless filesystem is not durable or shared between instances. Before deploying these APIs for real users, move the store to a managed PostgreSQL/SQLite service and configure its connection and secrets in the deployment environment.

## GPS tracking: device, simulator and history

**Live position and history.** Every GPS report (from `POST /api/gps` or a driver's phone) updates the vehicle's latest position in `gps_locations` and is also appended to `gps_history`. A vehicle is reported as `online: false` by `GET /api/gps` when it has not sent a position for 60 seconds (`GPS_OFFLINE_AFTER_SECONDS`). History older than 90 days can be removed with `pruneGpsHistory()` (`GPS_HISTORY_RETENTION_DAYS`).

**Reading history.** `GET /api/gps-history?vehicleId=TR-214&from=<ISO date>&to=<ISO date>` returns the recorded points, oldest first (default: the last 24 hours). Admins can read any vehicle; drivers only their assigned vehicles.

**Simulated device (no hardware needed).** With `npm run dev` running and `GPS_DEVICE_TOKEN` set in `.env.local`, run in a second terminal:

```bash
npm run simulate
# or with options
node --env-file=.env.local scripts/simulate-device.mjs --vehicle TR-108 --interval 3 --speed 50
```

It drives a loop between UMP Mbombela campus, Riverside Mall and the Mbombela CBD, posting a position every 5 seconds. The waypoints are approximate; adjust them in `scripts/simulate-device.mjs` to the real stops.

**ESP32 hardware.** `firmware/esp32_gps_tracker/esp32_gps_tracker.ino` reads a Neo-6M GPS and posts to `/api/gps` over Wi-Fi (for testing) or a SIM800L GSM module (for the vehicle). The wiring, libraries and settings are listed at the top of the file. The device cannot reach `localhost`: for Wi-Fi use the laptop's LAN IP and start the server with `npm run dev -- -H 0.0.0.0`; for GSM the server must be reachable from the internet.

You can start editing the page by modifying `pages/index.js`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.js`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.
