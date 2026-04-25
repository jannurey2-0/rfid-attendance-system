let latestLoginScan = null;
let deviceRefreshSignal = false;
let sessionEndSignal = false;
let adminRfidScan = null;

function setLatestLoginScan(uid) {
  latestLoginScan = {
    uid,
    scanned_at: new Date().toISOString(),
    used: false
  };
}

function getLatestLoginScan() {
  return latestLoginScan;
}

function markLoginScanUsed() {
  if (latestLoginScan) {
    latestLoginScan.used = true;
  }
}

function triggerDeviceRefresh() {
  deviceRefreshSignal = true;
}

function checkDeviceRefresh() {
  return deviceRefreshSignal;
}

function consumeDeviceRefresh() {
  deviceRefreshSignal = false;
}

function triggerSessionEnd() {
  sessionEndSignal = true;
}

function checkSessionEnd() {
  return sessionEndSignal;
}

function consumeSessionEnd() {
  sessionEndSignal = false;
}

function setAdminRfidScan(uid) {
  adminRfidScan = {
    uid,
    scanned_at: new Date().toISOString()
  };
}

function getAdminRfidScan() {
  return adminRfidScan;
}

function consumeAdminRfidScan() {
  adminRfidScan = null;
}

module.exports = {
  setLatestLoginScan,
  getLatestLoginScan,
  markLoginScanUsed,
  triggerDeviceRefresh,
  checkDeviceRefresh,
  consumeDeviceRefresh,
  triggerSessionEnd,
  checkSessionEnd,
  consumeSessionEnd,
  setAdminRfidScan,
  getAdminRfidScan,
  consumeAdminRfidScan
};
