import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual, createHmac, createCipheriv, createDecipheriv } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const databasePath = process.env.TRANSPORT_DATABASE_PATH || path.join(process.cwd(), "data", "transport.sqlite");
let database;

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getSecretValue(environmentName, fileName, byteLength) {
  let value = process.env[environmentName];
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`${environmentName} must be configured in production`);
    }

    const secretDirectory = path.join(os.homedir(), ".transport-tracking-system", "secrets");
    const secretPath = path.join(secretDirectory, fileName);
    fs.mkdirSync(secretDirectory, { recursive: true });
    try {
      fs.writeFileSync(secretPath, `${randomBytes(byteLength).toString("base64")}\n`, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    value = fs.readFileSync(secretPath, "utf8").trim();
  }

  if (Buffer.from(value, "base64").length !== byteLength) {
    throw new Error(`${environmentName} must be a base64-encoded ${byteLength}-byte secret`);
  }
  return value;
}

function getPiiKey() {
  const key = Buffer.from(getSecretValue("DRIVER_PII_ENCRYPTION_KEY", "driver-pii.key", 32), "base64");
  return key;
}

function encryptDriverLicense(licenseNumber) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getPiiKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(licenseNumber, "utf8"), cipher.final()]);
  return { licenseCiphertext: ciphertext.toString("base64"), licenseIv: iv.toString("base64"), licenseTag: cipher.getAuthTag().toString("base64") };
}

