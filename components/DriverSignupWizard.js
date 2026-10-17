import { useState } from "react";
import Link from "next/link";

const steps = ["Contact", "Services", "Personal", "Vehicle", "Account"];
const inputClass = "field-input";
const defaultVehicle = { category: "Minibus", make: "", model: "", year: String(new Date().getFullYear() - 5), color: "", licensePlate: "" };

function isValidPhoneNumber(value) {
  const compact = value.replace(/[\s()-]/g, "");
  return /^0\d{9}$/.test(compact) || /^\+?[1-9]\d{7,14}$/.test(compact);
}

function isStrongPassword(value) {
  return value.length >= 12 && value.length <= 200 &&
    /[a-z]/.test(value) && /[A-Z]/.test(value) &&
    /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export default function DriverSignupWizard({ onBack }) {
  const [step, setStep] = useState(1);
  const [region, setRegion] = useState("Mbombela");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [serviceTypes, setServiceTypes] = useState(["passengers"]);
  const [vehicleOwnership, setVehicleOwnership] = useState("own");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [vehicles, setVehicles] = useState([{ ...defaultVehicle }]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateVehicle = (index, key, value) => {
    setVehicles((current) => current.map((vehicle, vehicleIndex) =>
      vehicleIndex === index ? { ...vehicle, [key]: value } : vehicle
    ));
  };

  const toggleService = (service) => {
    setServiceTypes((current) => current.includes(service)
      ? current.filter((item) => item !== service)
      : [...current, service]
    );
  };

  const validateStep = () => {
    if (step === 1 && !region) {
      return "Choose your operating area.";
    }
    if (step === 1 && !isValidPhoneNumber(phoneNumber)) {
      return "Enter a valid phone number, such as 082 123 4567 or +27 82 123 4567.";
    }
    if (step === 2 && serviceTypes.length === 0) return "Choose at least one service type.";
    if (step === 3) {
      if (!email.trim()) return "Enter your email address.";
      if (email.trim().length > 160 || !/^[^\s@.]+(?:\.[^\s@.]+)*@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email.trim())) {
        return "Enter a valid email address, such as name@example.com.";
      }
      if (!firstName.trim() || !lastName.trim() || !gender || !birthDate || licenseNumber.trim().length < 4) {
        return "Complete each personal information field to continue.";
      }
      const birth = new Date(`${birthDate}T00:00:00`);
      const adultDate = new Date(birth.getFullYear() + 18, birth.getMonth(), birth.getDate());
      if (Number.isNaN(birth.getTime()) || adultDate > new Date()) return "Drivers must be at least 18 years old.";
    }
    if (step === 4 && vehicleOwnership === "own" && vehicles.some((vehicle) =>
      !vehicle.category || !vehicle.make.trim() || !vehicle.year || !vehicle.color.trim() || vehicle.licensePlate.trim().length < 4
    )) {
      return "Complete the vehicle details, including its license plate.";
    }
    if (step === 5 && (username.trim().length < 3 || username.trim().length > 80)) {
      return "Choose a username between 3 and 80 characters.";
    }
    if (step === 5 && !isStrongPassword(password)) {
      return "Use 12-200 characters with an uppercase letter, a lowercase letter, a number, and a special character.";
    }
    return "";
  };

  const continueStep = () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, steps.length));
  };

  const submitApplication = async (event) => {
    event.preventDefault();
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "driver",
          username: username.trim(),
          password,
          region,
          phoneNumber,
          serviceTypes,
          vehicleOwnership,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender,
          birthDate,
          email: email.trim(),
          licenseNumber: licenseNumber.trim(),
          vehicles: vehicleOwnership === "own" ? vehicles.map((vehicle) => ({ ...vehicle, year: Number(vehicle.year) })) : [],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not submit your application");
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="driver-signup-page">
        <section className="wizard-card confirmation">
          <Link className="brand" href="/"><span className="brand-mark">T</span>Transport</Link>
          <div className="success-mark" aria-hidden="true">✓</div>
          <div className="eyebrow">Application received</div>
          <h1>Thanks, {firstName}.</h1>
          <p>Your Driver application is pending Admin review. If approved, we’ll send a one-time activation code to <strong>{phoneNumber}</strong>.</p>
          <Link className="primary-action" href="/activate-driver">Activate with SMS code</Link>
          <Link className="text-link" href="/login">Return to sign in</Link>
        </section>
        <WizardStyles />
      </main>
    );
  }

  return (
    <main className="driver-signup-page">
      <section className="wizard-card">
        <div className="wizard-topline">
          <button type="button" className="back-link" onClick={onBack}>‹ <span>Account types</span></button>
          <span className="wizard-label">Driver application</span>
        </div>

        <div className="stepper" aria-label={`Step ${step} of ${steps.length}`}>
          {steps.map((label, index) => {
            const number = index + 1;
            return (
              <div className={`step ${number <= step ? "reached" : ""} ${number === step ? "current" : ""}`} key={label}>
                <span className="step-number">{number < step ? "✓" : number}</span>
                <span className="step-label">{label}</span>
              </div>
            );
          })}
        </div>

        <form onSubmit={step === steps.length ? submitApplication : (event) => { event.preventDefault(); continueStep(); }}>
          {step === 1 && (
            <section className="step-content">
              <div className="eyebrow">Step 1 of 5</div>
              <h1>Where will you drive?</h1>
              <p className="step-intro">Choose your service area and add the phone number where we can reach you.</p>
              <label htmlFor="driver-region">Operating area</label>
              <select id="driver-region" className={inputClass} value={region} onChange={(event) => setRegion(event.target.value)}>
                <option>Mbombela</option><option>White River</option><option>Nelspruit</option><option>Ermelo</option><option>Pretoria</option><option>Other</option>
              </select>
              <label htmlFor="driver-phone">Mobile phone</label>
              <input id="driver-phone" className={inputClass} type="tel" autoComplete="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+27 82 123 4567" required aria-describedby="driver-phone-hint" />
              <p id="driver-phone-hint" className="field-hint">Use a South African number like 082 123 4567 or an international number like +27 82 123 4567. We’ll send the activation code here after approval.</p>
            </section>
          )}

          {step === 2 && (
            <section className="step-content">
              <div className="eyebrow">Step 2 of 5</div>
              <h1>What will you transport?</h1>
              <p className="step-intro">Choose all services you can provide.</p>
              <div className="choice-list">
                {[
                  ["passengers", "Passengers", "Taxi, shuttle, or bus trips"],
                  ["freight", "Passengers and freight", "Mixed transport services"],
                  ["delivery", "Delivery of goods", "Point-to-point delivery"],
                  ["door-to-door", "Door-to-door service", "Pickup and drop-off service"],
                ].map(([value, title, description]) => (
                  <label className={`choice-row ${serviceTypes.includes(value) ? "selected" : ""}`} key={value}>
                    <input type="checkbox" checked={serviceTypes.includes(value)} onChange={() => toggleService(value)} />
                    <span><strong>{title}</strong><small>{description}</small></span>
                  </label>
                ))}
              </div>
              <div className="field-label">Vehicle arrangement</div>
              <div className="ownership-options">
                <button type="button" className={`ownership-choice ${vehicleOwnership === "own" ? "selected" : ""}`} onClick={() => setVehicleOwnership("own")}>
                  <strong>Own vehicle</strong><small>Submit vehicle details for review</small>
                </button>
                <button type="button" className={`ownership-choice ${vehicleOwnership === "fleet" ? "selected" : ""}`} onClick={() => setVehicleOwnership("fleet")}>
                  <strong>Company vehicle</strong><small>Admin assigns fleet vehicles</small>
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="step-content">
              <div className="eyebrow">Step 3 of 5</div>
              <h1>Personal information</h1>
              <p className="step-intro">Enter your details as they appear on your identification and driver license.</p>
              <div className="field-grid">
                <div><label htmlFor="first-name">First name</label><input id="first-name" className={inputClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required /></div>
                <div><label htmlFor="last-name">Last name</label><input id="last-name" className={inputClass} value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" required /></div>
              </div>
              <label htmlFor="driver-gender">Gender</label>
              <select id="driver-gender" className={inputClass} value={gender} onChange={(event) => setGender(event.target.value)} required>
                <option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer-not-to-say">Prefer not to say</option>
              </select>
              <label htmlFor="birth-date">Date of birth</label>
              <input id="birth-date" className={inputClass} type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required />
              <label htmlFor="driver-email">Email</label>
              <input id="driver-email" className={inputClass} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={160} required />
              <label htmlFor="license-number">Driver license number</label>
              <input id="license-number" className={inputClass} value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} autoComplete="off" minLength={4} maxLength={64} required />
            </section>
          )}

          {step === 4 && (
            <section className="step-content">
              <div className="eyebrow">Step 4 of 5</div>
              <h1>{vehicleOwnership === "own" ? "Vehicle data" : "Fleet vehicle"}</h1>
              {vehicleOwnership === "fleet" ? (
                <p className="step-intro">No vehicle details needed here. After approval, the Admin can assign one or more company vehicles to your account.</p>
              ) : (
                <>
                  <p className="step-intro">Add each vehicle you own. An Admin will verify the details before it can be used for trips.</p>
                  <div className="vehicle-form-list">
                    {vehicles.map((vehicle, index) => (
                      <fieldset className="vehicle-form-card" key={index}>
                        <legend>Vehicle {index + 1}</legend>
                        {vehicles.length > 1 && <button type="button" className="remove-vehicle" onClick={() => setVehicles((current) => current.filter((_, vehicleIndex) => vehicleIndex !== index))}>Remove</button>}
                        <label htmlFor={`vehicle-category-${index}`}>Category</label>
                        <select id={`vehicle-category-${index}`} className={inputClass} value={vehicle.category} onChange={(event) => updateVehicle(index, "category", event.target.value)}>
                          <option>Taxi</option><option>Minibus</option><option>Bus</option><option>Shuttle</option><option>Light delivery</option><option>Truck</option>
                        </select>
                        <div className="field-grid">
                          <div><label htmlFor={`vehicle-make-${index}`}>Make</label><input id={`vehicle-make-${index}`} className={inputClass} value={vehicle.make} onChange={(event) => updateVehicle(index, "make", event.target.value)} placeholder="Toyota" required /></div>
                          <div><label htmlFor={`vehicle-model-${index}`}>Model</label><input id={`vehicle-model-${index}`} className={inputClass} value={vehicle.model} onChange={(event) => updateVehicle(index, "model", event.target.value)} placeholder="Quantum" /></div>
                        </div>
                        <div className="field-grid">
                          <div><label htmlFor={`vehicle-year-${index}`}>Year</label><select id={`vehicle-year-${index}`} className={inputClass} value={vehicle.year} onChange={(event) => updateVehicle(index, "year", event.target.value)}>{Array.from({ length: new Date().getFullYear() - 1979 }, (_, offset) => String(new Date().getFullYear() - offset)).map((year) => <option key={year}>{year}</option>)}</select></div>
                          <div><label htmlFor={`vehicle-color-${index}`}>Color</label><input id={`vehicle-color-${index}`} className={inputClass} value={vehicle.color} onChange={(event) => updateVehicle(index, "color", event.target.value)} required /></div>
                        </div>
                        <label htmlFor={`vehicle-plate-${index}`}>License plate number</label>
                        <input id={`vehicle-plate-${index}`} className={inputClass} value={vehicle.licensePlate} onChange={(event) => updateVehicle(index, "licensePlate", event.target.value.toUpperCase())} autoComplete="off" placeholder="e.g. AAA 123 MP" minLength={4} maxLength={20} required />
                      </fieldset>
                    ))}
                  </div>
                  {vehicles.length < 5 && <button type="button" className="add-vehicle" onClick={() => setVehicles((current) => [...current, { ...defaultVehicle }])}>+ Add another vehicle</button>}
                </>
              )}
            </section>
          )}

          {step === 5 && (
            <section className="step-content">
              <div className="eyebrow">Step 5 of 5</div>
              <h1>Create your login</h1>
              <p className="step-intro">After you submit, the Admin reviews your application. Approved drivers receive an activation code by SMS.</p>
              <label htmlFor="driver-username">Username</label>
              <input id="driver-username" className={inputClass} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={80} required />
              <label htmlFor="driver-password">Password</label>
              <div className="password-input-wrap">
                <input id="driver-password" className={inputClass} type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={200} required aria-describedby={password && !isStrongPassword(password) ? "driver-password-hint" : undefined} />
                <button type="button" className="password-visibility" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button>
              </div>
              {password && !isStrongPassword(password) && <p id="driver-password-hint" className="field-hint" role="status">Use 12-200 characters and include uppercase and lowercase letters, a number, and a special character.</p>}
              <div className="review-summary">
                <strong>Application summary</strong>
                <span>{firstName} {lastName} · {region}</span>
                <span>{vehicleOwnership === "own" ? `${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} submitted` : "Company vehicle requested"}</span>
              </div>
            </section>
          )}

          {error && <p className="error-message" role="alert">{error}</p>}
          <div className="wizard-actions">
            {step > 1 && <button type="button" className="secondary-action" onClick={() => { setError(""); setStep((current) => current - 1); }}>Back</button>}
            {step < steps.length ? (
              <button type="button" className="primary-action" onClick={continueStep}>Next</button>
            ) : (
              <button type="submit" className="primary-action" disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit application"}</button>
            )}
          </div>
        </form>
        <p className="existing-account">Already have an account? <Link href="/login">Sign in</Link></p>
      </section>
      <WizardStyles />
    </main>
  );
}

