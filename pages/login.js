import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const dashboardForRole = (role) => {
  if (role === "admin") return "/dashboard";
  if (role === "driver") return "/dashboard/driver";
  return "/dashboard/passenger";
};

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (active && data?.user) router.replace(dashboardForRole(data.user.role));
        if (active && !data?.user) localStorage.removeItem("user");
      })
      .catch(() => {});
    return () => { active = false; };
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError("Please enter both username and password.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: trimmedUsername,
          password: trimmedPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || "Invalid username or password");
        return;
      }

      localStorage.setItem("user", JSON.stringify(data.user));
      router.push(dashboardForRole(data.user.role));
    } catch (err) {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e293b 35%, #0f766e 100%)",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "rgba(15, 23, 42, 0.75)",
          border: "1px solid rgba(148, 163, 184, 0.25)",
          borderRadius: "22px",
          padding: "32px",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.45)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              display: "inline-flex",
              width: "64px",
              height: "64px",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "18px",
              background: "linear-gradient(135deg, #14b8a6, #2dd4bf)",
              color: "#062b2e",
              fontSize: "28px",
              fontWeight: 700,
              marginBottom: "16px",
            }}
          >
            T
          </div>
          <h2
            style={{
              margin: 0,
              color: "#f8fafc",
              fontSize: "2rem",
              fontWeight: 700,
            }}
          >
            Welcome back
          </h2>
          <p style={{ marginTop: "8px", color: "#cbd5e1", fontSize: "0.95rem" }}>
            Sign in to your transport dashboard
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "18px" }}>
            <label
              htmlFor="username"
              style={{
                display: "block",
                marginBottom: "8px",
                color: "#dbeafe",
                fontSize: "0.88rem",
                fontWeight: 600,
              }}
            >
              Username
            </label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: "1px solid rgba(148, 163, 184, 0.35)",
                background: "rgba(15, 23, 42, 0.45)",
                color: "#f8fafc",
                fontSize: "1rem",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "8px",
                color: "#dbeafe",
                fontSize: "0.88rem",
                fontWeight: 600,
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: "1px solid rgba(148, 163, 184, 0.35)",
                background: "rgba(15, 23, 42, 0.45)",
                color: "#f8fafc",
                fontSize: "1rem",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                color: "#fecaca",
                border: "1px solid rgba(248, 113, 113, 0.3)",
                padding: "10px 12px",
                borderRadius: "10px",
                marginBottom: "18px",
                fontSize: "0.9rem",
              }}
            >
              {error}
              {error.includes("Activate your account") && (
                <div style={{ marginTop: "8px" }}>
                  <Link href="/activate-driver" style={{ color: "#5eead4", fontWeight: 700 }}>Enter SMS activation code</Link>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              border: "none",
              borderRadius: "12px",
              padding: "14px 18px",
              background: "linear-gradient(135deg, #14b8a6, #2dd4bf)",
              color: "#062b2e",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.8 : 1,
              transition: "transform 0.2s ease",
            }}
          >
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>

        <div
          style={{
            marginTop: "18px",
            textAlign: "center",
            color: "#cbd5e1",
            fontSize: "0.92rem",
          }}
        >
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            style={{
              color: "#5eead4",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}