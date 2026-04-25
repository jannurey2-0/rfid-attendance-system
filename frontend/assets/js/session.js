function saveAuthSession(data) {
  localStorage.setItem('accessToken', data.session.access_token);
  localStorage.setItem('refreshToken', data.session.refresh_token);
  localStorage.setItem('profile', JSON.stringify(data.profile));
  localStorage.setItem('user', JSON.stringify(data.user));
}

function saveRfidSession(data) {
  localStorage.setItem('accessToken', data.session.access_token);
  localStorage.setItem('profile', JSON.stringify(data.profile));

  localStorage.setItem('rfidTeacher', JSON.stringify(data.teacher));
  localStorage.setItem('rfidCard', JSON.stringify(data.rfid_card));
}

function getAccessToken() {
  return localStorage.getItem('accessToken');
}

function getProfile() {
  const profile = localStorage.getItem('profile');
  return profile ? JSON.parse(profile) : null;
}

function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('profile');
  localStorage.removeItem('user');
  localStorage.removeItem('rfidProfile');
  localStorage.removeItem('rfidTeacher');
  localStorage.removeItem('rfidCard');
}

function isLoggedIn() {
  return !!getProfile();
}