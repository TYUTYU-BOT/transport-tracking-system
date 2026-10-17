import { getSession } from "../../../lib/server-store";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const user = getSession(req);
  if (!user) return res.status(401).json({ message: "Authentication required" });
  return res.status(200).json({ user });
}
