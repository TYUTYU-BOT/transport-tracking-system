import { createSessionCookie, findUserByUsername, getDriverApplicationStatus, serializeUser, verifyPassword } from "../../../lib/server-store";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    const user = findUserByUsername(username);
    if (!verifyPassword(user, password)) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    if (user.role === "driver") {
      const applicationStatus = getDriverApplicationStatus(user.id);
      if (applicationStatus === "pending") return res.status(403).json({ message: "Your Driver application is waiting for Admin approval." });
      if (applicationStatus === "approved") return res.status(403).json({ message: "Your application is approved. Activate your account with the SMS code before signing in." });
      if (applicationStatus === "rejected") return res.status(403).json({ message: "Your Driver application was not approved. Contact the transport administrator." });
    }

    res.setHeader("Set-Cookie", createSessionCookie(user));
    return res.status(200).json({ user: serializeUser(user) });
  } catch (error) {
    console.error("Login failed:", error.message);
    return res.status(500).json({ message: "Unable to sign in right now" });
  }
}
