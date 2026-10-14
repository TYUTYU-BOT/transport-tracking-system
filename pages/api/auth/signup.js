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
    const exists = users.find((u) => u.username === username);

    if (exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const newUser = {
      username,
      password,
      role: "user",
    };

    users.push(newUser);
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2));

    return res.status(201).json({ message: "User created", user: newUser });
  } catch (error) {
    return res.status(500).json({ message: "Unable to save user" });
  }
}
