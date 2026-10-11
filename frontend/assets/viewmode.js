// viewmode.js — Desktop / Mobile layout toggle, loaded in <head> on every page.
// Sets <html data-view="desktop|mobile"> before first paint so there is no
// flash. First visit picks by screen width; the toggle remembers the choice.
(function () {
  var KEY = "dx_view";
  var root = document.documentElement;

  function saved() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function auto() {
    return window.innerWidth >= 1024 ? "desktop" : "mobile";
  }

  function apply(mode) {
    root.setAttribute("data-view", mode);
    var btns = document.querySelectorAll(".dx-view-toggle button");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute(
        "aria-pressed",
        String(btns[i].getAttribute("data-mode") === mode),
      );
    }
  }

  apply(saved() || auto());

  // Page hook for desktop.css, e.g. <html class="dx-page-signup">
  var page = (location.pathname.split("/").pop() || "index.html").replace(
    /\.html$/,
    "",
  );
  root.classList.add("dx-page-" + (page || "index"));

  // Follow the screen size until the person picks a mode themselves
  window.addEventListener("resize", function () {
    if (!saved()) apply(auto());
  });

  // The four main app pages get a sidebar on desktop
  var NAV = [
    ["browse.html", "&#9830;", "Browse"],
    ["messages.html", "&#9993;", "Messages"],
    ["profile.html", "&#9786;", "Profile"],
    ["settings.html", "&#9881;", "Settings"],
  ];

  function buildSidebar() {
    var here = location.pathname.split("/").pop() || "index.html";
    var side = document.createElement("aside");
    side.className = "dx-side";
    var html =
      '<a class="dx-side-logo" href="browse.html">Distra<span>X</span>ion</a>' +
      '<nav class="dx-side-nav">';
    NAV.forEach(function (n) {
      html +=
        '<a href="' +
        n[0] +
        '"' +
        (n[0] === here ? ' class="on" aria-current="page"' : "") +
        '><span class="dx-side-icon">' +
        n[1] +
        "</span>" +
        n[2] +
        "</a>";
    });
    html +=
      "</nav>" +
      '<div class="dx-side-foot">Every profile here is a verified, live person.</div>';
    side.innerHTML = html;
    document.body.insertBefore(side, document.body.firstChild);
    document.body.classList.add("dx-app");
  }

  function buildToggle() {
    var bar = document.createElement("div");
    bar.className = "dx-view-toggle";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Layout");
    bar.innerHTML =
      '<button type="button" data-mode="desktop" title="Desktop layout">&#128421; Desktop</button>' +
      '<button type="button" data-mode="mobile" title="Mobile layout">&#128241; Mobile</button>';
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      var mode = b.getAttribute("data-mode");
      try {
        localStorage.setItem(KEY, mode);
      } catch (err) {}
      apply(mode);
    });
    document.body.appendChild(bar);
    apply(root.getAttribute("data-view"));
  }

  document.addEventListener("DOMContentLoaded", function () {
    var here = location.pathname.split("/").pop();
    var isApp = NAV.some(function (n) {
      return n[0] === here;
    });
    if (isApp) buildSidebar();
    buildToggle();
  });
})();
