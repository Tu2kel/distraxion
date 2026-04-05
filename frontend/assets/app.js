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
// API HELPER
// ==============================
async function apiRequest(endpoint, method = "GET", body = null) {
  const headers = {
    "Content-Type": "application/json",
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, options);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "API error");
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
// AUTH GUARD
// ==============================
function requireAuth() {
  const token = getToken();

  if (!token) {
    window.location.href = "/login.html";
  }
}

// ==============================
// PAGE HELPERS
// ==============================

// Call this on protected pages
function initProtectedPage() {
  requireAuth();

  // Optional: verify token still valid
  getCurrentUser().catch(() => {
    logout();
  });
}

// ==============================
// FORM HANDLERS
// ==============================

// SIGNUP FORM
async function handleSignup(form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    const userData = {
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password"),
    };

    try {
      await signup(userData);
      window.location.href = "/browse.html";
    } catch (err) {
      alert(err.message);
    }
  });
}

// LOGIN FORM
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
