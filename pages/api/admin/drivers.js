import {
  createDriverActivationCode,
  getDatabase,
  getDriverApplication,
  getSession,
  listDriverApplications,
  reviewDriverApplication,
} from "../../../lib/server-store";
import { sendSms } from "../../../lib/sms";

export default async function handler(req, res) {
  const admin = getSession(req);
  if (!admin || admin.role !== "admin") {
    return res.status(401).json({ message: "Administrator sign-in required" });
  }

  const db = getDatabase();
  if (req.method === "GET") {
    const vehicles = db.prepare("SELECT id, label, status FROM vehicles ORDER BY id").all();
    return res.status(200).json({ applications: listDriverApplications(), vehicles });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const userId = Number(req.body?.userId);
  const decision = req.body?.decision;
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(400).json({ message: "Invalid driver application" });
  }

  try {
    if (decision === "reject") {
      if (!reviewDriverApplication(userId, "rejected")) return res.status(404).json({ message: "Application not found" });
      return res.status(200).json({ message: "Driver application rejected" });
    }

    if (decision !== "approve" && decision !== "resend") {
      return res.status(400).json({ message: "Choose approve, reject, or resend" });
    }

    if (decision === "approve") {
      const vehicleIds = req.body?.vehicleIds;
      const applicantVehicleIds = req.body?.applicantVehicleIds;
      if (!Array.isArray(vehicleIds) || vehicleIds.some((id) => typeof id !== "string") || !Array.isArray(applicantVehicleIds) || applicantVehicleIds.some((id) => !Number.isSafeInteger(Number(id)))) {
        return res.status(400).json({ message: "Choose valid vehicle assignments" });
      }
      if (!vehicleIds.length && !applicantVehicleIds.length) return res.status(400).json({ message: "Assign or verify at least one vehicle before approving" });
      const unavailable = vehicleIds.length
        ? db.prepare(`SELECT id FROM vehicles WHERE id IN (${vehicleIds.map(() => "?").join(",")}) AND status = 'Maintenance'`).all(...vehicleIds)
        : [];
      if (unavailable.length) return res.status(409).json({ message: "Vehicles in maintenance cannot be assigned" });
      if (!reviewDriverApplication(userId, "approved", vehicleIds, applicantVehicleIds.map(Number))) return res.status(404).json({ message: "Application not found" });
    }

    const application = getDriverApplication(userId);
    if (!application || application.status !== "approved") return res.status(409).json({ message: "Application must be approved before sending activation" });
    try {
      const code = createDriverActivationCode(userId);
      await sendSms(application.phoneNumber, `Transport driver activation code: ${code}. It expires in 15 minutes. Enter it at /activate-driver. Do not share this code.`);
      return res.status(200).json({ message: decision === "approve" ? "Application approved and activation SMS sent" : "Activation SMS resent", smsSent: true });
    } catch (smsError) {
      console.error("Driver approved; activation SMS could not be sent:", smsError.message);
      return res.status(200).json({
        message: "Application approved and vehicles assigned, but the activation SMS was not sent. Configure Twilio in .env.local, then use Resend activation SMS.",
        smsSent: false,
      });
    }
  } catch (error) {
    console.error("Driver application action failed:", error.message);
    return res.status(502).json({ message: error.message || "Could not complete the driver application action" });
  }
}
