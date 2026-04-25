#include <WiFiManager.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

#define SS_PIN 5
#define RST_PIN 27
#define BUTTON_PIN 32
#define GREEN_LED 25
#define RED_LED 26
#define BUZZER_PIN 13

MFRC522 rfid(SS_PIN, RST_PIN);

const char* SERVER_URL = "https://rfid-attendance-system-production-89c5.up.railway.app";
const char* DEVICE_KEY = "rfid_scanner_device_12345";

String SESSION_ID = "";
String TEACHER_UID = "";
bool teacherVerified = false;

String lastUID = "";
unsigned long lastScanTime = 0;
unsigned long scanCooldown = 3000;

// ---------- Button timing ----------
unsigned long buttonPressStart = 0;
bool buttonHeld = false;

// ---------- LED modes ----------
enum LedMode {
  LED_BOOTING,
  LED_READY,
  LED_NO_SESSION,
  LED_PROCESSING,
  LED_ERROR,
  LED_WIFI_RESET,
  LED_TEACHER_REQUIRED
};

LedMode currentLedMode = LED_BOOTING;
unsigned long lastLedBlink = 0;
bool greenLedState = false;
bool redLedState = false;

// ---------- LCD helpers ----------
void showReady() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Scanner Ready");
  lcd.setCursor(0, 1);
  lcd.print("Tap Your Card");
}

void showNoSession() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("No Active");
  lcd.setCursor(0, 1);
  lcd.print("Session");
}

void showProcessing(String uid) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Processing...");
  lcd.setCursor(0, 1);
  lcd.print(uid);
}

void showSuccess() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Attendance OK");
  lcd.setCursor(0, 1);
  lcd.print("Welcome");
}

void showFailed() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Scan Failed");
  lcd.setCursor(0, 1);
  lcd.print("Try Again"); 
}

void showRefreshing() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Refreshing...");
  lcd.setCursor(0, 1);
  lcd.print("Checking Sess");
}

void showResettingWiFi() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Resetting WiFi");
  lcd.setCursor(0, 1);
  lcd.print("Please wait");
}

void showRebooting() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Rebooting...");
  lcd.setCursor(0, 1);
  lcd.print("Please wait");
}

void showTeacherRequired() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Teacher Required");
  lcd.setCursor(0, 1);
  lcd.print("Tap Teacher RFID");
}

void showTeacherVerified() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Teacher Verified");
  lcd.setCursor(0, 1);
  lcd.print("Scanner Ready");
}

void showTeacherFirst() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Invalid Scan");
  lcd.setCursor(0, 1);
  lcd.print("Teacher First");
}

void showNoTeacherUID() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("No Teacher RFID");
  lcd.setCursor(0, 1);
  lcd.print("Check Admin");
}

void showDeviceRefreshed() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Device Refreshed!");
  lcd.setCursor(0, 1);
  lcd.print("Checking Sess");
}

void showSessionEnded() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Session Ended");
  lcd.setCursor(0, 1);
  lcd.print("Refreshing...");
}

// ---------- LED helpers ----------
void applyLedState(bool greenOn, bool redOn) {
  digitalWrite(GREEN_LED, greenOn ? HIGH : LOW);
  digitalWrite(RED_LED, redOn ? HIGH : LOW);
}

// ---------- BUZZER SOUNDS ----------

// Simple tone wrapper (passive buzzer)
void beep(int freq, int duration) {
  tone(BUZZER_PIN, freq);
  delay(duration);
  noTone(BUZZER_PIN);
  delay(50);
}

// Boot sound (ascending tone)
void soundBoot() {
  beep(800, 150);
  beep(1200, 150);
  beep(1600, 200);
}

// Success sound (pleasant double beep)
void soundSuccess() {
  beep(1500, 120);
  delay(80);
  beep(1800, 180);
}

// Error / Declined sound (low harsh tone)
void soundError() {
  beep(400, 300);
  delay(100);
  beep(300, 400);
}

// Duplicate scan sound (fast warning)
void soundDuplicate() {
  beep(1000, 80);
  beep(1000, 80);
  beep(1000, 80);
}

