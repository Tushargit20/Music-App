/**
 * auth.js — Authentication UI Logic
 * Handles login/register form submissions and page navigation.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ── Element References ─────────────────────────────────────
  const loginPage = document.getElementById('login-page');
  const registerPage = document.getElementById('register-page');
  const dashboardPage = document.getElementById('dashboard-page');

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  const registerSuccess = document.getElementById('register-success');

  const gotoRegister = document.getElementById('goto-register');
  const gotoLogin = document.getElementById('goto-login');
  const logoutBtn = document.getElementById('logout-btn');
  const welcomeUser = document.getElementById('welcome-user');

  // ── Page Navigation ────────────────────────────────────────

  function showPage(page) {
    loginPage.style.display = 'none';
    registerPage.style.display = 'none';
    dashboardPage.style.display = 'none';

    if (page === 'login') loginPage.style.display = '';
    else if (page === 'register') registerPage.style.display = '';
    else if (page === 'dashboard') dashboardPage.style.display = '';
  }

  // ── Check if user is already logged in ─────────────────────
  function checkAuth() {
    const token = API.getToken();
    const user = API.getUser();
    if (token && user) {
      welcomeUser.textContent = `Welcome, ${user.username}`;
      showPage('dashboard');
      // Load subscriptions on dashboard entry
      if (typeof loadSubscriptions === 'function') {
        loadSubscriptions();
      }
    } else {
      showPage('login');
    }
  }

  // ── Navigate between login/register ────────────────────────
  gotoRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    showPage('register');
  });

  gotoLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerError.style.display = 'none';
    registerSuccess.style.display = 'none';
    showPage('login');
  });

  // ── Login Form Handler ─────────────────────────────────────
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const btn = document.getElementById('login-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    try {
      btn.disabled = true;
      btnText.style.display = 'none';
      btnLoader.style.display = '';

      const data = await API.login(email, password);

      welcomeUser.textContent = `Welcome, ${data.user.username}`;
      showPage('dashboard');

      // Load subscriptions
      if (typeof loadSubscriptions === 'function') {
        loadSubscriptions();
      }

      loginForm.reset();
    } catch (error) {
      loginError.textContent = error.message;
      loginError.style.display = '';
    } finally {
      btn.disabled = false;
      btnText.style.display = '';
      btnLoader.style.display = 'none';
    }
  });

  // ── Register Form Handler ──────────────────────────────────
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.style.display = 'none';
    registerSuccess.style.display = 'none';

    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    const btn = document.getElementById('register-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    try {
      btn.disabled = true;
      btnText.style.display = 'none';
      btnLoader.style.display = '';

      const data = await API.register(email, username, password);

      welcomeUser.textContent = `Welcome, ${data.user.username}`;
      showPage('dashboard');

      if (typeof loadSubscriptions === 'function') {
        loadSubscriptions();
      }

      registerForm.reset();
    } catch (error) {
      registerError.textContent = error.message;
      registerError.style.display = '';
    } finally {
      btn.disabled = false;
      btnText.style.display = '';
      btnLoader.style.display = 'none';
    }
  });

  // ── Logout Handler ─────────────────────────────────────────
  logoutBtn.addEventListener('click', async () => {
    await API.logout();
    showPage('login');
    showToast('Logged out successfully', 'success');
  });

  // ── Initialize ─────────────────────────────────────────────
  checkAuth();
});
