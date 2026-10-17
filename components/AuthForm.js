import { useState } from "react";

export default function AuthForm({ title, buttonLabel, onSubmit }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div style={{ padding: "20px" }}>
      <h2>{title}</h2>

      <input
        placeholder="Username"
        onChange={(e) => setUsername(e.target.value)}
      /><br /><br />

      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
      /><br /><br />

      <button onClick={() => onSubmit({ username, password })}>
        {buttonLabel}
      </button>
    </div>
  );
}
