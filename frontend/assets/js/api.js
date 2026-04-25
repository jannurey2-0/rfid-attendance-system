const API_BASE_URL = 'https://rfid-attendance-system-production-89c5.up.railway.app/api';

async function apiRequest(endpoint, options = {}) {
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw {
        status: response.status,
        ...data
      };
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

async function getRequest(endpoint, token = null) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return apiRequest(endpoint, {
    method: 'GET',
    headers
  });
}

async function postRequest(endpoint, body = {}, token = null) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return apiRequest(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}