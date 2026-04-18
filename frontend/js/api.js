/**
 * api.js — API Client Module
 * Centralized HTTP client for all backend API calls.
 * Handles authentication headers automatically.
 */

const API = (() => {
  // Base URL — change this when deploying to AWS
  // For EC2/ECS: use the public IP or load balancer URL
  // For Lambda: use the API Gateway URL
  const BASE_URL = window.location.origin;

  /**
   * Get the stored JWT token
   */
  function getToken() {
    return localStorage.getItem('token');
  }

  /**
   * Set the JWT token in localStorage
   */
  function setToken(token) {
    localStorage.setItem('token', token);
  }

  /**
   * Remove the JWT token (logout)
   */
  function clearToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  /**
   * Get stored user info
   */
  function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  /**
   * Store user info
   */
  function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  /**
   * Make an authenticated API request.
   * @param {string} endpoint - API endpoint (e.g., "/api/auth/login")
   * @param {Object} options - Fetch options
   * @returns {Object} Parsed JSON response
   */
  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const token = getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data;
  }

  // ─── AUTH API ────────────────────────────────────────────────

  async function login(email, password) {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  async function register(email, username, password) {
    const data = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  async function logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Logout is client-side primarily
    }
    clearToken();
  }

  // ─── MUSIC API ──────────────────────────────────────────────

  async function searchMusic(params) {
    // Build query string from non-empty params
    const queryParts = [];
    for (const [key, value] of Object.entries(params)) {
      if (value && value.trim()) {
        queryParts.push(`${key}=${encodeURIComponent(value.trim())}`);
      }
    }
    const queryString = queryParts.join('&');
    return request(`/api/music/search?${queryString}`);
  }

  async function getAllSongs({ limit = 10, next = null } = {}) {
    const queryParts = [`limit=${encodeURIComponent(limit)}`];
    if (next) {
      queryParts.push(`next=${encodeURIComponent(next)}`);
    }
    const queryString = queryParts.join('&');
    return request(`/api/music/all?${queryString}`);
  }

  // ─── SUBSCRIPTION API ──────────────────────────────────────

  async function getSubscriptions() {
    return request('/api/subscriptions');
  }

  async function subscribe(song) {
    return request('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify(song),
    });
  }

  async function unsubscribe(songId) {
    return request('/api/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ song_id: songId }),
    });
  }

  // ─── PUBLIC API ──────────────────────────────────────────────

  return {
    getToken,
    getUser,
    login,
    register,
    logout,
    searchMusic,
    getAllSongs,
    getSubscriptions,
    subscribe,
    unsubscribe,
  };
})();
