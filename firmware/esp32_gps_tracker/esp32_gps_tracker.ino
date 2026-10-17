/*
  ESP32 GPS tracker for the Transport Tracking System
  ---------------------------------------------------
  Reads a Neo-6M GPS and posts the vehicle's position to POST /api/gps every few seconds:
    { "vehicleId": "TR-214", "latitude": -25.43, "longitude": 30.98, "speed": 42.5 }
  with the header  x-device-token: <GPS_DEVICE_TOKEN from .env.local>

  Two ways to send data (pick one with USE_GSM below):
    USE_GSM 1 -> SIM800L GSM/GPRS module with a data SIM (what goes on the real bus/taxi)
    USE_GSM 0 -> Wi-Fi (easiest for testing on campus or at home)

  Wiring (ESP32 DevKit V1):
    Neo-6M  TX -> GPIO16 (RX2)     Neo-6M  RX -> GPIO17 (TX2)    VCC -> 3.3V   GND -> GND
    SIM800L TX -> GPIO26           SIM800L RX -> GPIO27          VCC -> 3.7-4.2V supply that can give 2A
                                                                 (Li-ion cell or buck converter, NOT the ESP32 3.3V pin)
                                                                 GND -> common GND

  Arduino IDE libraries (Sketch > Include Library > Manage Libraries):
    TinyGPSPlus (Mikal Hart), TinyGSM (Volodymyr Shymanskyy), ArduinoHttpClient (Arduino)
  Board: "ESP32 Dev Module" (install "esp32 by Espressif Systems" in Boards Manager)

  Server address: the ESP32 cannot reach "localhost" on your laptop.
    - Wi-Fi test: use your laptop's LAN IP, e.g. 192.168.1.50, port 3000, and run `npm run dev -- -H 0.0.0.0`.
    - GSM: the server must be on the internet (deployed, or exposed with a tunnel such as ngrok).
      SIM800L only supports old TLS, so plain HTTP on port 80 through a tunnel/proxy is the most reliable for a demo.
*/

#define USE_GSM 0                 // 1 = SIM800L, 0 = Wi-Fi

// ---------- Settings: change these ----------
const char* VEHICLE_ID     = "TR-214";
const char* DEVICE_TOKEN   = "paste-GPS_DEVICE_TOKEN-here";
const char* SERVER_HOST    = "192.168.1.50";   // no http://, no path
const int   SERVER_PORT    = 3000;
const unsigned long SEND_INTERVAL_MS = 5000;  // how often to report

// Wi-Fi (USE_GSM 0)
const char* WIFI_SSID      = "your-wifi-name";
const char* WIFI_PASSWORD  = "your-wifi-password";

// GSM (USE_GSM 1) - APN for your SIM network
const char* GSM_APN        = "internet";       // Vodacom: internet, MTN: internet, Cell C: internet, Telkom: internet
const char* GSM_USER       = "";
const char* GSM_PASS       = "";
// --------------------------------------------

#if USE_GSM
  #define TINY_GSM_MODEM_SIM800
  #define TINY_GSM_RX_BUFFER 1024
  #include <TinyGsmClient.h>
#else
  #include <WiFi.h>
#endif
#include <ArduinoHttpClient.h>
#include <TinyGPSPlus.h>

#define GPS_RX 16
#define GPS_TX 17
#define GSM_RX 26
#define GSM_TX 27

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

#if USE_GSM
  HardwareSerial gsmSerial(1);
  TinyGsm modem(gsmSerial);
  TinyGsmClient netClient(modem);
#else
  WiFiClient netClient;
#endif

HttpClient http(netClient, SERVER_HOST, SERVER_PORT);
unsigned long lastSend = 0;

bool connectNetwork() {
#if USE_GSM
  if (modem.isGprsConnected()) return true;
  Serial.println("Connecting to mobile network...");
  if (!modem.waitForNetwork(60000L)) { Serial.println("No network signal"); return false; }
  if (!modem.gprsConnect(GSM_APN, GSM_USER, GSM_PASS)) { Serial.println("GPRS connect failed"); return false; }
  Serial.println("GPRS connected");
  return true;
#else
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.printf("Connecting to Wi-Fi %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) { delay(500); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " failed");
  return WiFi.status() == WL_CONNECTED;
#endif
}

void sendLocation() {
  if (!connectNetwork()) return;

  char body[160];
  snprintf(body, sizeof(body),
           "{\"vehicleId\":\"%s\",\"latitude\":%.6f,\"longitude\":%.6f,\"speed\":%.1f}",
           VEHICLE_ID, gps.location.lat(), gps.location.lng(), gps.speed.isValid() ? gps.speed.kmph() : 0.0);

  http.beginRequest();
  http.post("/api/gps");
  http.sendHeader("Content-Type", "application/json");
  http.sendHeader("x-device-token", DEVICE_TOKEN);
  http.sendHeader("Content-Length", strlen(body));
  http.beginBody();
  http.print(body);
  http.endRequest();

  int status = http.responseStatusCode();
  String response = http.responseBody();
  http.stop();
  Serial.printf("POST %s -> %d %s\n", body, status, response.c_str());
}

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
#if USE_GSM
  gsmSerial.begin(9600, SERIAL_8N1, GSM_RX, GSM_TX);
  delay(3000);
  Serial.println("Starting SIM800L...");
  modem.restart();
  Serial.println(modem.getModemInfo());
#endif
  connectNetwork();
  Serial.println("Waiting for GPS fix (go outside; first fix can take 1-5 minutes)...");
}

void loop() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());

  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    if (gps.location.isValid() && gps.location.age() < 5000) {
      sendLocation();
    } else {
      Serial.printf("No GPS fix yet (satellites: %d, chars read: %lu)\n",
                    gps.satellites.isValid() ? gps.satellites.value() : 0, gps.charsProcessed());
    }
  }
}
