import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "users.json");

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    const users = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const user = users.find(
      (u) => u.username === username && u.password === password
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ message: "Unable to read users data" });
  }
}
