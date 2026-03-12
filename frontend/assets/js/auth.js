async function loginWithEmail(email, password) {
  const result = await postRequest('/auth/login', { email, password });
  saveAuthSession(result.data);
  return result;
}

async function loginWithRfid(uid) {
  const result = await postRequest('/auth/rfid-login', { uid });
  saveRfidSession(result.data);
  return result;
}