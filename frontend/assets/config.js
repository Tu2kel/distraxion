// One place for the API address. Local dev → local backend;
// deployed → set window.DX_API before this script, or edit PROD_API.
(function () {
  var PROD_API = "https://REPLACE-WITH-RAILWAY-URL/api";
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  window.DX_API = window.DX_API || (local ? "http://localhost:3001/api" : PROD_API);
  window.DX_ORIGIN = window.DX_API.replace(/\/api$/, "");
})();
