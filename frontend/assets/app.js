// ==============================
// CONFIG
// ==============================
const API_BASE = window.DX_API || "http://localhost:3001/api";

// ==============================
// TOKEN HANDLING
// ==============================
function setToken(token) {
  localStorage.setItem("dx_token", token);
}

function getToken() {
  return localStorage.getItem("dx_token");
}

function removeToken() {
  localStorage.removeItem("dx_token");
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
// UPGRADE FUNCTION (Stripe — not built yet)
// ==============================
async function upgradeTier(tier) {
  throw new Error("Upgrades are coming soon");
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
// Signed-in AND fully verified, or bounce to the right page
function initProtectedPage() {
  requireAuth();
  getCurrentUser()
    .then((me) => {
      if (!me.verification || !me.verification.verified) {
        window.location.href = "/verify.html";
      }
    })
    .catch(() => logout());
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
async function handleLogin(form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const credentials = {
      username: formData.get("email"),
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
