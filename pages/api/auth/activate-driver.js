import { activateDriverAccount } from "../../../lib/server-store";

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

  const phoneNumber = typeof req.body?.phoneNumber === "string" ? normalizePhoneNumber(req.body.phoneNumber) : null;
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!phoneNumber || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: "Enter the phone number used on your application and the six-digit SMS code" });
  }

  try {
    if (!activateDriverAccount(phoneNumber, code)) {
      return res.status(400).json({ message: "Code is invalid, expired, or the attempt limit was reached" });
    }
    return res.status(200).json({ message: "Driver account activated. You can now sign in." });
  } catch (error) {
    console.error("Driver activation failed:", error.message);
    return res.status(500).json({ message: "Unable to activate the account right now" });
  }
}
