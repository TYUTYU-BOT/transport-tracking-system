import { getDatabase, getSession } from "../../../lib/server-store";

export default function handler(req, res) {
  const user = getSession(req);
  if (!user || user.role !== "admin") {
    return res.status(401).json({ message: "Administrator sign-in required" });
  }

  const db = getDatabase();
  if (req.method === "GET") {
    const notifications = db.prepare("SELECT id, recipient_role AS recipient, message, created_at AS sentAt FROM notifications ORDER BY id DESC LIMIT 30").all();
    return res.status(200).json({ notifications });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const recipients = { "All users": "all", Drivers: "driver", Passengers: "passenger" };
  const recipientRole = recipients[req.body?.recipient];
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!recipientRole || !message || message.length > 2000) {
    return res.status(400).json({ message: "Choose a recipient and enter a message up to 2000 characters" });
  }

  const sentAt = new Date().toISOString();
  const result = db.prepare("INSERT INTO notifications (recipient_role, message, created_at) VALUES (?, ?, ?)").run(recipientRole, message, sentAt);
  return res.status(201).json({ notification: { id: Number(result.lastInsertRowid), recipient: recipientRole, message, sentAt } });
}
