import { clearSessionCookie } from "../../../lib/server-store";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.status(200).json({ message: "Signed out" });
}
