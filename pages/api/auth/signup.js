import { createDriverApplication, createUser, findUserByUsername } from "../../../lib/server-store";

function normalizePhoneNumber(value) {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^0\d{9}$/.test(compact)) return `+27${compact.slice(1)}`;
  if (/^\+?[1-9]\d{7,14}$/.test(compact)) return compact.startsWith("+") ? compact : `+${compact}`;
  return null;
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const role = req.body?.role === "driver" ? "driver" : "passenger";
  const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
  const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const region = typeof req.body?.region === "string" ? req.body.region.trim() : "";
  const gender = req.body?.gender;
  const birthDate = typeof req.body?.birthDate === "string" ? req.body.birthDate : "";
  const serviceTypes = Array.isArray(req.body?.serviceTypes) ? req.body.serviceTypes : [];
  const vehicleOwnership = req.body?.vehicleOwnership;
  const phoneNumber = typeof req.body?.phoneNumber === "string" ? normalizePhoneNumber(req.body.phoneNumber) : null;
  const licenseNumber = typeof req.body?.licenseNumber === "string" ? req.body.licenseNumber.trim().toUpperCase() : "";
  const applicantVehicles = Array.isArray(req.body?.vehicles) ? req.body.vehicles : [];

  if (username.length < 3 || username.length > 80) {
    return res.status(400).json({ message: "Username must be between 3 and 80 characters" });
  }
  if (
    password.length < 12 || password.length > 200 ||
    !/[a-z]/.test(password) || !/[A-Z]/.test(password) ||
    !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)
  ) {
    return res.status(400).json({
      message: "Password must be 12-200 characters and include an uppercase letter, a lowercase letter, a number, and a special character",
    });
  }
  if (role === "driver" && (!email || email.length > 160 || !/^[^\s@.]+(?:\.[^\s@.]+)*@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email))) {
    return res.status(400).json({ message: "Enter a valid email address, such as name@example.com" });
  }
  if (role === "driver" && !phoneNumber) {
    return res.status(400).json({ message: "Enter a valid phone number, such as 082 123 4567 or +27 82 123 4567" });
  }
  if (role === "driver" && process.env.NODE_ENV === "production" && !process.env.DRIVER_PII_ENCRYPTION_KEY) {
    return res.status(503).json({ message: "Driver applications are not configured yet. Please contact the administrator." });
  }
  const validServiceTypes = new Set(["passengers", "freight", "delivery", "door-to-door"]);
  const parsedBirthDate = new Date(`${birthDate}T00:00:00Z`);
  const validBirthDate = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) &&
    Number.isFinite(parsedBirthDate.getTime()) &&
    parsedBirthDate.toISOString().slice(0, 10) === birthDate &&
    new Date(parsedBirthDate.getUTCFullYear() + 18, parsedBirthDate.getUTCMonth(), parsedBirthDate.getUTCDate()) <= new Date();
  if (role === "driver" && (
    firstName.length < 2 || lastName.length < 2 || firstName.length > 80 || lastName.length > 80 ||
    !region || region.length > 100 ||
    !["female", "male", "other", "prefer-not-to-say"].includes(gender) || !validBirthDate ||
    licenseNumber.length < 4 || licenseNumber.length > 64 ||
    !["own", "fleet"].includes(vehicleOwnership) || serviceTypes.length === 0 ||
    serviceTypes.some((service) => !validServiceTypes.has(service)) ||
    (vehicleOwnership === "own" && (applicantVehicles.length < 1 || applicantVehicles.length > 5 || applicantVehicles.some((vehicle) =>
      !vehicle || typeof vehicle.category !== "string" || !vehicle.category.trim() ||
      typeof vehicle.make !== "string" || !vehicle.make.trim() ||
      typeof vehicle.model !== "string" ||
      !Number.isInteger(Number(vehicle.year)) || Number(vehicle.year) < 1980 || Number(vehicle.year) > new Date().getFullYear() + 1 ||
      typeof vehicle.color !== "string" || !vehicle.color.trim() ||
      typeof vehicle.licensePlate !== "string" || vehicle.licensePlate.trim().length < 4 || vehicle.licensePlate.trim().length > 20
    )))
  )) {
    return res.status(400).json({ message: "Complete your personal, contact, service, license, and vehicle details" });
  }

  try {
    if (findUserByUsername(username)) {
      return res.status(409).json({ message: "Username is already taken" });
    }

    const user = role === "driver"
      ? createDriverApplication({ username, password, firstName, lastName, email, region, gender, birthDate, serviceTypes, vehicleOwnership, phoneNumber, licenseNumber, vehicles: applicantVehicles.map((vehicle) => ({ ...vehicle, year: Number(vehicle.year) })) })
      : createUser(username, password, role);
    return res.status(201).json({
      message: role === "driver" ? "Driver application submitted for Admin review" : "User created",
      user,
      applicationStatus: role === "driver" ? "pending" : undefined,
    });
  } catch (error) {
    if (error.code === "ERR_SQLITE_CONSTRAINT_UNIQUE" || error.errcode === 2067) {
      const message = error.message.includes("phone_number")
        ? "That phone number already has a Driver application"
        : error.message.includes("license_plate")
          ? "That vehicle plate is already registered"
          : "Username is already taken";
      return res.status(409).json({ message });
    }
    console.error("Signup failed:", error.message);
    return res.status(500).json({ message: "Unable to create account right now" });
  }
}
