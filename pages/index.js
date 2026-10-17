import Link from "next/link";

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        background:
          "linear-gradient(135deg, #020817 0%, #0f172a 32%, #134e4a 100%)",
        color: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1100px",
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: "32px",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "64px",
              height: "64px",
              borderRadius: "18px",
              background: "linear-gradient(135deg, #14b8a6, #2dd4bf)",
              color: "#062b2e",
              fontWeight: 800,
              fontSize: "28px",
              marginBottom: "18px",
            }}
          >
            T
          </div>

          <h1
            style={{
              fontSize: "clamp(2.5rem, 6vw, 5rem)",
              lineHeight: 1.05,
              margin: 0,
              fontWeight: 800,
            }}
          >
            Track your fleet with confidence.
          </h1>

          <p
            style={{
              marginTop: "18px",
              maxWidth: "620px",
              color: "#cbd5e1",
              fontSize: "1.08rem",
              lineHeight: 1.7,
            }}
          >
            Monitor vehicles in real time, keep movement data organized, and
            manage your transport operations from a single dashboard built for
            speed and clarity.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "14px",
              marginTop: "28px",
            }}
          >
            <Link
              href="/login"
              style={{
                textDecoration: "none",
                background: "linear-gradient(135deg, #14b8a6, #2dd4bf)",
                color: "#062b2e",
                padding: "14px 22px",
                borderRadius: "12px",
                fontWeight: 700,
                display: "inline-block",
              }}
            >
              Login
            </Link>

            <Link
              href="/signup"
              style={{
                textDecoration: "none",
                border: "1px solid rgba(148, 163, 184, 0.5)",
                background: "rgba(15, 23, 42, 0.5)",
                color: "#f8fafc",
                padding: "14px 22px",
                borderRadius: "12px",
                fontWeight: 700,
                display: "inline-block",
              }}
            >
              Create account
            </Link>
          </div>
        </div>

        <div
          style={{
            background: "rgba(15, 23, 42, 0.7)",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            borderRadius: "26px",
            padding: "24px",
            boxShadow: "0 24px 48px rgba(2, 6, 23, 0.35)",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, rgba(20,184,166,0.18), rgba(45,212,191,0.08))",
              border: "1px solid rgba(45, 212, 191, 0.35)",
              borderRadius: "18px",
              padding: "18px",
              marginBottom: "18px",
            }}
          >
            <div
              style={{
                fontSize: "0.76rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#99f6e4",
                marginBottom: "10px",
              }}
            >
              Real-time overview
            </div>
            <div
              style={{
                fontSize: "2.2rem",
                fontWeight: 800,
                color: "#f8fafc",
              }}
            >
              24/7
            </div>
            <div style={{ color: "#cbd5e1", marginTop: "8px" }}>
              Fleet visibility for every route and driver.
            </div>
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            {[
              "Live vehicle tracking",
              "Route visibility and monitoring",
              "Fast access to transport operations",
            ].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  background: "rgba(15, 23, 42, 0.45)",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  color: "#e2e8f0",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "#14b8a6",
                    color: "#062b2e",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                  }}
                >
                  ✓
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}