function decryptDriverLicense(application) {
  const decipher = createDecipheriv("aes-256-gcm", getPiiKey(), Buffer.from(application.license_iv, "base64"));
  decipher.setAuthTag(Buffer.from(application.license_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(application.license_ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function makeUserRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    vehicleId: row.vehicle_id || null,
  };
}

function seedRoutes(db) {
  const routes = [
    ["RTE-01", "Durban", "Pietermaritzburg", "09:40", "11:10", "On schedule"],
    ["RTE-02", "Cape Town", "Paarl", "10:05", "11:20", "Delayed 12m"],
    ["RTE-03", "Johannesburg", "Pretoria", "11:15", "12:00", "On schedule"],
  ];
  const insert = db.prepare("INSERT OR IGNORE INTO routes (id, origin, destination, departure, arrival, status) VALUES (?, ?, ?, ?, ?, ?)");
  routes.forEach((route) => insert.run(...route));

  const vehicles = [
    ["TR-214", "Mercedes Sprinter", "RTE-01", "Active"],
    ["TR-108", "Toyota Quantum", "RTE-02", "Active"],
    ["TR-066", "Isuzu N-Series", "RTE-03", "Maintenance"],
  ];
  const insertVehicle = db.prepare("INSERT OR IGNORE INTO vehicles (id, label, route_id, status) VALUES (?, ?, ?, ?)");
  vehicles.forEach((vehicle) => insertVehicle.run(...vehicle));
}

function migrateLegacyUsers(db) {
  const count = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (count > 0) return;

  const legacyPath = path.join(process.cwd(), "data", "users.json");
  if (!fs.existsSync(legacyPath)) return;

  const legacyUsers = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
  if (!Array.isArray(legacyUsers)) throw new Error("Legacy users data must be a JSON array");

  const insert = db.prepare("INSERT OR IGNORE INTO users (username, password_salt, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)");
  db.exec("BEGIN IMMEDIATE");
  let committed = false;
  try {
    for (const user of legacyUsers) {
      if (!user.username || !user.password) continue;
      const role = user.role === "admin" || user.role === "driver" ? user.role : "passenger";
      const credentials = hashPassword(user.password);
      insert.run(user.username.trim(), credentials.salt, credentials.hash, role, new Date().toISOString());
    }
    db.exec("COMMIT");
    committed = true;
  } catch (error) {
    if (!committed) db.exec("ROLLBACK");
    throw error;
  }

  try {
    fs.writeFileSync(legacyPath, "[]\n", "utf8");
  } catch (error) {
    console.error("Could not clear migrated plaintext user file:", error.message);
  }
}

export function getDatabase() {
  if (database) return database;

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'driver', 'passenger')),
      vehicle_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      departure TEXT NOT NULL,
      arrival TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      route_id TEXT REFERENCES routes(id),
      status TEXT NOT NULL DEFAULT 'Ready',
      assigned_driver_id INTEGER REFERENCES users(id),
      license_plate TEXT UNIQUE
    );
    CREATE TABLE IF NOT EXISTS driver_applications (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '',
      birth_date TEXT NOT NULL DEFAULT '',
      service_types TEXT NOT NULL DEFAULT '[]',
      vehicle_ownership TEXT NOT NULL DEFAULT 'fleet',
      phone_number TEXT NOT NULL UNIQUE,
      license_ciphertext TEXT NOT NULL,
      license_iv TEXT NOT NULL,
      license_tag TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'active', 'rejected')),
      activation_salt TEXT,
      activation_hash TEXT,
      activation_expires_at TEXT,
      activation_attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS driver_application_vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id INTEGER NOT NULL REFERENCES driver_applications(user_id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT '',
      year INTEGER NOT NULL,
      color TEXT NOT NULL,
      license_plate TEXT NOT NULL UNIQUE,
      review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'verified', 'rejected'))
    );
    CREATE TABLE IF NOT EXISTS driver_vehicle_assignments (
      driver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      assigned_at TEXT NOT NULL,
      PRIMARY KEY (driver_id, vehicle_id)
    );
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id INTEGER NOT NULL REFERENCES users(id),
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
      route_id TEXT REFERENCES routes(id),
      status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
    CREATE TABLE IF NOT EXISTS gps_locations (
      vehicle_id TEXT PRIMARY KEY REFERENCES vehicles(id),
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gps_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'device',
      recorded_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gps_history_vehicle_time ON gps_history(vehicle_id, recorded_at);
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id INTEGER NOT NULL REFERENCES users(id),
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_role TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const applicationColumns = new Set(database.prepare("PRAGMA table_info(driver_applications)").all().map((column) => column.name));
  const applicationMigrations = [
    ["first_name", "TEXT NOT NULL DEFAULT ''"],
    ["last_name", "TEXT NOT NULL DEFAULT ''"],
    ["email", "TEXT NOT NULL DEFAULT ''"],
    ["region", "TEXT NOT NULL DEFAULT ''"],
    ["gender", "TEXT NOT NULL DEFAULT ''"],
    ["birth_date", "TEXT NOT NULL DEFAULT ''"],
    ["service_types", "TEXT NOT NULL DEFAULT '[]'"],
    ["vehicle_ownership", "TEXT NOT NULL DEFAULT 'fleet'"],
  ];
  applicationMigrations.forEach(([column, definition]) => {
    if (!applicationColumns.has(column)) database.exec(`ALTER TABLE driver_applications ADD COLUMN ${column} ${definition}`);
  });
  const vehicleColumns = new Set(database.prepare("PRAGMA table_info(vehicles)").all().map((column) => column.name));
  if (!vehicleColumns.has("license_plate")) database.exec("ALTER TABLE vehicles ADD COLUMN license_plate TEXT");
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_license_plate ON vehicles(license_plate) WHERE license_plate IS NOT NULL");

  seedRoutes(database);
  database.prepare(`
    INSERT OR IGNORE INTO driver_vehicle_assignments (driver_id, vehicle_id, assigned_at)
    SELECT assigned_driver_id, id, ? FROM vehicles WHERE assigned_driver_id IS NOT NULL
  `).run(new Date().toISOString());
  migrateLegacyUsers(database);
  const userCount = database.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (userCount === 0 && process.env.INITIAL_ADMIN_USERNAME && process.env.INITIAL_ADMIN_PASSWORD) {
    if (process.env.INITIAL_ADMIN_PASSWORD.length < 12) {
      throw new Error("INITIAL_ADMIN_PASSWORD must be at least 12 characters");
    }
    const credentials = hashPassword(process.env.INITIAL_ADMIN_PASSWORD);
    database.prepare("INSERT INTO users (username, password_salt, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', ?)")
      .run(process.env.INITIAL_ADMIN_USERNAME.trim(), credentials.salt, credentials.hash, new Date().toISOString());
  }
  return database;
}

export function findUserByUsername(username) {
  return getDatabase().prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
}

export function verifyPassword(user, password) {
  if (!user || !password) return false;
  const candidate = hashPassword(password, user.password_salt).hash;
  return safeEqual(candidate, user.password_hash);
}