void setLedMode(LedMode mode) {
  currentLedMode = mode;
  lastLedBlink = millis();
  greenLedState = false;
  redLedState = false;

  switch (mode) {
    case LED_BOOTING:
      applyLedState(false, true);
      break;

    case LED_READY:
      applyLedState(true, false);
      break;

    case LED_NO_SESSION:
      applyLedState(false, false);
      break;

    case LED_PROCESSING:
      applyLedState(false, false);
      break;

    case LED_ERROR:
      applyLedState(false, false);
      break;

    case LED_WIFI_RESET:
      applyLedState(false, false);
      break;

    case LED_TEACHER_REQUIRED:
      applyLedState(false, false);
      break;
  }
}

void updateLEDs() {
  unsigned long now = millis();

  switch (currentLedMode) {
    case LED_BOOTING:
      applyLedState(false, true);
      break;

    case LED_READY:
      applyLedState(true, false);
      break;

    case LED_NO_SESSION:
      if (now - lastLedBlink >= 800) {
        lastLedBlink = now;
        greenLedState = !greenLedState;
        applyLedState(greenLedState, false);
      }
      break;

    case LED_PROCESSING:
      if (now - lastLedBlink >= 150) {
        lastLedBlink = now;
        greenLedState = !greenLedState;
        applyLedState(greenLedState, false);
      }
      break;

    case LED_ERROR:
      if (now - lastLedBlink >= 200) {
        lastLedBlink = now;
        redLedState = !redLedState;
        applyLedState(false, redLedState);
      }
      break;

    case LED_WIFI_RESET:
      if (now - lastLedBlink >= 100) {
        lastLedBlink = now;
        redLedState = !redLedState;
        applyLedState(false, redLedState);
      }
      break;

    case LED_TEACHER_REQUIRED:
      if (now - lastLedBlink >= 400) {
        lastLedBlink = now;
        greenLedState = !greenLedState;
        applyLedState(greenLedState, false);
      }
      break;
  }
}

// ---------- WiFi ----------
void connectToWiFi() {
  WiFiManager wm;

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Setup WiFi");
  lcd.setCursor(0, 1);
  lcd.print("Connect Phone");

  setLedMode(LED_BOOTING);

  bool res = wm.autoConnect("RFID-Attendance");

  if (!res) {
    Serial.println("Failed to connect");
    ESP.restart();
  } else {
    Serial.println("WiFi connected!");

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());

    setLedMode(LED_READY);
    delay(2000);
  }
}

void sendLoginScan(String uid) {

  if (WiFi.status() != WL_CONNECTED) connectToWiFi();

  HTTPClient http;

  String url = String(SERVER_URL) + "/api/rfid/device/login-scan";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  String body = "{\"uid\":\"" + uid + "\"}";

  Serial.println("Sending login scan...");
  Serial.println(body);

  int httpCode = http.POST(body);

  Serial.print("Login Scan HTTP Response Code: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.println("Server Response:");
    Serial.println(response);
  } else {
    Serial.println("Login scan request failed");
  }

  http.end();
}

