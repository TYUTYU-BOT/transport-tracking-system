import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import DriverSignupWizard from "../components/DriverSignupWizard";

function isStrongPassword(value) {
  return value.length >= 12 && value.length <= 200 &&
    /[a-z]/.test(value) && /[A-Z]/.test(value) &&
    /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export default function Signup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("passenger");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setError("Please enter a username.");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Use 12-200 characters with an uppercase letter, a lowercase letter, a number, and a special character.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedUsername,
          password,
          role,
          fullName,
          phoneNumber,
          licenseNumber,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || "User already exists");
        return;
      }

      if (role === "driver") {
        setSuccess("Application submitted. The Admin will review your details. If approved, an activation code will be sent to your phone by SMS.");
      } else {
        alert("Account created successfully!");
        router.push("/login");
      }
    } catch (err) {
      setError("Could not create the account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (role === "driver") {
    return <DriverSignupWizard onBack={() => setRole("passenger")} />;
  }

  return (
    <main className="passenger-signup-page">
      <section className="passenger-signup">
        <Link href="/" className="signup-brand" aria-label="Transport home">
          <span className="signup-brand-mark" aria-hidden="true">T</span>
          <span>transport</span>
        </Link>

        <header className="signup-heading">
          <p className="signup-eyebrow">Passenger / Student</p>
          <h1>Create your account</h1>
          <p>Sign up to follow routes and stay up to date with your transport.</p>
        </header>

        <form onSubmit={handleSignup} className="passenger-signup-form">
          <div className="signup-field">
            <label htmlFor="account-role">Account type</label>
            <div className="account-type-wrap">
              <select
                id="account-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="signup-input account-type"
              >
                <option value="passenger">Passenger / Student</option>
                <option value="driver">Driver</option>
              </select>
              <span className="select-chevron" aria-hidden="true">›</span>
            </div>
          </div>

          <div className="signup-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              className="signup-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Choose a username"
              autoComplete="username"
              minLength={3}
              maxLength={80}
              required
            />
          </div>

          <div className="signup-field">
            <label htmlFor="password">Password</label>
            <div className="signup-password-wrap">
              <input
                id="password"
                className="signup-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Create a strong password"
                autoComplete="new-password"
                minLength={12}
                maxLength={200}
                aria-describedby={password && !isStrongPassword(password) ? "password-hint" : undefined}
                required
              />
              <button
                type="button"
                className="signup-password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {password && !isStrongPassword(password) && (
              <p id="password-hint" role="status" className="password-hint">
                Use 12-200 characters and include uppercase and lowercase letters, a number, and a special character.
              </p>
            )}
          </div>

          {error && <div className="signup-error" role="alert">{error}</div>}
          {success && <div className="signup-success" role="status">{success}</div>}

          <button type="submit" className="signup-submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="signup-login-link">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>

      <style jsx>{`
        .passenger-signup-page {
          min-height: 100vh;
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: 36px 24px;
          background: #20232b;
          color: #f5f6f8;
          font-family: Arial, Helvetica, sans-serif;
        }
        .passenger-signup {
          width: min(100%, 460px);
        }
        .signup-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 54px;
          color: #f5f6f8;
          font-size: 1.4rem;
          font-weight: 750;
          letter-spacing: -.04em;
        }
        .signup-brand-mark {
          display: grid;
          width: 38px;
          height: 38px;
          place-items: center;
          border-radius: 12px;
          background: #ffca05;
          color: #17191f;
          font-size: 1.3rem;
          font-weight: 800;
          letter-spacing: 0;
        }
        .signup-heading {
          margin-bottom: 34px;
          text-align: center;
        }
        .signup-eyebrow {
          margin-bottom: 10px;
          color: #ffca05;
          font-size: .76rem;
          font-weight: 750;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .signup-heading h1 {
          margin: 0;
          font-size: clamp(1.65rem, 5vw, 2rem);
          line-height: 1.2;
          font-weight: 750;
        }
        .signup-heading > p:last-child {
          max-width: 360px;
          margin: 12px auto 0;
          color: #b5b8c0;
          font-size: .98rem;
          line-height: 1.55;
        }
        .passenger-signup-form {
          display: grid;
          gap: 22px;
        }
        .signup-field {
          display: grid;
          gap: 9px;
        }
        .signup-field label {
          color: #c5c7ce;
          font-size: .92rem;
          font-weight: 600;
        }
        .signup-input {
          width: 100%;
          min-height: 58px;
          border: 1px solid #353943;
          border-radius: 15px;
          padding: 0 17px;
          outline: none;
          background: #20232b;
          color: #f5f6f8;
          font: inherit;
          font-size: 1rem;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .signup-input::placeholder {
          color: #777c87;
        }
        .signup-input:focus {
          border-color: #ffca05;
          box-shadow: 0 0 0 3px rgb(255 202 5 / 13%);
        }
        .account-type-wrap,
        .signup-password-wrap {
          position: relative;
        }
        .account-type {
          appearance: none;
          padding-right: 50px;
          cursor: pointer;
        }
        .account-type option {
          background: #20232b;
          color: #f5f6f8;
        }
        .select-chevron {
          position: absolute;
          top: 50%;
          right: 19px;
          color: #aeb2bb;
          font-size: 2rem;
          line-height: 1;
          transform: translateY(-55%);
          pointer-events: none;
        }
        .signup-password-wrap .signup-input {
          padding-right: 75px;
        }
        .signup-password-toggle {
          position: absolute;
          top: 50%;
          right: 13px;
          transform: translateY(-50%);
          border: 0;
          padding: 8px 4px;
          background: transparent;
          color: #ffca05;
          font: inherit;
          font-size: .86rem;
          font-weight: 700;
          cursor: pointer;
        }
        .password-hint {
          margin: 0;
          color: #ffb4ab;
          font-size: .82rem;
          line-height: 1.5;
        }
        .signup-error,
        .signup-success {
          border-radius: 12px;
          padding: 12px 14px;
          font-size: .9rem;
          line-height: 1.5;
        }
        .signup-error {
          border: 1px solid rgb(255 125 112 / 30%);
          background: rgb(255 125 112 / 9%);
          color: #ffb4ab;
        }
        .signup-success {
          border: 1px solid rgb(86 214 182 / 30%);
          background: rgb(86 214 182 / 9%);
          color: #9cebd5;
        }
        .signup-submit {
          width: 100%;
          min-height: 62px;
          margin-top: 4px;
          border: 0;
          border-radius: 999px;
          background: #ffca05;
          color: #15171c;
          font: inherit;
          font-size: 1.1rem;
          font-weight: 750;
          cursor: pointer;
          transition: background .15s ease, transform .15s ease;
        }
        .signup-submit:hover:not(:disabled) {
          background: #ffda42;
          transform: translateY(-1px);
        }
        .signup-submit:disabled {
          cursor: wait;
          opacity: .7;
        }
        .signup-login-link {
          margin: 26px 0 0;
          color: #b5b8c0;
          text-align: center;
          font-size: .92rem;
        }
        .signup-login-link a {
          color: #ffca05;
          font-weight: 700;
        }
        @media (max-width: 520px) {
          .passenger-signup-page {
            align-items: start;
            padding: max(36px, env(safe-area-inset-top)) 20px max(28px, env(safe-area-inset-bottom));
          }
          .signup-brand {
            margin-bottom: 42px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .signup-input,
          .signup-submit {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}