function WizardStyles() {
  return <style jsx global>{`
    .driver-signup-page { min-height: 100vh; padding: 24px 16px; display: grid; place-items: center; background: #11191f; color: #f1f5f9; }
    .wizard-card { width: min(100%, 560px); padding: 24px; border: 1px solid #293640; border-radius: 10px; background: #182127; box-shadow: 0 18px 48px rgba(0,0,0,.24); }
    .wizard-topline { display: flex; justify-content: space-between; align-items: center; margin-bottom: 23px; }
    .back-link { border: 0; padding: 0; background: transparent; color: #22a7b5; font: inherit; font-weight: 700; cursor: pointer; }
    .wizard-label { color: #aab7c1; font-size: .82rem; }
    .stepper { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin-bottom: 30px; }
    .step { position: relative; display: grid; justify-items: center; gap: 6px; color: #64717b; }
    .step:not(:last-child)::after { position: absolute; content: ""; height: 2px; top: 15px; left: calc(50% + 17px); right: calc(-50% + 17px); background: #34434d; }
    .step.reached:not(:last-child)::after { background: #1593a1; }
    .step-number { z-index: 1; width: 32px; height: 32px; display: grid; place-items: center; border: 1px solid #34434d; border-radius: 50%; background: #202c34; color: #9aa7b0; font-size: .82rem; font-weight: 750; }
    .step.reached .step-number { border-color: #158b99; background: #168b99; color: #fff; }
    .step.current .step-number { box-shadow: 0 0 0 4px rgba(22,139,153,.16); }
    .step-label { font-size: .65rem; }
    .step-content { min-height: 380px; }
    .eyebrow { color: #22a7b5; font-size: .74rem; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
    .step-content h1, .confirmation h1 { margin: 7px 0 8px; font-size: 1.7rem; line-height: 1.2; }
    .step-intro, .confirmation > p { margin: 0 0 22px; color: #aab7c1; font-size: .92rem; line-height: 1.55; }
    .step-content label { display: block; margin: 15px 0 7px; color: #d9e1e7; font-size: .84rem; font-weight: 650; }
    .field-input { width: 100%; min-height: 52px; padding: 12px 14px; border: 1px solid #394954; border-radius: 7px; background: #151e24; color: #f1f5f9; font: inherit; }
    .field-input:focus { outline: 2px solid #188f9d; outline-offset: 1px; }
    .password-input-wrap { position: relative; }
    .password-input-wrap .field-input { padding-right: 68px; }
    .password-visibility { position: absolute; top: 50%; right: 12px; transform: translateY(-50%); border: 0; padding: 6px; background: transparent; color: #22a7b5; font: inherit; font-weight: 700; cursor: pointer; }
    .field-hint { margin: 8px 0; color: #8796a1; font-size: .78rem; }
    .choice-list { display: grid; gap: 9px; }
    .choice-row { display: flex !important; align-items: center; gap: 12px; margin: 0 !important; padding: 12px; border: 1px solid #34434d; border-radius: 7px; background: #151e24; cursor: pointer; }
    .choice-row.selected, .ownership-choice.selected { border-color: #168b99; background: rgba(22,139,153,.12); }
    .choice-row input { width: 18px; height: 18px; accent-color: #168b99; }
    .choice-row span { display: grid; gap: 4px; }
    .choice-row strong, .ownership-choice strong { color: #eef3f6; font-size: .9rem; }
    .choice-row small, .ownership-choice small { color: #9ba9b3; font-size: .78rem; }
    .field-label { margin: 22px 0 9px; color: #d9e1e7; font-size: .84rem; font-weight: 650; }
    .ownership-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .ownership-choice { display: grid; gap: 7px; min-height: 78px; padding: 12px; border: 1px solid #394954; border-radius: 7px; background: #151e24; text-align: left; cursor: pointer; }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .vehicle-form-list { display: grid; gap: 12px; }
    .vehicle-form-card { position: relative; min-width: 0; margin: 0; padding: 13px; border: 1px solid #34434d; border-radius: 7px; }
    .vehicle-form-card legend { padding: 0 6px; color: #22a7b5; font-size: .82rem; font-weight: 700; }
    .remove-vehicle { position: absolute; top: 7px; right: 10px; border: 0; background: transparent; color: #fca5a5; font: inherit; font-size: .75rem; cursor: pointer; }
    .add-vehicle { width: 100%; min-height: 42px; margin-top: 12px; border: 1px dashed #168b99; border-radius: 7px; background: transparent; color: #57c4cf; font: inherit; font-weight: 650; cursor: pointer; }
    .review-summary { display: grid; gap: 8px; margin-top: 22px; padding: 14px; border: 1px solid #34434d; border-radius: 7px; color: #aab7c1; font-size: .84rem; }
    .review-summary strong { color: #edf2f5; }
    .error-message { padding: 10px 12px; border: 1px solid #7f3439; border-radius: 6px; background: rgba(127,52,57,.18); color: #fecaca; font-size: .85rem; }
    .wizard-actions { display: flex; gap: 10px; margin-top: 22px; }
    .primary-action, .secondary-action { min-height: 50px; display: inline-flex; flex: 1; align-items: center; justify-content: center; border: 1px solid #168b99; border-radius: 999px; padding: 0 18px; background: #168b99; color: white; font: inherit; font-weight: 750; text-align: center; text-decoration: none; cursor: pointer; }
    .secondary-action { background: transparent; color: #38b5c0; }
    .primary-action:disabled { opacity: .65; cursor: wait; }
    .existing-account { margin: 18px 0 0; color: #9ba9b3; text-align: center; font-size: .85rem; }
    .existing-account a, .text-link { color: #43bbc5; font-weight: 700; text-decoration: none; }
    .brand { display: inline-flex; align-items: center; gap: 9px; margin-bottom: 25px; color: #f1f5f9; font-weight: 750; text-decoration: none; }
    .brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 7px; background: #168b99; color: #fff; }
    .confirmation { text-align: center; }
    .success-mark { width: 56px; height: 56px; display: grid; place-items: center; margin: 0 auto 18px; border-radius: 50%; background: #16784d; color: #fff; font-size: 1.7rem; }
    .confirmation .primary-action { width: 100%; margin-top: 10px; }
    .confirmation .text-link { display: block; margin-top: 16px; }
    @media (max-width: 420px) { .wizard-card { padding: 18px; } .step-label { font-size: .59rem; } .step-content { min-height: 340px; } .field-grid { grid-template-columns: 1fr; gap: 0; } }
  `}</style>;
}