// ---------- Session ----------
void getActiveSession() {
  HTTPClient http;

  String url = String(SERVER_URL) + "/api/attendance/device/active-session";

  Serial.println("Requesting active session...");
  Serial.println(url);

  http.begin(url);
  http.addHeader("x-device-key", DEVICE_KEY);

  int httpCode = http.GET();

  Serial.print("HTTP Response Code: ");
  Serial.println(httpCode);

  if (httpCode == 200) {
    String payload = http.getString();

    Serial.println("Server Response:");
    Serial.println(payload);

    DynamicJsonDocument doc(2048);
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
      Serial.println("JSON parsing failed");
      http.end();

      setLedMode(LED_ERROR);
      showFailed();
      delay(1500);

      if (SESSION_ID == "") {
        showNoSession();
        setLedMode(LED_NO_SESSION);
      } else {
        if (teacherVerified) {
          showReady();
          setLedMode(LED_READY);
        } else {
          showTeacherRequired();
          setLedMode(LED_TEACHER_REQUIRED);
        }
      }
      return;
    }

    JsonObject session = doc["data"];

    if (!session.isNull() && session.containsKey("id")) {
      SESSION_ID = session["id"].as<String>();
      TEACHER_UID = session["teacher_rfid_uid"].as<String>();
      teacherVerified = false;

      Serial.print("Active Session ID: ");
      Serial.println(SESSION_ID);

      Serial.print("Teacher UID: ");
      Serial.println(TEACHER_UID);

      if (TEACHER_UID == "") {
        showNoTeacherUID();
        setLedMode(LED_ERROR);
      } else {
        showTeacherRequired();
        setLedMode(LED_TEACHER_REQUIRED);
      }

    } else {
      SESSION_ID = "";
      TEACHER_UID = "";
      teacherVerified = false;

      Serial.println("No active session found");

      showNoSession();
      setLedMode(LED_NO_SESSION);
    }

  } else {
    Serial.println("Failed to get active session");

    SESSION_ID = "";
    TEACHER_UID = "";
    teacherVerified = false;

    showNoSession();
    setLedMode(LED_NO_SESSION);
  }

  http.end();
}

void checkDeviceRefreshSignal() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/rfid/device/status";

  http.begin(url);
  http.addHeader("x-device-key", DEVICE_KEY);

  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error && doc.containsKey("data")) {
      bool shouldRefresh = doc["data"]["shouldRefresh"];
      bool sessionEnded = doc["data"]["sessionEnded"];

      if (sessionEnded) {
        Serial.println("Session end signal received!");
        showSessionEnded();
        setLedMode(LED_PROCESSING);
        delay(1500);
        // Reset session and check for new one
        SESSION_ID = "";
        TEACHER_UID = "";
        teacherVerified = false;
        getActiveSession();
      } else if (shouldRefresh) {
        Serial.println("Remote refresh signal received!");
        showDeviceRefreshed();
        setLedMode(LED_PROCESSING);
        delay(1000);
        getActiveSession();
      }
    }
  }

  http.end();
}

// ---------- RFID ----------
String readUID() {
  if (!rfid.PICC_IsNewCardPresent()) return "";
  if (!rfid.PICC_ReadCardSerial()) return "";

  String uid = "";

  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }

  uid.toUpperCase();

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  return uid;
}

void sendAttendance(String uid) {
  if (SESSION_ID == "") {
    Serial.println("No active session. Scan ignored.");
    showNoSession();
    setLedMode(LED_NO_SESSION);
    delay(1500);
    return;
  }

  if (!teacherVerified) {
    Serial.println("Teacher not yet verified.");
    showTeacherRequired();
    setLedMode(LED_TEACHER_REQUIRED);
    delay(1500);
    return;
  }

  if (WiFi.status() != WL_CONNECTED) connectToWiFi();

  showProcessing(uid);
  setLedMode(LED_PROCESSING);

  HTTPClient http;

  String url = String(SERVER_URL) +
               "/api/attendance/sessions/" +
               SESSION_ID +
               "/scan";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  String body = "{\"uid\":\"" + uid + "\"}";

  Serial.println("Sending attendance scan...");
  Serial.println(body);

  int httpCode = http.POST(body);

  Serial.print("HTTP Response Code: ");
  Serial.println(httpCode);

  if (httpCode == 201) {
    String response = http.getString();

    Serial.println("Server Response:");
    Serial.println(response);

    soundSuccess();

    showSuccess();
    setLedMode(LED_READY);
    delay(2000);
    showReady();
  } else {
    Serial.println("Request failed");
    soundError();

    showFailed();
    setLedMode(LED_ERROR);
    delay(2000);

    if (teacherVerified) {
      showReady();
      setLedMode(LED_READY);
    } else {
      showTeacherRequired();
      setLedMode(LED_TEACHER_REQUIRED);
    }
  }

  http.end();
}

