import { useEffect, useRef } from "react";
import { useRouter } from "next/router";

export default function Dashboard() {
  const mapRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem("user");

    // ✅ Protect dashboard
    if (!user) {
      router.push("/login");
      return;
    }
  }, []);

  useEffect(() => {
    const loadMap = async () => {
      const L = await import("leaflet");

      // ✅ Fix marker icon issue
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

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const markers = {};

      // ✅ Safe vehicle update
      const updateVehicles = async () => {
        try {
          const res = await fetch("http://localhost:3000/api/gps");

          if (!res.ok) {
            throw new Error("API not responding");
          }

          const data = await res.json();

          Object.entries(data).forEach(([id, v]) => {
            // ✅ FIX comma issue
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

      updateVehicles();
      setInterval(updateVehicles, 3000);
    };

    loadMap();
  }, []);

  return (
    <div style={{ height: "100vh" }}>
      
      {/* ✅ LOGOUT BUTTON */}
      <div style={{ padding: "10px" }}>
        <button
          onClick={() => {
            localStorage.removeItem("user");
            router.push("/login");
          }}
          style={{
            padding: "8px",
            background: "red",
            color: "white",
            border: "none",
            borderRadius: "5px",
          }}
        >
          Logout
        </button>
      </div>

      {/* ✅ MAP */}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "90%",
        }}
      />
    </div>
  );
}
