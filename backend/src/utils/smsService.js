const axios = require('axios');

const SMS_GATEWAY_URL = "http://192.168.1.4:8080/send-sms"; 
// Example: http://192.168.1.10:3000/send

async function sendSMS(phone, message) {

  try {

    const response = await axios.post(SMS_GATEWAY_URL, {
      phone,
      message
    });

    return response.data;

  } catch (error) {

    console.error("SMS Gateway Error:", error.message);
    throw error;

  }

}

module.exports = { sendSMS };