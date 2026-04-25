const {
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
} = require('./deviceScanStore');

async function submitLoginScanHandler(req, res) {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'UID is required'
      });
    }

    setLatestLoginScan(uid.trim().toUpperCase());

    return res.status(200).json({
      success: true,
      message: 'Login scan received successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to receive login scan',
      error: error.message
    });
  }
}

async function getLatestLoginScanHandler(req, res) {
  try {
    const scan = getLatestLoginScan();

    return res.status(200).json({
      success: true,
      message: 'Latest login scan fetched successfully',
      data: scan
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch latest login scan',
      error: error.message
    });
  }
}

async function consumeLatestLoginScanHandler(req, res) {
  try {
    markLoginScanUsed();

    return res.status(200).json({
      success: true,
      message: 'Login scan marked as used'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to consume login scan',
      error: error.message
    });
  }
}

async function requestDeviceRefreshHandler(req, res) {
  try {
    triggerDeviceRefresh();

    return res.status(200).json({
      success: true,
      message: 'Device refresh signal sent successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to send device refresh signal',
      error: error.message
    });
  }
}

async function getDeviceRefreshStatusHandler(req, res) {
  try {
    const shouldRefresh = checkDeviceRefresh();

    if (shouldRefresh) {
      consumeDeviceRefresh();
    }

    return res.status(200).json({
      success: true,
      message: 'Device refresh status checked',
      data: {
        shouldRefresh
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to check device refresh status',
      error: error.message
    });
  }
}

async function getDeviceStatusHandler(req, res) {
  try {
    const shouldRefresh = checkDeviceRefresh();
    const sessionEnded = checkSessionEnd();

    // Consume signals after checking
    if (shouldRefresh) {
      consumeDeviceRefresh();
    }
    if (sessionEnded) {
      consumeSessionEnd();
    }

    return res.status(200).json({
      success: true,
      message: 'Device status checked',
      data: {
        shouldRefresh,
        sessionEnded
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to check device status',
      error: error.message
    });
  }
}

async function submitAdminRfidScanHandler(req, res) {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'UID is required'
      });
    }

    setAdminRfidScan(uid.trim().toUpperCase());

    return res.status(200).json({
      success: true,
      message: 'Admin RFID scan received successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to receive admin RFID scan',
      error: error.message
    });
  }
}

async function getAdminRfidScanHandler(req, res) {
  try {
    const scan = getAdminRfidScan();

    if (scan) {
      consumeAdminRfidScan();
    }

    return res.status(200).json({
      success: true,
      message: 'Admin RFID scan fetched successfully',
      data: scan
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admin RFID scan',
      error: error.message
    });
  }
}

module.exports = {
  submitLoginScanHandler,
  getLatestLoginScanHandler,
  consumeLatestLoginScanHandler,
  requestDeviceRefreshHandler,
  getDeviceRefreshStatusHandler,
  getDeviceStatusHandler,
  submitAdminRfidScanHandler,
  getAdminRfidScanHandler
};
