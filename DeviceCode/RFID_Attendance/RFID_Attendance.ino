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

MFRC522 rfid(SS_PIN, RST_PIN);

const char* SERVER_URL = "http://192.168.1.6:3000";
const char* DEVICE_KEY = "rfid_device_123";

String SESSION_ID = "";

String lastUID = "";
unsigned long lastScanTime = 0;
unsigned long scanCooldown = 3000;

// ---------- Button timing ----------
unsigned long buttonPressStart = 0;
bool buttonHeld = false;

// --------Teacher Variables ---------//
String TEACHER_UID = "";
bool teacherVerified = false;

// ---------- LED modes ----------
enum LedMode {
  LED_BOOTING,
  LED_READY,
  LED_NO_SESSION,
  LED_PROCESSING,
  LED_ERROR,
  LED_WIFI_RESET
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

// ---------- LED helpers ----------
void applyLedState(bool greenOn, bool redOn) {
  digitalWrite(GREEN_LED, greenOn ? HIGH : LOW);
  digitalWrite(RED_LED, redOn ? HIGH : LOW);
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
        showReady();
        setLedMode(LED_READY);
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

      showReady();
      setLedMode(LED_READY);
    } else {
      SESSION_ID = "";
      Serial.println("No active session found");

      showNoSession();
      setLedMode(LED_NO_SESSION);
    }

  } else {
    Serial.println("Failed to get active session");

    showNoSession();
    setLedMode(LED_NO_SESSION);
  }

  http.end();
}

void showTeacherRequired() {

  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("Teacher Required");
  lcd.setCursor(0,1);
  lcd.print("Tap Teacher RFID");

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

    showSuccess();
    setLedMode(LED_READY);
    delay(2000);
    showReady();
  } else {
    Serial.println("Request failed");

    showFailed();
    setLedMode(LED_ERROR);
    delay(2000);

    if (SESSION_ID == "") {
      showNoSession();
      setLedMode(LED_NO_SESSION);
    } else {
      showReady();
      setLedMode(LED_READY);
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

  setLedMode(LED_BOOTING);

  lcd.init();
  lcd.backlight();

  lcd.setCursor(0, 0);
  lcd.print("RFID Scanner");
  lcd.setCursor(0, 1);
  lcd.print("Starting...");

  SPI.begin();
  rfid.PCD_Init();

  Serial.println("RFID Attendance Scanner Ready");

  connectToWiFi();
  getActiveSession();
}

void loop() {
  handleButton();
  updateLEDs();

  String uid = readUID();
  if (uid == "") return;

  unsigned long now = millis();

  if (uid == lastUID && now - lastScanTime < scanCooldown) {
    Serial.println("Duplicate scan ignored");
    delay(300);
    return;
  }

  Serial.print("Card UID: ");
  Serial.println(uid);

  sendAttendance(uid);

  lastUID = uid;
  lastScanTime = now;

  delay(300);
}