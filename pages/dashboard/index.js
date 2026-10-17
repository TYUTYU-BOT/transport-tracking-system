import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

export default function Dashboard() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const intervalRef = useRef(null);
  const initializedRef = useRef(false);
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [activeSection, setActiveSection] = useState("Overview");
  const [recordsBySection, setRecordsBySection] = useState({
    Users: [
      { id: "USR-001", name: "admin", detail: "Administrator", status: "Active" },
      { id: "USR-002", name: "user", detail: "Passenger", status: "Active" },
      { id: "USR-003", name: "driver.demo", detail: "Driver", status: "Active" },
    ],
    Drivers: [
      { id: "DRV-021", name: "M. Mokoena", detail: "Durban Route A", status: "Available" },
      { id: "DRV-019", name: "L. Ndlovu", detail: "Cape Town Route 2", status: "In transit" },
      { id: "DRV-005", name: "A. Botha", detail: "Pretoria Route 5", status: "Rest break" },
    ],
    Vehicles: [
      { id: "TR-214", name: "Mercedes Sprinter", detail: "Assigned to M. Mokoena", status: "Active" },
      { id: "TR-108", name: "Toyota Quantum", detail: "Assigned to L. Ndlovu", status: "Active" },
      { id: "TR-066", name: "Isuzu N-Series", detail: "Unassigned", status: "Maintenance" },
    ],
    Routes: [
      { id: "RTE-01", name: "Durban → Pietermaritzburg", detail: "09:40 departure", status: "On schedule" },
      { id: "RTE-02", name: "Cape Town → Paarl", detail: "10:05 departure", status: "Delayed 12m" },
      { id: "RTE-03", name: "Johannesburg → Pretoria", detail: "11:15 departure", status: "On schedule" },
    ],
  });
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [recordDraft, setRecordDraft] = useState({ name: "", detail: "", status: "Active" });
  const [notificationDraft, setNotificationDraft] = useState("");
  const [notificationRecipient, setNotificationRecipient] = useState("All users");
  const [sentNotifications, setSentNotifications] = useState([]);
  const [adminFeedback, setAdminFeedback] = useState("");
  const [driverApplications, setDriverApplications] = useState([]);
  const [driverVehicles, setDriverVehicles] = useState([]);
  const [selectedVehiclesByDriver, setSelectedVehiclesByDriver] = useState({});
  const [verifiedApplicantVehiclesByDriver, setVerifiedApplicantVehiclesByDriver] = useState({});

  useEffect(() => {
    setDarkMode(localStorage.getItem("transport-theme") === "dark");
    fetch("/api/admin/notifications")
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.notifications) {
          setSentNotifications(data.notifications.map((notification) => ({
            ...notification,
            recipient: notification.recipient === "all" ? "All users" : notification.recipient === "driver" ? "Drivers" : "Passengers",
            sentAt: new Date(notification.sentAt).toLocaleTimeString(),
          })));
        }
      })
      .catch(() => {});
    try {
      const savedRecords = localStorage.getItem("admin-demo-records");
      if (savedRecords) setRecordsBySection(JSON.parse(savedRecords));
    } catch {
      localStorage.removeItem("admin-demo-records");
    }
  }, []);

  useEffect(() => {
    if (activeSection !== "Drivers") return;
    fetch("/api/admin/drivers")
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Could not load driver applications");
        return data;
      })
      .then((data) => {
        setDriverApplications(data.applications);
        setDriverVehicles(data.vehicles);
        setSelectedVehiclesByDriver((current) => Object.fromEntries([
          ...data.applications.map((application) => [application.userId, current[application.userId] || application.vehicleIds || []]),
        ]));
        setVerifiedApplicantVehiclesByDriver((current) => Object.fromEntries([
          ...data.applications.map((application) => [application.userId, current[application.userId] || application.applicantVehicles.filter((vehicle) => vehicle.reviewStatus === "verified").map((vehicle) => vehicle.id)]),
        ]));
      })
      .catch((error) => setAdminFeedback(error.message));
  }, [activeSection]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active) return;
        if (!data?.user) {
          localStorage.removeItem("user");
          router.replace("/login");
        } else if (data.user.role !== "admin") {
          router.replace(data.user.role === "driver" ? "/dashboard/driver" : "/dashboard/passenger");
        }
      })
      .catch(() => router.replace("/login"));
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    try {
      if (JSON.parse(localStorage.getItem("user") || "{}").role !== "admin") return;
    } catch {
      return;
    }

      if (activeSection !== "Overview") return;

    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const loadMap = async () => {
      if (!mapRef.current) {
        return;
      }

      const L = await import("leaflet");

      if (!isMounted || !mapRef.current) {
        return;
      }

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:
          "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current).setView([-25.469, 30.986], 14);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const markers = {};

      const updateVehicles = async () => {
        try {
          const res = await fetch("/api/gps");

          if (!res.ok) {
            throw new Error("API not responding");
          }

          const data = await res.json();

          Object.entries(data).forEach(([id, v]) => {
            const lat = parseFloat(String(v.latitude).replace(",", "."));
            const lng = parseFloat(String(v.longitude).replace(",", "."));
            const latlng = [lat, lng];

            if (!markers[id]) {
              markers[id] = L.marker(latlng)
                .addTo(map)
                .bindPopup(`Vehicle: ${id}`);
            } else {
              markers[id].setLatLng(latlng);
            }
          });
        } catch (err) {
          console.log("Fetch failed:", err.message);
        }
      };

      if (isMounted) {
        updateVehicles();
        intervalRef.current = setInterval(updateVehicles, 3000);
      }
    };

    loadMap();

    return () => {
      isMounted = false;
      initializedRef.current = false;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [activeSection]);

  const stats = [
    { label: "Active vehicles", value: "128", accent: "#14b8a6" },
    { label: "On time", value: "96%", accent: "#22c55e" },
    { label: "Alerts", value: "07", accent: "#f59e0b" },
    { label: "Distance", value: "4,820 km", accent: "#60a5fa" },
  ];

  const routes = [
    { name: "Durban → Pietermaritzburg", status: "On schedule", time: "09:40" },
    { name: "Cape Town → Paarl", status: "Delayed 12m", time: "10:05" },
    { name: "Johannesburg → Pretoria", status: "On schedule", time: "11:15" },
    { name: "Bloemfontein → Kimberley", status: "Inspection", time: "12:00" },
  ];

  const alerts = [
    { text: "Vehicle TR-214 exceeded speed threshold", level: "High" },
    { text: "Driver LT-19 has maintenance review", level: "Medium" },
    { text: "Route delivery window is closing", level: "Low" },
  ];

  const drivers = [
    { name: "M. Mokoena", route: "Durban Route A", status: "Available" },
    { name: "L. Ndlovu", route: "Cape Town Route 2", status: "In transit" },
    { name: "A. Botha", route: "Pretoria Route 5", status: "Rest break" },
  ];

  const filteredRoutes = routes.filter((route) =>
    route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDrivers = drivers.filter((driver) =>
    driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    driver.route.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sectionRecords = recordsBySection[activeSection] || [];
  const filteredSectionRecords = sectionRecords.filter((record) =>
    Object.values(record).some((value) =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const saveSectionRecords = (updatedRecords) => {
    const updatedData = { ...recordsBySection, [activeSection]: updatedRecords };
    setRecordsBySection(updatedData);
    localStorage.setItem("admin-demo-records", JSON.stringify(updatedData));
  };

  const saveRecord = (event) => {
    event.preventDefault();
    if (!recordDraft.name.trim()) return;

    const record = {
      id: editingRecordId || `${activeSection.slice(0, 3).toUpperCase()}-${Date.now()}`,
      name: recordDraft.name.trim(),
      detail: recordDraft.detail.trim(),
      status: recordDraft.status,
    };
    const updatedRecords = editingRecordId
      ? sectionRecords.map((item) => item.id === editingRecordId ? record : item)
      : [record, ...sectionRecords];

    saveSectionRecords(updatedRecords);
    setEditingRecordId(null);
    setRecordDraft({ name: "", detail: "", status: "Active" });
    setAdminFeedback(`${activeSection.slice(0, -1)} saved.`);
  };

  const editRecord = (record) => {
    setEditingRecordId(record.id);
    setRecordDraft({ name: record.name, detail: record.detail, status: record.status });
    setAdminFeedback("");
  };

  const deleteRecord = (recordId) => {
    saveSectionRecords(sectionRecords.filter((record) => record.id !== recordId));
    if (editingRecordId === recordId) {
      setEditingRecordId(null);
      setRecordDraft({ name: "", detail: "", status: "Active" });
    }
    setAdminFeedback("Record deleted.");
  };

  const downloadReport = (reportName) => {
    const reportRows = activeSection === "Reports" ? routes : [];
    const csv = [
      ["Report", reportName],
      ["Generated", new Date().toLocaleString()],
      [],
      ["Route", "Status", "Departure"],
      ...reportRows.map((route) => [route.name, route.status, route.time]),
    ].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 1000);
    setAdminFeedback(`${reportName} downloaded.`);
  };

  const sendNotification = async (event) => {
    event.preventDefault();
    if (!notificationDraft.trim()) return;
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: notificationRecipient, message: notificationDraft.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to send notification");
      setSentNotifications((notifications) => [
        { ...data.notification, recipient: notificationRecipient, sentAt: new Date(data.notification.sentAt).toLocaleTimeString() },
        ...notifications,
      ]);
      setNotificationDraft("");
      setAdminFeedback("Notification saved and delivered to recipient dashboards.");
    } catch (error) {
      setAdminFeedback(error.message);
    }
  };

  const reviewDriver = async (application, decision) => {
    const vehicleIds = selectedVehiclesByDriver[application.userId] || [];
    const applicantVehicleIds = verifiedApplicantVehiclesByDriver[application.userId] || [];
    if (decision === "approve" && vehicleIds.length + applicantVehicleIds.length === 0) {
      setAdminFeedback(`Assign a fleet vehicle or verify an owned vehicle for ${application.fullName}.`);
      return;
    }

    try {
      const response = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: application.userId, decision, vehicleIds, applicantVehicleIds }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not update driver application");
      setAdminFeedback(data.message);
    } catch (error) {
      setAdminFeedback(error.message);
    } finally {
      fetch("/api/admin/drivers")
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (data) {
            setDriverApplications(data.applications);
            setDriverVehicles(data.vehicles);
            setSelectedVehiclesByDriver((current) => Object.fromEntries([
              ...data.applications.map((application) => [application.userId, current[application.userId] || application.vehicleIds || []]),
            ]));
            setVerifiedApplicantVehiclesByDriver((current) => Object.fromEntries([
              ...data.applications.map((application) => [application.userId, current[application.userId] || application.applicantVehicles.filter((vehicle) => vehicle.reviewStatus === "verified").map((vehicle) => vehicle.id)]),
            ]));
          }
        })
        .catch(() => {});
    }
  };

  return (
    <>
      <div className={`dashboard-shell ${darkMode ? "dark-mode" : ""}`}>
        <div
          className="dashboard-layout"
          style={{
            gridTemplateColumns: sidebarCollapsed ? "82px minmax(0, 1fr)" : "220px minmax(0, 1fr)",
          }}
        >
          <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
            <div className="brand-row">
              <div className="brand-mark">T</div>
              {!sidebarCollapsed && <div className="brand-text">Transport</div>}
            </div>

            <button
              type="button"
              className="collapse-toggle"
              onClick={() => setSidebarCollapsed((value) => !value)}
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? "→" : "←"}
            </button>

            <nav className="sidebar-nav">
              {["Overview", "Users", "Drivers", "Vehicles", "Routes", "Trips", "Reports", "Notifications"].map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`nav-item ${activeSection === item ? "active" : ""}`}
                  onClick={() => setActiveSection(item)}
                  title={sidebarCollapsed ? item : undefined}
                  aria-current={activeSection === item ? "page" : undefined}
                >
                  {sidebarCollapsed ? item.charAt(0) : item}
                </button>
              ))}
            </nav>

            <div className="summary-card">
              {!sidebarCollapsed && (
                <>
                  <div className="summary-label">Shift summary</div>
                  <div className="summary-value">07</div>
                  <div className="summary-copy">drivers active</div>
                </>
              )}
              {sidebarCollapsed && <div className="summary-value compact">07</div>}
            </div>

            <button
              type="button"
              onClick={() => {
                fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
                localStorage.removeItem("user");
                router.push("/login");
              }}
              className="logout-btn"
            >
              {sidebarCollapsed ? "Out" : "Logout"}
            </button>
          </aside>

          <main className="main-panel">
            <header className="topbar">
              <div className="title-block">
                <div className="eyebrow">Fleet control</div>
                <div className="page-title">{activeSection === "Overview" ? "Transport Dashboard" : activeSection}</div>
              </div>

              <div className="topbar-actions">
                <label className="search-wrap" htmlFor="dashboard-search">
                  <span className="search-icon">⌕</span>
                  <input
                    id="dashboard-search"
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={`Search ${activeSection === "Overview" ? "routes or drivers" : activeSection.toLowerCase()}`}
                    aria-label={`Search ${activeSection === "Overview" ? "routes or drivers" : activeSection.toLowerCase()}`}
                  />
                </label>
                <div className="datetime-chip">Tuesday, 08:45</div>
                <button
                  type="button"
                  className="theme-toggle"
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
              </div>
            </header>

            {activeSection === "Overview" ? (
              <>
            <section className="stats-grid">
              {stats.map((stat) => (
                <div key={stat.label} className="stat-card">
                  <div className="stat-label">{stat.label}</div>
                  <div className="stat-value" style={{ color: stat.accent }}>{stat.value}</div>
                </div>
              ))}
            </section>

            <section className="content-grid">
              <div className="panel-card route-panel">
                <div className="panel-title">Route list</div>
                <div className="list-stack">
                  {filteredRoutes.length > 0 ? (
                    filteredRoutes.map((route) => (
                      <div key={route.name} className="list-item">
                        <div>
                          <div className="list-main">{route.name}</div>
                          <div className="list-subtle">{route.status}</div>
                        </div>
                        <div className="list-time">{route.time}</div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">No matching routes</div>
                  )}
                </div>
              </div>

              <div className="panel-card map-panel">
                <div className="panel-title">Fleet activity map</div>
                <div ref={mapRef} className="map-box" />
              </div>

              <div className="panel-card alert-panel">
                <div className="panel-title">Alert panel</div>
                <div className="list-stack">
                  {alerts.map((alert) => (
                    <div key={alert.text} className="alert-item">
                      <div className="alert-text">{alert.text}</div>
                      <div className={`alert-tag ${alert.level.toLowerCase()}`}>
                        {alert.level}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="panel-card drivers-panel">
              <div className="panel-title">Driver cards</div>
              <div className="driver-grid">
                {filteredDrivers.length > 0 ? (
                  filteredDrivers.map((driver) => (
                    <div key={driver.name} className="driver-card">
                      <div className="driver-header">
                        <div className="driver-avatar">{driver.name.charAt(0)}</div>
                        <div>
                          <div className="driver-name">{driver.name}</div>
                          <div className="driver-route">{driver.route}</div>
                        </div>
                      </div>

                      <div className={`driver-status ${driver.status.toLowerCase().replace(/\s+/g, "-")}`}>
                        {driver.status}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No matching drivers</div>
                )}
              </div>
            </section>
              </>
            ) : activeSection === "Reports" ? (
              <section className="panel-card admin-section">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">Operations intelligence</div>
                    <h2>Generate reports</h2>
                  </div>
                  <span className="demo-note">Route snapshot · CSV</span>
                </div>
                <div className="report-grid">
                  {["Daily trip report", "Route performance", "Fleet activity"].map((report) => (
                    <article className="report-card" key={report}>
                      <div className="report-mark" aria-hidden="true">CSV</div>
                      <h3>{report}</h3>
                      <p>Export current route status and scheduled departure data.</p>
                      <button type="button" className="admin-primary" onClick={() => downloadReport(report)}>Download report</button>
                    </article>
                  ))}
                </div>
                <p className="admin-feedback" role="status">{adminFeedback}</p>
              </section>
            ) : activeSection === "Notifications" ? (
              <section className="panel-card admin-section">
                <div className="eyebrow">Communications</div>
                <h2>Send notification</h2>
                <form className="notification-form" onSubmit={sendNotification}>
                  <label htmlFor="notification-recipient">Recipient group</label>
                  <select id="notification-recipient" value={notificationRecipient} onChange={(event) => setNotificationRecipient(event.target.value)}>
                    <option>All users</option><option>Drivers</option><option>Passengers</option>
                  </select>
                  <label htmlFor="notification-message">Message</label>
                  <textarea id="notification-message" rows="4" value={notificationDraft} onChange={(event) => setNotificationDraft(event.target.value)} placeholder="Write a service or route update" required />
                  <button type="submit" className="admin-primary">Send notification</button>
                </form>
                <div className="admin-subsection">
                  <h3>Recent notifications</h3>
                  {sentNotifications.length ? sentNotifications.map((notification) => (
                    <div className="notification-row" key={notification.id}>
                      <div><strong>{notification.recipient}</strong><div className="table-secondary">{notification.message}</div></div>
                      <span className="table-secondary">{notification.sentAt}</span>
                    </div>
                  )) : <p className="table-secondary">No notifications sent in this session.</p>}
                </div>
                <p className="admin-feedback" role="status">{adminFeedback}</p>
              </section>
            ) : activeSection === "Drivers" ? (
              <section className="panel-card admin-section">
                <div className="section-heading">
                  <div><div className="eyebrow">Driver onboarding</div><h2>Review applications</h2></div>
                  <span className="demo-note">License numbers are encrypted at rest</span>
                </div>
                {adminFeedback && <p className="admin-feedback" role="status">{adminFeedback}</p>}
                <div className="application-list">
                  {driverApplications.filter((application) => `${application.fullName} ${application.username} ${application.phoneNumber}`.toLowerCase().includes(searchQuery.toLowerCase())).map((application) => (
                    <article className="application-card" key={application.userId}>
                      <div className="application-heading">
                        <div>
                          <h3>{application.fullName}</h3>
                          <p>{application.username} · {application.phoneNumber}</p>
                        </div>
                        <span className={`application-status ${application.status}`}>{application.status}</span>
                      </div>
                      <div className="application-license">License number <strong>{application.licenseNumber}</strong></div>
                      <div className="application-details">
                        <span><strong>Area:</strong> {application.region}</span>
                        <span><strong>Email:</strong> {application.email}</span>
                        <span><strong>Date of birth:</strong> {application.birthDate}</span>
                        <span><strong>Services:</strong> {application.serviceTypes.join(", ")}</span>
                        <span><strong>Vehicle arrangement:</strong> {application.vehicleOwnership === "own" ? "Own vehicle" : "Company vehicle"}</span>
                      </div>
                      {application.applicantVehicles?.length > 0 && (
                        <div className="applicant-vehicles">
                          <div className="field-group-label">Applicant vehicle details</div>
                          {application.applicantVehicles.map((vehicle) => (
                            <div className="applicant-vehicle-row" key={vehicle.id}>
                              <input
                                type="checkbox"
                                aria-label={`Verify and assign ${vehicle.licensePlate}`}
                                checked={(verifiedApplicantVehiclesByDriver[application.userId] || []).includes(vehicle.id)}
                                disabled={["active", "rejected"].includes(application.status) || vehicle.reviewStatus === "rejected"}
                                onChange={(event) => setVerifiedApplicantVehiclesByDriver((current) => {
                                  const selectedIds = current[application.userId] || [];
                                  return {
                                    ...current,
                                    [application.userId]: event.target.checked ? [...selectedIds, vehicle.id] : selectedIds.filter((id) => id !== vehicle.id),
                                  };
                                })}
                              />
                              <strong>{vehicle.licensePlate}</strong>
                              <span>{vehicle.year} {vehicle.make} {vehicle.model}</span>
                              <span>{vehicle.category} · {vehicle.color}</span>
                              <span className={`application-status ${vehicle.reviewStatus}`}>{vehicle.reviewStatus}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="vehicle-assignment">
                        <div className="field-group-label">Assign vehicles. Select at least one vehicle to approve.</div>
                        <div className="vehicle-options">
                          {driverVehicles.map((vehicle) => {
                            const selectedIds = selectedVehiclesByDriver[application.userId] || [];
                            return (
                              <label className="vehicle-option" key={vehicle.id}>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(vehicle.id)}
                                  disabled={vehicle.status === "Maintenance" || ["active", "rejected"].includes(application.status)}
                                  onChange={(event) => setSelectedVehiclesByDriver((current) => ({
                                    ...current,
                                    [application.userId]: event.target.checked
                                      ? [...selectedIds, vehicle.id]
                                      : selectedIds.filter((id) => id !== vehicle.id),
                                  }))}
                                />
                                <span>{vehicle.id} · {vehicle.label}</span>
                                <small>{vehicle.status}</small>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div className="application-actions">
                        {application.status !== "active" && application.status !== "rejected" && (
                          <>
                            <button
                              type="button"
                              className="admin-primary"
                              onClick={() => reviewDriver(application, application.status === "approved" ? "resend" : "approve")}
                            >
                              {application.status === "approved" ? "Resend activation SMS" : "Approve and send activation SMS"}
                            </button>
                            {application.status === "pending" && <button type="button" className="admin-secondary" onClick={() => reviewDriver(application, "reject")}>Reject application</button>}
                          </>
                        )}
                        {application.status === "active" && <span className="demo-note">Activated</span>}
                        {application.status === "rejected" && <span className="demo-note">Application rejected</span>}
                      </div>
                    </article>
                  ))}
                  {!driverApplications.length && <p className="table-secondary">No Driver applications yet.</p>}
                </div>
              </section>
            ) : activeSection === "Trips" ? (
              <section className="panel-card admin-section">
                <div className="section-heading">
                  <div><div className="eyebrow">Live operations</div><h2>Monitor trips</h2></div>
                  <span className="demo-note">Operational sample data</span>
                </div>
                <div className="table-scroll">
                  <table className="admin-table">
                    <thead><tr><th>Trip</th><th>Vehicle</th><th>Driver</th><th>Route</th><th>Status</th><th>ETA</th></tr></thead>
                    <tbody>
                      {[
                        ["TRP-041", "TR-214", "M. Mokoena", "Durban → Pietermaritzburg", "In progress", "11:10"],
                        ["TRP-042", "TR-108", "L. Ndlovu", "Cape Town → Paarl", "Delayed 12m", "12:35"],
                        ["TRP-043", "TR-066", "A. Botha", "Johannesburg → Pretoria", "Inspection", "13:20"],
                      ].map((trip) => <tr key={trip[0]}>{trip.map((cell) => <td key={`${trip[0]}-${cell}`}>{cell}</td>)}</tr>)}
                    </tbody>
                  </table>
                </div>
                <p className="table-secondary">Vehicle locations update on the Overview map as GPS data arrives.</p>
              </section>
            ) : (
              <section className="panel-card admin-section">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">Administration</div>
                    <h2>Manage {activeSection.toLowerCase()}</h2>
                  </div>
                  <span className="demo-note">Management records · demo workspace</span>
                </div>

                <form className="record-form" onSubmit={saveRecord}>
                  <div className="field-group">
                    <label htmlFor="record-name">{activeSection === "Users" ? "Username" : "Name"}</label>
                    <input id="record-name" value={recordDraft.name} onChange={(event) => setRecordDraft({ ...recordDraft, name: event.target.value })} placeholder={`Enter ${activeSection.toLowerCase().slice(0, -1)} name`} required />
                  </div>
                  <div className="field-group">
                    <label htmlFor="record-detail">{activeSection === "Routes" ? "Schedule / details" : "Details / assignment"}</label>
                    <input id="record-detail" value={recordDraft.detail} onChange={(event) => setRecordDraft({ ...recordDraft, detail: event.target.value })} placeholder={activeSection === "Vehicles" ? "Vehicle type or assigned driver" : "Add route, role, or assignment"} />
                  </div>
                  <div className="field-group">
                    <label htmlFor="record-status">Status</label>
                    <select id="record-status" value={recordDraft.status} onChange={(event) => setRecordDraft({ ...recordDraft, status: event.target.value })}>
                      {["Active", "Available", "In transit", "On schedule", "Delayed", "Rest break", "Maintenance", "Inactive"].map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </div>
                  <div className="record-actions">
                    <button type="submit" className="admin-primary">{editingRecordId ? "Save changes" : `Add ${activeSection.slice(0, -1).toLowerCase()}`}</button>
                    {editingRecordId && <button type="button" className="admin-secondary" onClick={() => { setEditingRecordId(null); setRecordDraft({ name: "", detail: "", status: "Active" }); }}>Cancel edit</button>}
                  </div>
                </form>

                <div className="table-scroll">
                  <table className="admin-table">
                    <thead><tr><th>ID</th><th>{activeSection === "Users" ? "Username" : "Name"}</th><th>Details / assignment</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredSectionRecords.map((record) => (
                        <tr key={record.id}>
                          <td>{record.id}</td><td>{record.name}</td><td>{record.detail}</td><td>{record.status}</td>
                          <td className="table-actions">
                            <button type="button" className="text-action" onClick={() => editRecord(record)}>Edit</button>
                            <button type="button" className="text-action danger-action" onClick={() => deleteRecord(record.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                      {!filteredSectionRecords.length && <tr><td colSpan="5" className="table-secondary">No records match your search.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <p className="admin-feedback" role="status">{adminFeedback}</p>
              </section>
            )}
          </main>
        </div>
      </div>

      <style jsx>{`
        .dashboard-shell {
          min-height: 100vh;
          background: #ffffff;
          color: #f8fafc;
          padding: 24px;
        }

        .dashboard-layout {
          max-width: 1500px;
          margin: 0 auto;
          display: grid;
          gap: 22px;
        }

        .sidebar {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 22px;
          padding: 18px 14px 16px;
          box-shadow: 0 18px 42px rgba(2, 6, 23, 0.26);
          display: flex;
          flex-direction: column;
          transition: all 0.25s ease;
          min-height: 820px;
        }

        .sidebar.collapsed {
          padding-left: 10px;
          padding-right: 10px;
        }

        .brand-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 22px;
          min-height: 40px;
        }

        .brand-mark {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #14b8a6, #2dd4bf);
          color: #062b2e;
          font-weight: 800;
          flex-shrink: 0;
        }

        .brand-text {
          font-weight: 800;
          font-size: 1.08rem;
          color: #e2e8f0;
        }

        .collapse-toggle {
          align-self: flex-end;
          width: 32px;
          height: 32px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.7);
          color: #cbd5e1;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .sidebar-nav {
          display: grid;
          gap: 10px;
        }

        .nav-item {
          width: 100%;
          background: transparent;
          border: 1px solid transparent;
          color: #cbd5e1;
          border-radius: 12px;
          padding: 11px 12px;
          font-weight: 600;
          transition: all 0.2s ease;
          text-align: left;
          cursor: pointer;
        }

        .nav-item.active {
          background: rgba(20, 184, 166, 0.14);
          border-color: rgba(20, 184, 166, 0.3);
          color: #99f6e4;
        }

        .sidebar.collapsed .nav-item,
        .sidebar.collapsed .brand-text,
        .sidebar.collapsed .summary-card > *:not(.summary-value.compact) {
          display: none;
        }

        .sidebar.collapsed .nav-item {
          padding: 0;
          display: block;
          height: 38px;
          text-align: center;
        }

        .summary-card {
          margin-top: 26px;
          background: rgba(15, 23, 42, 0.92);
          border-radius: 14px;
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          text-align: center;
        }

        .summary-label {
          color: #94a3b8;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .summary-value {
          font-size: 1.8rem;
          font-weight: 800;
          margin-top: 8px;
          color: #f8fafc;
        }

        .summary-value.compact {
          margin-top: 0;
          font-size: 1.4rem;
        }

        .summary-copy {
          color: #cbd5e1;
          margin-top: 6px;
        }

        .logout-btn {
          width: 100%;
          margin-top: 24px;
          padding: 10px 14px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .logout-btn:hover { transform: translateY(-1px); }

        .main-panel {
          display: grid;
          gap: 20px;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 20px;
          padding: 18px 22px;
          box-shadow: 0 12px 24px rgba(2, 6, 23, 0.25);
        }

        .eyebrow {
          font-size: 0.8rem;
          color: #94a3b8;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .page-title {
          font-size: 1.55rem;
          font-weight: 700;
        }

        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: min(100%, 360px);
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 12px;
          padding: 0 12px;
          height: 44px;
        }

        .search-icon {
          color: #94a3b8;
          font-size: 1.3rem;
          line-height: 1;
        }

        .search-wrap input {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          color: #f8fafc;
          font-size: 0.95rem;
        }

        .search-wrap input::placeholder {
          color: #94a3b8;
        }

        .datetime-chip {
          color: #cbd5e1;
          font-size: 0.92rem;
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 999px;
          padding: 8px 12px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(160px, 1fr));
          gap: 18px;
        }

        .stat-card {
          background: rgba(15, 23, 42, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 18px;
          padding: 18px 20px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.2);
        }

        .stat-label {
          color: #94a3b8;
          font-size: 0.82rem;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 800;
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(260px, 0.8fr) minmax(260px, 1.2fr) minmax(220px, 0.8fr);
          gap: 20px;
        }

        .panel-card {
          background: rgba(15, 23, 42, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 18px;
          padding: 18px;
        }

        .map-panel {
          padding: 0;
          overflow: hidden;
          box-shadow: 0 12px 34px rgba(2, 6, 23, 0.2);
        }

        .panel-title {
          font-weight: 700;
          font-size: 1.05rem;
          margin-bottom: 14px;
          padding: 0 2px;
        }

        .map-panel .panel-title {
          padding: 14px 18px 10px;
          margin-bottom: 0;
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(15, 23, 42, 0.9);
        }

        .map-box {
          width: 100%;
          height: 470px;
        }

        .list-stack {
          display: grid;
          gap: 12px;
        }

        .list-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          background: rgba(2, 6, 23, 0.3);
          border-radius: 12px;
          padding: 12px 10px;
          border: 1px solid rgba(148, 163, 184, 0.12);
        }

        .list-main {
          font-weight: 600;
        }

        .list-subtle {
          color: #94a3b8;
          font-size: 0.82rem;
          margin-top: 4px;
        }

        .list-time {
          color: #cbd5e1;
          font-weight: 700;
        }

        .alert-item {
          background: rgba(2, 6, 23, 0.3);
          border-radius: 12px;
          padding: 12px 10px;
          border: 1px solid rgba(148, 163, 184, 0.12);
        }

        .alert-text {
          color: #e2e8f0;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .alert-tag {
          margin-top: 8px;
          display: inline-block;
          font-size: 0.72rem;
          padding: 5px 8px;
          border-radius: 999px;
          font-weight: 700;
        }

        .alert-tag.high {
          background: rgba(239, 68, 68, 0.12);
          color: #fca5a5;
        }

        .alert-tag.medium {
          background: rgba(245, 158, 11, 0.12);
          color: #fcd34d;
        }

        .alert-tag.low {
          background: rgba(34, 197, 94, 0.12);
          color: #86efac;
        }

        .drivers-panel {
          padding-top: 16px;
        }

        .driver-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(180px, 1fr));
          gap: 16px;
        }

        .driver-card {
          padding: 16px;
          border-radius: 14px;
          background: rgba(2, 6, 23, 0.28);
          border: 1px solid rgba(148, 163, 184, 0.14);
        }

        .driver-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }

        .driver-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #14b8a6, #2dd4bf);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #062b2e;
          font-weight: 800;
        }

        .driver-name {
          font-weight: 700;
        }

        .driver-route {
          color: #94a3b8;
          font-size: 0.8rem;
        }

        .driver-status {
          display: inline-block;
          border-radius: 999px;
          padding: 6px 10px;
          font-weight: 700;
          font-size: 0.75rem;
        }

        .driver-status.available {
          background: rgba(34, 197, 94, 0.12);
          color: #86efac;
        }

        .driver-status.in-transit {
          background: rgba(59, 130, 246, 0.12);
          color: #93c5fd;
        }

        .driver-status.rest-break {
          background: rgba(245, 158, 11, 0.12);
          color: #fcd34d;
        }

        .theme-toggle {
          min-height: 40px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #dce3eb;
          border-radius: 8px;
          background: #ffffff;
          color: #334155;
          font-weight: 650;
          cursor: pointer;
        }

        .empty-state {
          color: #94a3b8;
          font-size: 0.9rem;
          padding: 8px 0;
        }

        .dashboard-shell {
          background: #ffffff;
          color: #172033;
        }

        .sidebar,
        .summary-card,
        .topbar,
        .search-wrap,
        .datetime-chip,
        .stat-card,
        .panel-card {
          background: #ffffff;
          border-color: #dce3eb;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
        }

        .brand-text,
        .page-title,
        .panel-title,
        .list-main,
        .driver-name {
          color: #172033;
        }

        .eyebrow,
        .stat-label,
        .summary-label,
        .list-subtle,
        .driver-route,
        .empty-state {
          color: #64748b;
        }

        .summary-value {
          color: #172033;
        }

        .collapse-toggle {
          background: #f8fafc;
          border-color: #dce3eb;
          color: #334155;
        }

        .nav-item {
          color: #475569;
        }

        .nav-item.active {
          background: #e8f7f5;
          border-color: #b7e7df;
          color: #087f72;
        }

        .search-wrap,
        .datetime-chip {
          background: #f8fafc;
          color: #334155;
        }

        .search-wrap input {
          color: #172033;
        }

        .search-wrap input::placeholder,
        .search-icon {
          color: #64748b;
        }

        .map-panel .panel-title {
          background: #ffffff;
          border-color: #dce3eb;
          color: #172033;
        }

        .list-item,
        .alert-item,
        .driver-card {
          background: #f8fafc;
          border-color: #e2e8f0;
        }

        .list-time {
          color: #334155;
        }

        .alert-text {
          color: #334155;
        }

        .alert-tag.high {
          background: #fee2e2;
          color: #b91c1c;
        }

        .alert-tag.medium {
          background: #fef3c7;
          color: #a16207;
        }

        .alert-tag.low {
          background: #dcfce7;
          color: #15803d;
        }

        .driver-status.available {
          background: #dcfce7;
          color: #15803d;
        }

        .driver-status.in-transit {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .driver-status.rest-break {
          background: #fef3c7;
          color: #a16207;
        }

        .dark-mode.dashboard-shell {
          background: #101820;
          color: #e5edf2;
        }

        .dark-mode .sidebar,
        .dark-mode .summary-card,
        .dark-mode .topbar,
        .dark-mode .stat-card,
        .dark-mode .panel-card {
          background: #18232d;
          border-color: #344451;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
        }

        .dark-mode .brand-text,
        .dark-mode .page-title,
        .dark-mode .panel-title,
        .dark-mode .list-main,
        .dark-mode .driver-name,
        .dark-mode .summary-value {
          color: #e5edf2;
        }

        .dark-mode .eyebrow,
        .dark-mode .stat-label,
        .dark-mode .summary-label,
        .dark-mode .list-subtle,
        .dark-mode .driver-route,
        .dark-mode .empty-state {
          color: #aab9c5;
        }

        .dark-mode .collapse-toggle,
        .dark-mode .search-wrap,
        .dark-mode .datetime-chip,
        .dark-mode .theme-toggle {
          background: #202e39;
          border-color: #455867;
          color: #d5e0e7;
        }

        .dark-mode .nav-item { color: #c4d0d8; }
        .dark-mode .nav-item.active { background: #173d3a; border-color: #28645d; color: #73d6c7; }
        .dark-mode .search-wrap input { color: #e5edf2; }
        .dark-mode .search-wrap input::placeholder,
        .dark-mode .search-icon { color: #aab9c5; }
        .dark-mode .map-panel .panel-title { background: #18232d; border-color: #344451; color: #e5edf2; }
        .dark-mode .list-item,
        .dark-mode .alert-item,
        .dark-mode .driver-card { background: #202e39; border-color: #344451; }
        .dark-mode .list-time,
        .dark-mode .alert-text { color: #d5e0e7; }

        .dark-mode .alert-tag.high { background: #4b252b; color: #fda4af; }
        .dark-mode .alert-tag.medium { background: #49391d; color: #fcd34d; }
        .dark-mode .alert-tag.low { background: #1d3b2b; color: #86efac; }
        .dark-mode .driver-status.available { background: #1d3b2b; color: #86efac; }
        .dark-mode .driver-status.in-transit { background: #1e3554; color: #93c5fd; }
        .dark-mode .driver-status.rest-break { background: #49391d; color: #fcd34d; }

        .admin-section { min-width: 0; padding: 22px; }
        .admin-section h2 { margin: 6px 0 18px; color: #172033; }
        .section-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; }
        .section-heading h2 { margin-bottom: 0; }
        .demo-note, .table-secondary { color: #64748b; font-size: 0.84rem; }
        .record-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 16px; margin-bottom: 18px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
        .field-group { display: grid; align-content: start; gap: 7px; }
        .field-group label, .notification-form label { color: #475569; font-size: 0.84rem; font-weight: 650; }
        .field-group input, .field-group select, .notification-form select, .notification-form textarea { width: 100%; min-height: 42px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px 11px; background: #fff; color: #172033; font: inherit; }
        .record-actions { grid-column: 1 / -1; display: flex; gap: 8px; }
        .admin-primary, .admin-secondary { min-height: 40px; padding: 0 14px; border: 1px solid #0f766e; border-radius: 6px; background: #0f766e; color: #fff; font-weight: 700; cursor: pointer; }
        .admin-secondary { border-color: #cbd5e1; background: #fff; color: #334155; }
        .table-scroll { max-width: 100%; overflow-x: auto; }
        .admin-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; text-align: left; }
        .admin-table th, .admin-table td { padding: 12px 14px; border: 1px solid #e2e8f0; white-space: nowrap; }
        .admin-table th { background: #f1f5f9; color: #475569; font-size: 0.76rem; letter-spacing: 0.05em; text-transform: uppercase; }
        .admin-table td { color: #334155; }
        .admin-table td.table-secondary { white-space: normal; }
        .table-actions { display: flex; gap: 12px; }
        .text-action { border: 0; padding: 0; background: transparent; color: #087f72; font: inherit; font-weight: 700; cursor: pointer; }
        .danger-action { color: #b91c1c; }
        .admin-feedback { min-height: 20px; margin: 12px 0 0; color: #087f72; font-size: 0.85rem; }
        .report-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .report-card { padding: 18px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
        .report-mark { display: grid; place-items: center; width: 42px; height: 32px; border-radius: 5px; background: #e8f7f5; color: #087f72; font-size: 0.72rem; font-weight: 800; }
        .report-card h3, .admin-subsection h3 { margin: 14px 0 6px; color: #172033; font-size: 1rem; }
        .report-card p { min-height: 42px; color: #64748b; font-size: 0.88rem; line-height: 1.5; }
        .notification-form { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 10px 14px; max-width: 780px; align-items: start; }
        .notification-form label { padding-top: 11px; }
        .notification-form textarea { resize: vertical; }
        .notification-form button { grid-column: 2; justify-self: start; }
        .admin-subsection { max-width: 780px; margin-top: 28px; }
        .admin-subsection h3 { margin-top: 0; }
        .notification-row { display: flex; justify-content: space-between; gap: 20px; padding: 13px 0; border-bottom: 1px solid #e2e8f0; }
        .application-list { display: grid; gap: 14px; }
        .application-card { padding: 18px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
        .application-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
        .application-heading h3 { margin: 0; color: #172033; font-size: 1rem; }
        .application-heading p { margin: 5px 0 0; color: #64748b; font-size: .86rem; }
        .application-status { padding: 5px 8px; border-radius: 4px; background: #e2e8f0; color: #475569; font-size: .72rem; font-weight: 750; text-transform: uppercase; }
        .application-status.pending { background: #fef3c7; color: #92400e; }
        .application-status.approved { background: #dbeafe; color: #1d4ed8; }
        .application-status.active { background: #dcfce7; color: #15803d; }
        .application-status.rejected { background: #fee2e2; color: #b91c1c; }
        .application-license { display: flex; gap: 10px; margin-top: 15px; color: #64748b; font-size: .84rem; }
        .application-license strong { color: #334155; font-weight: 650; }
        .application-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 14px; margin-top: 13px; color: #475569; font-size: .82rem; }
        .application-details strong { color: #334155; }
        .applicant-vehicles { margin-top: 15px; }
        .applicant-vehicle-row { display: grid; grid-template-columns: auto 1fr 1fr 1fr auto; gap: 8px; align-items: center; padding: 10px; border: 1px solid #e2e8f0; border-radius: 5px; background: #fff; color: #475569; font-size: .78rem; }
        .applicant-vehicle-row input { width: 16px; height: 16px; accent-color: #0f766e; }
        .applicant-vehicle-row + .applicant-vehicle-row { margin-top: 6px; }
        .applicant-vehicle-row > strong { color: #172033; }
        .vehicle-assignment { margin-top: 16px; }
        .field-group-label { margin-bottom: 8px; color: #475569; font-size: .84rem; font-weight: 700; }
        .vehicle-options { display: flex; flex-wrap: wrap; gap: 8px; }
        .vehicle-option { display: grid; grid-template-columns: auto auto; gap: 2px 8px; align-items: center; padding: 9px 10px; border: 1px solid #dce3eb; border-radius: 6px; background: #fff; color: #334155; font-size: .82rem; }
        .vehicle-option input { grid-row: span 2; accent-color: #0f766e; }
        .vehicle-option small { grid-column: 2; color: #64748b; font-size: .72rem; }
        .application-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
        .dark-mode .admin-section h2, .dark-mode .report-card h3, .dark-mode .admin-subsection h3 { color: #e5edf2; }
        .dark-mode .demo-note, .dark-mode .table-secondary { color: #aab9c5; }
        .dark-mode .record-form, .dark-mode .report-card { background: #202e39; border-color: #344451; }
        .dark-mode .field-group label, .dark-mode .notification-form label { color: #c4d0d8; }
        .dark-mode .field-group input, .dark-mode .field-group select, .dark-mode .notification-form select, .dark-mode .notification-form textarea { background: #18232d; border-color: #455867; color: #e5edf2; }
        .dark-mode .admin-secondary { background: #202e39; border-color: #455867; color: #d5e0e7; }
        .dark-mode .admin-table th, .dark-mode .admin-table td { border-color: #344451; }
        .dark-mode .admin-table th { background: #202e39; color: #c4d0d8; }
        .dark-mode .admin-table td { color: #d5e0e7; }
        .dark-mode .report-mark { background: #173d3a; color: #73d6c7; }
        .dark-mode .report-card p { color: #aab9c5; }
        .dark-mode .notification-row { border-color: #344451; }
        .dark-mode .admin-feedback { color: #73d6c7; }
        .dark-mode .application-card, .dark-mode .vehicle-option { background: #202e39; border-color: #344451; }
        .dark-mode .application-heading h3, .dark-mode .application-license strong, .dark-mode .vehicle-option { color: #e5edf2; }
        .dark-mode .application-heading p, .dark-mode .application-license, .dark-mode .field-group-label, .dark-mode .vehicle-option small { color: #aab9c5; }
        .dark-mode .application-details { color: #aab9c5; }
        .dark-mode .application-details strong, .dark-mode .applicant-vehicle-row > strong { color: #e5edf2; }
        .dark-mode .applicant-vehicle-row { background: #18232d; border-color: #344451; color: #c4d0d8; }

        @media (max-width: 1100px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .map-box {
            height: 360px;
          }
        }

        @media (max-width: 800px) {
          .dashboard-shell {
            padding: 14px;
          }

          .dashboard-layout {
            grid-template-columns: 1fr !important;
          }

          .sidebar {
            min-height: auto;
          }

          .sidebar-nav {
            display: grid;
            grid-template-columns: repeat(2, minmax(120px, 1fr));
          }

          .topbar {
            flex-direction: column;
            align-items: stretch;
          }

          .topbar-actions {
            justify-content: stretch;
            width: 100%;
          }

          .search-wrap {
            width: 100%;
            min-width: 0;
          }

          .stats-grid,
          .driver-grid {
            grid-template-columns: repeat(2, minmax(150px, 1fr));
          }

          .record-form,
          .report-grid {
            grid-template-columns: 1fr;
          }

          .notification-form {
            grid-template-columns: 1fr;
          }

          .notification-form label {
            padding-top: 0;
          }

          .notification-form button {
            grid-column: 1;
          }

          .application-heading,
          .application-license {
            flex-direction: column;
            align-items: flex-start;
          }

          .application-details,
          .applicant-vehicle-row {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .stats-grid,
          .driver-grid,
          .sidebar-nav {
            grid-template-columns: 1fr;
          }

          .page-title {
            font-size: 1.2rem;
          }

          .panel-card,
          .stat-card,
          .topbar {
            border-radius: 14px;
          }
        }
      `}</style>
    </>
  );
}
