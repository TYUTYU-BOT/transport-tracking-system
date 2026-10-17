import { useState } from "react";
import Link from "next/link";

export default function ActivateDriver() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activated, setActivated] = useState(false);

  const activate = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/activate-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not activate account");
      setActivated(true);
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="activation-page">
      <section className="activation-panel">
        <Link className="brand" href="/">
          <span className="brand-mark">T</span>Transport
        </Link>
        <div className="eyebrow">Driver onboarding</div>
        <h1>Activate your account</h1>
        <p className="intro">After the Admin approves your application, enter the phone number and one-time code sent by SMS.</p>
        <form onSubmit={activate}>
          <label htmlFor="activation-phone">Phone number</label>
          <input id="activation-phone" type="tel" autoComplete="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="e.g. 082 123 4567" required />
          <label htmlFor="activation-code">Six-digit SMS code</label>
          <input id="activation-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required />
          {message && <p className={`message ${activated ? "success" : "error"}`} role="status">{message}</p>}
          <button type="submit" disabled={isSubmitting || activated}>{isSubmitting ? "Activating..." : activated ? "Account activated" : "Activate account"}</button>
        </form>
        <Link className="login-link" href="/login">Return to sign in</Link>
      </section>
      <style jsx>{`
        .activation-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f1f5f6; color: #172033; }
        .activation-panel { width: min(100%, 460px); padding: 30px; background: #fff; border: 1px solid #dce3eb; border-radius: 8px; box-shadow: 0 12px 35px rgba(15, 23, 42, .08); }
        .brand { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 32px; color: #172033; font-weight: 750; text-decoration: none; }
        .brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 7px; background: #0f766e; color: #fff; }
        .eyebrow { color: #0f766e; font-size: .75rem; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
        h1 { margin: 7px 0 8px; font-size: 1.8rem; }
        .intro { margin: 0 0 20px; color: #64748b; line-height: 1.55; }
        form { display: grid; gap: 9px; }
        label { margin-top: 8px; color: #334155; font-size: .88rem; font-weight: 650; }
        input { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 5px; color: #172033; font: inherit; }
        button { min-height: 44px; margin-top: 8px; border: 0; border-radius: 5px; background: #0f766e; color: #fff; font-weight: 700; cursor: pointer; }
        button:disabled { cursor: not-allowed; opacity: .65; }
        .message { margin: 4px 0; font-size: .9rem; }
        .error { color: #b91c1c; }
        .success { color: #087f5b; }
        .login-link { display: inline-block; margin-top: 20px; color: #0f766e; font-weight: 650; text-decoration: none; }
        @media (max-width: 480px) { .activation-panel { padding: 22px; } }
      `}</style>
    </main>
  );
}
