import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

const roleRoutes = {
  admin: "/dashboard",
  driver: "/dashboard/driver",
  passenger: "/dashboard/passenger",
};

export default function ActorDashboard({ role }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [incident, setIncident] = useState("");
  const [profileName, setProfileName] = useState("");
  const [location, setLocation] = useState("Waiting for vehicle location");
  const [darkMode, setDarkMode] = useState(false);
  const [driverData, setDriverData] = useState(null);
  const [passengerData, setPassengerData] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  useEffect(() => {
    setDarkMode(localStorage.getItem("transport-theme") === "dark");
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active) return;
        if (!data?.user) {
          localStorage.removeItem("user");
          router.replace("/login");
          return;
        }
        const savedRole = data.user.role === "user" ? "passenger" : data.user.role;
        if (savedRole !== role) {
          router.replace(roleRoutes[savedRole] || "/login");
          return;
        }
        setUser(data.user);
        setProfileName(data.user.username || "");
      })
      .catch(() => {
        if (active) router.replace("/login");
      });
    return () => { active = false; };
  }, [role, router]);

  useEffect(() => {
    if (!user) return;

    let active = true;
    const endpoint = role === "driver" ? "/api/driver/operations" : "/api/passenger/overview";
    const updateDashboardData = async () => {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error("Could not load account data");
        const data = await response.json();
        if (!active) return;

        if (role === "driver") {
          setDriverData(data);
          setSelectedVehicleId((currentId) => data.vehicles.some((vehicle) => vehicle.id === currentId) ? currentId : data.vehicles[0]?.id || "");
        } else {
          setPassengerData(data);
          const vehicle = data.vehicles.find((item) => item.id === "TR-214") || data.vehicles[0];
          if (vehicle?.latitude != null && vehicle?.longitude != null) {
            setLocation(`${vehicle.latitude}, ${vehicle.longitude}`);
          } else {
            setLocation("Waiting for a vehicle GPS update");
          }
        }
      } catch {
        if (active && role === "driver") setFeedback("Could not load your assigned vehicle data.");
      }
    };

    updateDashboardData();
    const intervalId = setInterval(updateDashboardData, 10000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [role, user]);

  const refreshDriverData = async () => {
    const response = await fetch("/api/driver/operations");
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Could not refresh driver data");
    setDriverData(data);
    setSelectedVehicleId((currentId) => data.vehicles.some((vehicle) => vehicle.id === currentId) ? currentId : data.vehicles[0]?.id || "");
  };

  const submitDriverAction = async (payload) => {
    const response = await fetch("/api/driver/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, vehicleId: selectedVehicleId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Unable to save this action");
    await refreshDriverData();
    return data;
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("user");
    router.replace("/login");
  };

  const sendLocation = () => {
    if (!navigator.geolocation) {
      setFeedback("Location services are not available on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        await submitDriverAction({
          action: "sendLocation",
          latitude: coords.latitude,
          longitude: coords.longitude,
          speed: coords.speed || 0,
        });
        setFeedback("Vehicle location sent to dispatch.");
      } catch (error) {
        setFeedback(error.message);
      }
    }, () => setFeedback("Location permission is required to send GPS data."));
  };

  const handleTripToggle = async () => {
    try {
      await submitDriverAction({ action: tripActive ? "endTrip" : "startTrip" });
      setFeedback(tripActive ? "Trip ended and saved." : "Trip started and saved.");
    } catch (error) {
      setFeedback(error.message);
    }
  };

  const handleVehicleStatus = async (status) => {
    try {
      await submitDriverAction({ action: "updateStatus", status });
      setFeedback("Vehicle status saved.");
    } catch (error) {
      setFeedback(error.message);
    }
  };

  const handleIncidentSubmit = async (event) => {
    event.preventDefault();
    if (!incident.trim()) return;
    try {
      await submitDriverAction({ action: "reportIncident", message: incident.trim() });
      setIncident("");
      setFeedback("Incident reported to dispatch.");
    } catch (error) {
      setFeedback(error.message);
    }
  };

  const isDriver = role === "driver";
  const trackedVehicle = passengerData?.vehicles.find((item) => item.id === "TR-214") || passengerData?.vehicles[0];
  const selectedVehicle = driverData?.vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
  const vehicleStatus = selectedVehicle?.status || "Unassigned";
  const tripActive = Boolean(driverData?.activeTrips?.some((trip) => trip.vehicleId === selectedVehicleId));
  const title = isDriver ? "Driver workspace" : "Passenger dashboard";
  const subtitle = isDriver
    ? "Your assigned work and trip controls"
    : "Your journey information, updated in one place";

  if (!user) {
    return <div className="loading-screen">Loading dashboard...</div>;
  }

  return (
    <div className={`actor-dashboard ${darkMode ? "dark-mode" : ""}`}>
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">T</span>
          <span>Transport</span>
        </Link>
        <div className="account-actions">
          <span className="account-name">{user.username}</span>
          <button
            type="button"
            className="theme-button"
            onClick={() => {
              const nextDarkMode = !darkMode;
              setDarkMode(nextDarkMode);
              localStorage.setItem("transport-theme", nextDarkMode ? "dark" : "light");
            }}
            aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}
            title={`Switch to ${darkMode ? "light" : "dark"} mode`}
          >
            <span aria-hidden="true">{darkMode ? "☀" : "☾"}</span>
            {darkMode ? "Light mode" : "Dark mode"}
          </button>
          <button type="button" className="logout-button" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">{isDriver ? "Driver operations" : "Passenger services"}</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="role-badge">{isDriver ? "DRIVER" : "PASSENGER"}</span>
        </div>

        {isDriver ? (
          <>
            <section className="metric-grid" aria-label="Trip summary">
              <article className="metric-card">
                <span>Assigned vehicles</span><strong>{driverData?.vehicles?.length || 0}</strong>
              </article>
              <article className="metric-card">
                <span>Vehicle status</span><strong>{vehicleStatus}</strong>
              </article>
              <article className="metric-card">
                <span>Trip state</span><strong>{tripActive ? "In progress" : "Not started"}</strong>
              </article>
            </section>

            <section className="main-grid">
              <article className="surface route-card">
                <div className="section-heading"><div><span className="eyebrow">Today&apos;s assignment</span><h2>{selectedVehicle ? (selectedVehicle.origin ? `${selectedVehicle.origin} Route` : selectedVehicle.label || selectedVehicle.id) : "No vehicle assigned"}</h2></div><span className="status-pill">{selectedVehicle?.route_status || "Unassigned"}</span></div>
                {driverData?.vehicles?.length > 0 && (
                  <>
                    <label className="field-label" htmlFor="assigned-vehicle">Vehicle for this trip</label>
                    <select id="assigned-vehicle" value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)}>
                      {driverData.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.id} · {vehicle.label}</option>)}
                    </select>
                  </>
                )}
                <div className="route-line">
                  <div className="stop"><span className="stop-dot start" /><div><strong>{selectedVehicle?.origin || "Route origin"}</strong><small>Departure · {selectedVehicle?.departure || "--:--"}</small></div></div>
                  <div className="route-connector" />
                  <div className="stop"><span className="stop-dot end" /><div><strong>{selectedVehicle?.destination || "Route destination"}</strong><small>Estimated arrival · {selectedVehicle?.arrival || "--:--"}</small></div></div>
                </div>
                <div className="button-row">
                  <button type="button" className="primary-button" onClick={handleTripToggle} disabled={!selectedVehicle}>
                    {tripActive ? "End trip" : "Start trip"}
                  </button>
                  <button type="button" className="secondary-button" onClick={sendLocation} disabled={!selectedVehicle}>Send GPS location</button>
                </div>
                {driverData?.incidents?.length > 0 && <p className="muted-copy">Latest incident: {driverData.incidents[0].message}</p>}
                <p className="feedback" role="status">{feedback}</p>
              </article>

              <article className="surface controls-card">
                <span className="eyebrow">Vehicle controls</span>
                <h2>Update status</h2>
                <label className="field-label" htmlFor="vehicle-status">Current vehicle status</label>
                <select id="vehicle-status" value={vehicleStatus} onChange={(event) => handleVehicleStatus(event.target.value)} disabled={!selectedVehicle}>
                  <option>Ready</option><option>In transit</option><option>Rest break</option><option>Maintenance</option>
                </select>
                <form onSubmit={handleIncidentSubmit}>
                  <label className="field-label" htmlFor="incident-report">Report an incident</label>
                  <textarea id="incident-report" value={incident} onChange={(event) => setIncident(event.target.value)} placeholder="Describe an issue on your route" rows="3" />
                  <button type="submit" className="secondary-button" disabled={!selectedVehicle}>Submit report</button>
                </form>
              </article>
            </section>

            <section className="surface notice-card">
              <span className="notice-dot" />
              <div><strong>Dispatch notification</strong><p>{driverData?.notifications?.[0]?.message || "No new dispatch notifications."}</p></div>
            </section>
          </>
        ) : (
          <>
            <section className="metric-grid" aria-label="Journey summary">
              <article className="metric-card"><span>Tracked vehicle</span><strong>{trackedVehicle?.id || "No vehicle"}</strong></article>
              <article className="metric-card"><span>Next arrival</span><strong>{trackedVehicle?.arrival || "Not scheduled"}</strong></article>
              <article className="metric-card"><span>Service status</span><strong>{trackedVehicle?.routeStatus || trackedVehicle?.status || "Unavailable"}</strong></article>
            </section>

            <section className="main-grid passenger-grid">
              <article className="surface location-card">
                <span className="eyebrow">Live vehicle location</span>
                <h2>{trackedVehicle ? `${trackedVehicle.origin} to ${trackedVehicle.destination}` : "Route unavailable"}</h2>
                <div className="location-display"><span className="live-dot" /><span>{location}</span></div>
                <div className="route-line compact-route">
                  <div className="stop"><span className="stop-dot start" /><div><strong>{trackedVehicle?.origin || "Origin"}</strong><small>Departure · {trackedVehicle?.departure || "--:--"}</small></div></div>
                  <div className="route-connector" />
                  <div className="stop"><span className="stop-dot end" /><div><strong>{trackedVehicle?.destination || "Destination"}</strong><small>Estimated arrival · {trackedVehicle?.arrival || "--:--"}</small></div></div>
                </div>
                <p className="muted-copy">Location refreshes automatically when GPS updates are available.</p>
              </article>

              <article className="surface schedule-card">
                <span className="eyebrow">Transport schedule</span>
                <h2>Today&apos;s journey</h2>
                <div className="schedule-row"><span>{trackedVehicle?.origin || "Origin"}</span><strong>{trackedVehicle?.departure || "--:--"}</strong></div>
                <div className="schedule-row"><span>{trackedVehicle?.destination || "Destination"}</span><strong>{trackedVehicle?.arrival || "--:--"}</strong></div>
                <div className="notification-box"><strong>Service update</strong><p>{passengerData?.notifications?.[0]?.message || trackedVehicle?.routeStatus || "No current service notifications."}</p></div>
              </article>
            </section>

            <section className="surface profile-card">
              <div><span className="eyebrow">Account</span><h2>Profile details</h2></div>
              <form onSubmit={(event) => { event.preventDefault(); const updatedUser = { ...user, username: profileName.trim() || user.username }; localStorage.setItem("user", JSON.stringify(updatedUser)); setUser(updatedUser); setFeedback("Profile updated locally."); }}>
                <label className="field-label" htmlFor="profile-name">Username</label>
                <input id="profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} />
                <button type="submit" className="secondary-button">Save profile</button>
              </form>
              <p className="feedback" role="status">{feedback}</p>
            </section>
          </>
        )}
      </main>

      <style jsx>{`
        .actor-dashboard { min-height: 100vh; background: #f5f7f9; color: #172033; }
        .topbar { min-height: 68px; padding: 12px max(24px, calc((100vw - 1160px) / 2)); display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #dce3eb; }
        .brand, .account-actions { display: flex; align-items: center; gap: 12px; }
        .brand { color: #172033; font-size: 1.05rem; font-weight: 750; text-decoration: none; }
        .brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; background: #0f766e; color: #fff; font-weight: 800; }
        .account-name { color: #475569; font-size: .9rem; }
        .logout-button, .secondary-button { min-height: 40px; padding: 0 14px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #334155; font-weight: 650; cursor: pointer; }
        .theme-button { min-height: 40px; padding: 0 12px; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #334155; font-weight: 650; cursor: pointer; }
        .content { width: min(1160px, calc(100% - 40px)); margin: 0 auto; padding: 38px 0 54px; }
        .page-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 26px; }
        .eyebrow { color: #64748b; font-size: .72rem; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
        h1 { margin: 7px 0 6px; font-size: 2rem; line-height: 1.15; }
        .page-heading p, .muted-copy { margin: 0; color: #64748b; }
        .role-badge, .status-pill { padding: 7px 10px; border-radius: 4px; background: #e8f7f5; color: #087f72; font-size: .72rem; font-weight: 800; letter-spacing: .06em; }
        .metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
        .metric-card, .surface { background: #fff; border: 1px solid #dce3eb; border-radius: 6px; }
        .metric-card { min-height: 96px; padding: 17px 18px; display: grid; align-content: center; gap: 9px; }
        .metric-card span { color: #64748b; font-size: .82rem; }
        .metric-card strong { font-size: 1.2rem; }
        .main-grid { display: grid; grid-template-columns: 1.3fr .9fr; gap: 18px; }
        .surface { padding: 22px; }
        h2 { margin: 6px 0 18px; font-size: 1.12rem; }
        .section-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
        .route-line { margin: 24px 0; }
        .stop { display: flex; align-items: flex-start; gap: 12px; }
        .stop div { display: grid; gap: 4px; }
        .stop strong { font-size: .92rem; }
        .stop small { color: #64748b; }
        .stop-dot, .live-dot, .notice-dot { flex: 0 0 auto; width: 10px; height: 10px; margin-top: 4px; border: 2px solid #0f766e; border-radius: 50%; }
        .stop-dot.end { border-color: #f59e0b; }
        .route-connector { width: 2px; height: 25px; margin: 4px 0 4px 4px; background: #cbd5e1; }
        .button-row { display: flex; flex-wrap: wrap; gap: 10px; }
        .primary-button { min-height: 42px; padding: 0 16px; border: 0; border-radius: 6px; background: #0f766e; color: #fff; font-weight: 700; cursor: pointer; }
        .feedback { min-height: 20px; margin: 12px 0 0; color: #087f72; font-size: .85rem; }
        .controls-card form { display: grid; margin-top: 20px; }
        .field-label { display: block; margin: 14px 0 7px; color: #475569; font-size: .84rem; font-weight: 650; }
        select, textarea, input { width: 100%; padding: 10px 11px; border: 1px solid #cbd5e1; border-radius: 5px; background: #fff; color: #172033; font: inherit; }
        textarea { resize: vertical; }
        .controls-card > select { margin-bottom: 2px; }
        .notice-card { display: flex; align-items: flex-start; gap: 12px; margin-top: 18px; padding: 16px 18px; }
        .notice-dot { border: 0; background: #f59e0b; }
        .notice-card p, .notification-box p { margin: 5px 0 0; color: #64748b; font-size: .88rem; }
        .location-display { display: flex; align-items: center; gap: 10px; padding: 14px; border: 1px solid #dce3eb; border-radius: 5px; background: #f8fafc; color: #475569; font-size: .88rem; }
        .live-dot { margin: 0; border: 0; background: #16a34a; box-shadow: 0 0 0 4px #dcfce7; }
        .compact-route { margin-bottom: 18px; }
        .schedule-row { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: .9rem; }
        .schedule-row strong { color: #172033; }
        .notification-box { margin-top: 18px; padding: 14px; background: #f0fdfa; border-left: 3px solid #0f766e; }
        .profile-card { margin-top: 18px; display: grid; grid-template-columns: 1fr 1.4fr; gap: 20px; align-items: start; }
        .profile-card h2 { margin-bottom: 0; }
        .profile-card form { display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; align-items: end; }
        .profile-card .field-label { grid-column: 1 / -1; margin-top: 0; }
        .profile-card form input { min-width: 0; }
        .loading-screen { min-height: 100vh; display: grid; place-items: center; background: #f5f7f9; color: #475569; }
        .actor-dashboard.dark-mode { background: #101820; color: #e5edf2; }
        .dark-mode .topbar, .dark-mode .metric-card, .dark-mode .surface { background: #18232d; border-color: #344451; }
        .dark-mode .topbar { border-bottom-color: #344451; }
        .dark-mode .brand, .dark-mode h1, .dark-mode h2, .dark-mode .metric-card strong, .dark-mode .schedule-row strong, .dark-mode .notice-card strong, .dark-mode .notification-box strong { color: #e5edf2; }
        .dark-mode .account-name, .dark-mode .eyebrow, .dark-mode .page-heading p, .dark-mode .muted-copy, .dark-mode .metric-card span, .dark-mode .stop small, .dark-mode .notice-card p, .dark-mode .notification-box p, .dark-mode .schedule-row, .dark-mode .field-label { color: #aab9c5; }
        .dark-mode .logout-button, .dark-mode .secondary-button, .dark-mode .theme-button, .dark-mode select, .dark-mode textarea, .dark-mode input { background: #202e39; border-color: #455867; color: #e5edf2; }
        .dark-mode .location-display { background: #202e39; border-color: #455867; color: #c7d3dc; }
        .dark-mode .schedule-row { border-bottom-color: #344451; }
        .dark-mode .notification-box { background: #173330; }
        .dark-mode .role-badge, .dark-mode .status-pill { background: #173d3a; color: #73d6c7; }
        .dark-mode .route-connector { background: #455867; }
        .dark-mode .loading-screen { background: #101820; color: #c7d3dc; }
        @media (max-width: 720px) {
          .topbar { padding: 12px 18px; }
          .content { width: min(100% - 28px, 560px); padding-top: 26px; }
          .metric-grid { grid-template-columns: 1fr; gap: 9px; }
          .metric-card { min-height: 76px; }
          .main-grid, .profile-card { grid-template-columns: 1fr; }
          .page-heading { align-items: flex-start; }
          h1 { font-size: 1.65rem; }
          .surface { padding: 18px; }
        }
        @media (max-width: 440px) {
          .account-name { display: none; }
          .theme-button { padding: 0 9px; font-size: .82rem; }
          .page-heading p { max-width: 260px; line-height: 1.5; }
          .profile-card form { grid-template-columns: 1fr; }
          .profile-card .field-label { grid-column: auto; }
          .button-row > button { flex: 1 1 100%; }
        }
      `}</style>
    </div>
  );
}