// ---------- Button actions ----------
void handleShortPress() {
  Serial.println("Short press: Refresh session");
  showRefreshing();
  setLedMode(LED_PROCESSING);
  delay(300);
  getActiveSession();
}

void handleLongPress() {
  Serial.println("Long press: Reset WiFi");
  showResettingWiFi();
  setLedMode(LED_WIFI_RESET);

  WiFiManager wm;
  delay(1000);
  wm.resetSettings();

  delay(1500);
  ESP.restart();
}

void handleVeryLongPress() {
  Serial.println("Very long press: Reboot device");
  showRebooting();
  setLedMode(LED_WIFI_RESET);

  delay(1500);
  ESP.restart();
}

void handleButton() {
  bool buttonPressed = (digitalRead(BUTTON_PIN) == LOW);

  if (buttonPressed && !buttonHeld) {
    buttonHeld = true;
    buttonPressStart = millis();
  }

  if (!buttonPressed && buttonHeld) {
    unsigned long pressTime = millis() - buttonPressStart;
    buttonHeld = false;

    if (pressTime < 1000) {
      handleShortPress();
    } else if (pressTime >= 3000 && pressTime < 6000) {
      handleLongPress();
    } else if (pressTime >= 6000) {
      handleVeryLongPress();
    } else {
      Serial.println("Medium press: no action");
    }
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  setLedMode(LED_BOOTING);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();

  lcd.setCursor(0, 0);
  lcd.print("RFID Scanner");
  lcd.setCursor(0, 1);
  lcd.print("Starting...");
  soundBoot();

  SPI.begin();
  rfid.PCD_Init();

  Serial.println("RFID Attendance Scanner Ready");

  connectToWiFi();
  getActiveSession();
}

unsigned long lastRefreshCheck = 0;
unsigned long refreshCheckInterval = 2000; // Check every 2 seconds

void loop() {
  handleButton();
  updateLEDs();

  unsigned long now = millis();

  // Check for remote refresh signal from web app
  if (now - lastRefreshCheck >= refreshCheckInterval) {
    lastRefreshCheck = now;
    checkDeviceRefreshSignal();
  }

  String uid = readUID();
  if (uid == "") return;

  // Prevent duplicate scans
  if (uid == lastUID && now - lastScanTime < scanCooldown) {
    Serial.println("Duplicate scan ignored");
    soundDuplicate();
    delay(300);
    return;
  }

  Serial.print("Card UID: ");
  Serial.println(uid);

  // ---------------------------------------------------
  // MODE 1 : NO ACTIVE SESSION → LOGIN MODE
  // ---------------------------------------------------
  if (SESSION_ID == "") {

    Serial.println("No active session → Sending LOGIN scan");

    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("Login Scan");
    lcd.setCursor(0,1);
    lcd.print(uid);

    setLedMode(LED_PROCESSING);

    sendLoginScan(uid);

    delay(2000);

    showNoSession();
    setLedMode(LED_NO_SESSION);

    lastUID = uid;
    lastScanTime = now;

    return;
  }

  // ---------------------------------------------------
  // MODE 2 : ACTIVE SESSION → ATTENDANCE MODE
  // ---------------------------------------------------

  // Teacher must scan first
  if (!teacherVerified) {

    if (TEACHER_UID == "") {
      Serial.println("No teacher RFID found for active session.");
      showNoTeacherUID();
      setLedMode(LED_ERROR);
      delay(1500);
      return;
    }

    if (uid == TEACHER_UID) {

      Serial.println("Teacher verified.");

      teacherVerified = true;

      showTeacherVerified();
      setLedMode(LED_READY);

      delay(2000);

      showReady();

    } else {

      Serial.println("Student tried before teacher.");
      soundError();

      showTeacherFirst();
      setLedMode(LED_TEACHER_REQUIRED);

      delay(2000);

      showTeacherRequired();
    }

    lastUID = uid;
    lastScanTime = now;

    return;
  }

  // ---------------------------------------------------
  // STUDENT ATTENDANCE
  // ---------------------------------------------------

  sendAttendance(uid);

  lastUID = uid;
  lastScanTime = now;

  delay(300);
}