export function createUser(username, password, role) {
  const db = getDatabase();
  const credentials = hashPassword(password);
  const normalizedRole = role === "admin" ? "admin" : "passenger";
  const result = db.prepare("INSERT INTO users (username, password_salt, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(username.trim(), credentials.salt, credentials.hash, normalizedRole, new Date().toISOString());
  const userId = Number(result.lastInsertRowid);

  return makeUserRecord(db.prepare("SELECT * FROM users WHERE id = ?").get(userId));
}

export function createDriverApplication({ username, password, firstName, lastName, email, region, gender, birthDate, serviceTypes, vehicleOwnership, phoneNumber, licenseNumber, vehicles }) {
  const db = getDatabase();
  const credentials = hashPassword(password);
  const encryptedLicense = encryptDriverLicense(licenseNumber);
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db.prepare("INSERT INTO users (username, password_salt, password_hash, role, created_at) VALUES (?, ?, ?, 'driver', ?)")
      .run(username.trim(), credentials.salt, credentials.hash, new Date().toISOString());
    const userId = Number(result.lastInsertRowid);
    db.prepare(`
      INSERT INTO driver_applications (
        user_id, full_name, first_name, last_name, email, region, gender, birth_date, service_types, vehicle_ownership,
        phone_number, license_ciphertext, license_iv, license_tag, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      userId,
      `${firstName.trim()} ${lastName.trim()}`,
      firstName.trim(),
      lastName.trim(),
      email.trim().toLowerCase(),
      region.trim(),
      gender,
      birthDate,
      JSON.stringify(serviceTypes),
      vehicleOwnership,
      phoneNumber,
      encryptedLicense.licenseCiphertext,
      encryptedLicense.licenseIv,
      encryptedLicense.licenseTag,
      new Date().toISOString(),
    );
    const insertVehicle = db.prepare(`
      INSERT INTO driver_application_vehicles (driver_id, category, make, model, year, color, license_plate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    if (vehicleOwnership === "own") {
      vehicles.forEach((vehicle) => insertVehicle.run(userId, vehicle.category, vehicle.make.trim(), vehicle.model.trim(), vehicle.year, vehicle.color.trim(), vehicle.licensePlate.trim().toUpperCase()));
    }
    db.exec("COMMIT");
    return makeUserRecord(db.prepare("SELECT * FROM users WHERE id = ?").get(userId));
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function applicationRecord(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    username: row.username,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    licenseNumber: decryptDriverLicense(row),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    region: row.region,
    gender: row.gender,
    birthDate: row.birth_date,
    serviceTypes: JSON.parse(row.service_types || "[]"),
    vehicleOwnership: row.vehicle_ownership,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

export function getDriverApplication(userId) {
  const row = getDatabase().prepare(`
    SELECT a.*, u.username FROM driver_applications a JOIN users u ON u.id = a.user_id WHERE a.user_id = ?
  `).get(userId);
  return applicationRecord(row);
}

export function listDriverApplications() {
  const db = getDatabase();
  const rows = getDatabase().prepare(`
    SELECT a.*, u.username FROM driver_applications a JOIN users u ON u.id = a.user_id
    ORDER BY CASE a.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, a.created_at DESC
  `).all();
  return rows.map((row) => ({
    ...applicationRecord(row),
    vehicleIds: db.prepare("SELECT vehicle_id FROM driver_vehicle_assignments WHERE driver_id = ? ORDER BY vehicle_id").all(row.user_id).map((assignment) => assignment.vehicle_id),
    applicantVehicles: db.prepare("SELECT id, category, make, model, year, color, license_plate AS licensePlate, review_status AS reviewStatus FROM driver_application_vehicles WHERE driver_id = ? ORDER BY id").all(row.user_id),
  }));
}

export function getDriverApplicationStatus(userId) {
  return getDatabase().prepare("SELECT status FROM driver_applications WHERE user_id = ?").get(userId)?.status || null;
}

export function reviewDriverApplication(userId, status, vehicleIds = [], applicantVehicleIds = []) {
  if (!['approved', 'rejected'].includes(status)) throw new Error("Invalid application decision");
  const db = getDatabase();
  const app = db.prepare("SELECT user_id FROM driver_applications WHERE user_id = ?").get(userId);
  if (!app) return false;

  const uniqueVehicleIds = [...new Set(vehicleIds)];
  const uniqueApplicantVehicleIds = [...new Set(applicantVehicleIds)];
  const applicantVehicles = uniqueApplicantVehicleIds.length
    ? db.prepare(`SELECT * FROM driver_application_vehicles WHERE driver_id = ? AND id IN (${uniqueApplicantVehicleIds.map(() => "?").join(",")})`).all(userId, ...uniqueApplicantVehicleIds)
    : [];
  if (applicantVehicles.length !== uniqueApplicantVehicleIds.length) throw new Error("One or more submitted vehicles do not belong to this application");

  if (status === "approved") {
    const existingVehicles = uniqueVehicleIds.length
      ? db.prepare(`SELECT id FROM vehicles WHERE id IN (${uniqueVehicleIds.map(() => "?").join(",")})`).all(...uniqueVehicleIds)
      : [];
    if (existingVehicles.length !== uniqueVehicleIds.length) throw new Error("One or more selected vehicles do not exist");
    const duplicatePlate = db.prepare(`SELECT license_plate FROM vehicles WHERE license_plate IN (${applicantVehicles.map(() => "?").join(",") || "NULL"})`).all(...applicantVehicles.map((vehicle) => vehicle.license_plate));
    if (duplicatePlate.length) throw new Error("An applicant vehicle license plate is already registered");
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM driver_vehicle_assignments WHERE driver_id = ?").run(userId);
    if (status === "approved") {
      const insert = db.prepare("INSERT INTO driver_vehicle_assignments (driver_id, vehicle_id, assigned_at) VALUES (?, ?, ?)");
      const assignedVehicleIds = [...uniqueVehicleIds];
      for (const applicantVehicle of applicantVehicles) {
        const vehicleId = `OWN-${applicantVehicle.license_plate.replace(/[^a-z0-9]/gi, "").toUpperCase()}`;
        db.prepare("INSERT INTO vehicles (id, label, status, license_plate) VALUES (?, ?, 'Active', ?)")
          .run(vehicleId, `${applicantVehicle.make} ${applicantVehicle.model}`.trim(), applicantVehicle.license_plate);
        db.prepare("UPDATE driver_application_vehicles SET review_status = 'verified' WHERE id = ?").run(applicantVehicle.id);
        assignedVehicleIds.push(vehicleId);
      }
      assignedVehicleIds.forEach((vehicleId) => insert.run(userId, vehicleId, new Date().toISOString()));
      db.prepare("UPDATE users SET vehicle_id = ? WHERE id = ?").run(assignedVehicleIds[0] || null, userId);
    } else {
      db.prepare("UPDATE users SET vehicle_id = NULL WHERE id = ?").run(userId);
      db.prepare("UPDATE driver_application_vehicles SET review_status = 'rejected' WHERE driver_id = ?").run(userId);
    }
    db.prepare("UPDATE driver_applications SET status = ?, reviewed_at = ? WHERE user_id = ?")
      .run(status, new Date().toISOString(), userId);
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function createDriverActivationCode(userId) {
  const secret = Buffer.from(getSecretValue("SMS_ACTIVATION_SECRET", "driver-activation.key", 32), "base64");
  const app = getDatabase().prepare("SELECT * FROM driver_applications WHERE user_id = ? AND status = 'approved'").get(userId);
  if (!app) throw new Error("Driver application must be approved before activation");

  const licenseNumber = decryptDriverLicense(app);
  const nonce = randomBytes(24).toString("hex");
  const digest = createHmac("sha256", secret).update(`${userId}:${licenseNumber}:${nonce}`).digest();
  const code = String(digest.readUIntBE(0, 6) % 1000000).padStart(6, "0");
  const credentials = hashPassword(code);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  getDatabase().prepare(`
    UPDATE driver_applications SET activation_salt = ?, activation_hash = ?, activation_expires_at = ?, activation_attempts = 0
    WHERE user_id = ?
  `).run(credentials.salt, credentials.hash, expiresAt, userId);
  return code;
}

export function activateDriverAccount(phoneNumber, code) {
  const db = getDatabase();
  const app = db.prepare("SELECT user_id, activation_salt, activation_hash, activation_expires_at, activation_attempts FROM driver_applications WHERE phone_number = ? AND status = 'approved'").get(phoneNumber);
  if (!app || !app.activation_hash || !app.activation_salt || !app.activation_expires_at || Date.parse(app.activation_expires_at) < Date.now() || app.activation_attempts >= 5) {
    return false;
  }

  const candidate = hashPassword(code, app.activation_salt).hash;
  if (!safeEqual(candidate, app.activation_hash)) {
    db.prepare("UPDATE driver_applications SET activation_attempts = activation_attempts + 1 WHERE user_id = ?").run(app.user_id);
    return false;
  }

  db.prepare("UPDATE driver_applications SET status = 'active', activation_salt = NULL, activation_hash = NULL, activation_expires_at = NULL, activation_attempts = 0 WHERE user_id = ?").run(app.user_id);
  return true;
}

function getSessionSecret() {
  const db = getDatabase();
  const current = db.prepare("SELECT value FROM app_settings WHERE key = 'session_secret'").get();
  if (current) return current.value;
  const secret = randomBytes(48).toString("hex");
  db.prepare("INSERT INTO app_settings (key, value) VALUES ('session_secret', ?)").run(secret);
  return secret;
}

export function createSessionCookie(user) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `transport_session=${payload}.${signature}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `transport_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function getSession(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookie = cookieHeader.split(";").map((item) => item.trim()).find((item) => item.startsWith("transport_session="));
  if (!cookie) return null;

  const token = cookie.slice("transport_session=".length);
  const separator = token.lastIndexOf(".");
  if (separator < 0) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = createHmac("sha256", getSessionSecret()).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (session.expiresAt < Date.now()) return null;
    const user = getDatabase().prepare("SELECT id, username, role, vehicle_id FROM users WHERE id = ?").get(session.id);
    if (user?.role === "driver") {
      const applicationStatus = getDriverApplicationStatus(user.id);
      if (applicationStatus && applicationStatus !== "active") return null;
    }
    return makeUserRecord(user);
  } catch {
    return null;
  }
}

export function getAssignedVehicle(userId) {
  return getAssignedVehicles(userId)[0] || null;
}

export function getAssignedVehicles(userId) {
  return getDatabase().prepare(`
    SELECT v.*, r.origin, r.destination, r.departure, r.arrival, r.status AS route_status
    FROM driver_vehicle_assignments a JOIN vehicles v ON v.id = a.vehicle_id
    LEFT JOIN routes r ON r.id = v.route_id WHERE a.driver_id = ? ORDER BY v.id
  `).all(userId);
}

// A vehicle is shown as offline when its device has not reported within this many seconds.
export const OFFLINE_AFTER_SECONDS = Number(process.env.GPS_OFFLINE_AFTER_SECONDS) || 60;

function isOnline(updatedAt, now = Date.now()) {
  return now - new Date(updatedAt).getTime() <= OFFLINE_AFTER_SECONDS * 1000;
}

export function getVehicleLocations() {
  const db = getDatabase();
  const now = Date.now();
  return Object.fromEntries(db.prepare("SELECT vehicle_id, latitude, longitude, speed, updated_at AS lastUpdated FROM gps_locations").all()
    .map((row) => [row.vehicle_id, {
      latitude: row.latitude,
      longitude: row.longitude,
      speed: row.speed,
      lastUpdated: row.lastUpdated,
      online: isOnline(row.lastUpdated, now),
    }]));
}

// Saves the latest position (for the live map) and appends the point to gps_history (for trip history and analytics).
export function updateVehicleLocation(vehicleId, latitude, longitude, speed = 0, source = "device") {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      INSERT INTO gps_locations (vehicle_id, latitude, longitude, speed, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(vehicle_id) DO UPDATE SET latitude = excluded.latitude, longitude = excluded.longitude, speed = excluded.speed, updated_at = excluded.updated_at
    `).run(vehicleId, latitude, longitude, speed, now);
    db.prepare("INSERT INTO gps_history (vehicle_id, latitude, longitude, speed, source, recorded_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(vehicleId, latitude, longitude, speed, source, now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { vehicleId, updatedAt: now };
}

// Returns recorded points for one vehicle, oldest first, between two ISO timestamps.
export function getVehicleHistory(vehicleId, { from, to, limit = 2000 } = {}) {
  const fromTime = from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const toTime = to || new Date().toISOString();
  const safeLimit = Math.min(Math.max(Number(limit) || 2000, 1), 10000);
  return getDatabase().prepare(`
    SELECT latitude, longitude, speed, source, recorded_at AS recordedAt
    FROM gps_history WHERE vehicle_id = ? AND recorded_at BETWEEN ? AND ?
    ORDER BY recorded_at ASC LIMIT ?
  `).all(vehicleId, fromTime, toTime, safeLimit);
}

// Removes history older than the given number of days, so the database does not grow forever.
export function pruneGpsHistory(days = Number(process.env.GPS_HISTORY_RETENTION_DAYS) || 90) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return getDatabase().prepare("DELETE FROM gps_history WHERE recorded_at < ?").run(cutoff).changes;
}

export function serializeUser(row) {
  return makeUserRecord(row);
}
