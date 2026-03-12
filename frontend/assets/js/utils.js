console.log('utils.js loaded');

function showMessage(elementId, message, type = 'info') {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.textContent = message;
  el.className = `message ${type}`;
}

function clearMessage(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.textContent = '';
  el.className = 'message';
}

function redirectByRole(profile) {
  if (!profile || !profile.role) return;

  if (profile.role === 'admin') {
    window.location.href = 'admin/dashboard.html';
  } else if (profile.role === 'teacher') {
    window.location.href = 'teacher/dashboard.html';
  } else {
    alert('Unsupported role');
  }
}

function logout() {
  clearSession();
  window.location.href = '../login.html';
}