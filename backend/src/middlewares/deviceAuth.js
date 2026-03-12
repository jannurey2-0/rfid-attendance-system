function deviceAuth(req, res, next) {

  const deviceKey = req.headers["x-device-key"];

  // Allow ESP32 device
  if (deviceKey && deviceKey === process.env.DEVICE_API_KEY) {
    return next();
  }

  // Otherwise allow normal authenticated users
  return next();
}

module.exports = deviceAuth;