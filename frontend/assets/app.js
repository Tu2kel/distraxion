// ==============================
// CONFIG
// ==============================
const API_BASE = "http://localhost:3001/api";

// ==============================
// TOKEN HANDLING
// ==============================
function setToken(token) {
  localStorage.setItem("token", token);
}

function getToken() {
  return localStorage.getItem("token");
}

function removeToken() {
  localStorage.removeItem("token");
}

// ==============================
// SUPERUSER HELPERS
// ==============================
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function isSuperUser() {
  const token = getToken();
  if (!token) return false;
  const decoded = parseJwt(token);
  return !!(decoded && decoded.isSuperUser);
}

function getSuperUserTier() {
  const token = getToken();
  if (!token) return "free";
  const decoded = parseJwt(token);
  return (decoded && decoded.tier) || "free";
}

// ==============================
// API HELPER
// ==============================
async function apiRequest(endpoint, method = "GET", body = null) {
  const headers = { "Content-Type": "application/json" };

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, options);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.msg || err.message || "API error");
  }

  return res.json();
}

// ==============================
// AUTH FUNCTIONS
// ==============================
async function signup(userData) {
  const data = await apiRequest("/auth/signup", "POST", userData);
  setToken(data.token);
  return data;
}

async function login(credentials) {
  const data = await apiRequest("/auth/login", "POST", credentials);
  setToken(data.token);
  return data;
}

async function getCurrentUser() {
  return await apiRequest("/auth/me");
}

function logout() {
  removeToken();
  window.location.href = "/login.html";
}

// ==============================
// UPGRADE FUNCTION
// Handles both real Stripe flow and SuperUser $0 bypass.
// Call this from any paywall / settings upgrade button.
//
// Usage:
//   const result = await upgradeTier('plus');
//   // result.charged === 0 for superuser
//   // result.msg describes outcome
// ==============================
async function upgradeTier(tier) {
  if (isSuperUser()) {
    const data = await apiRequest("/auth/superuser-upgrade", "POST", { tier });
    setToken(data.token);
    return data;
  }

  // Real Stripe path (implement when ready)
  throw new Error("Stripe upgrade not yet implemented for standard users");
}

// ==============================
// AUTH GUARD
// ==============================
function requireAuth() {
  const token = getToken();
  if (!token) window.location.href = "/login.html";
}

// ==============================
// PAGE HELPERS
// ==============================
function initProtectedPage() {
  requireAuth();
  getCurrentUser().catch(() => logout());
}

// ==============================
// FORM HANDLERS
// ==============================

// SIGNUP
async function handleSignup(form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const userData = {
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      age: Number(formData.get("age")),
      city: formData.get("city"),
      gender: formData.get("gender"),
      seeking: formData.get("seeking"),
      background: formData.getAll("background"),
      vibe: formData.getAll("vibe"),
      bio: formData.get("bio"),
    };
    try {
      await signup(userData);
      window.location.href = "/browse.html";
    } catch (err) {
      alert(err.message);
    }
  });
}

// LOGIN
// The email field accepts "imperio" as the username for superuser login.
async function handleLogin(form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const credentials = {
      email: formData.get("email"),
      password: formData.get("password"),
    };
    try {
      await login(credentials);
      window.location.href = "/browse.html";
    } catch (err) {
      alert(err.message);
    }
  });
}
