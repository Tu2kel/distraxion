// verify.html — email code → live selfie challenge → face-matched photos
(function () {
  var API = window.DX_API;
  var token = localStorage.getItem("dx_token");
  if (!token) {
    location.href = "login.html";
    return;
  }

  var $ = function (id) {
    return document.getElementById(id);
  };

  function toast(msg, ok) {
    var t = $("toast");
    t.textContent = msg;
    t.className = "toast show" + (ok ? " ok" : "");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () {
      t.className = "toast";
    }, 3800);
  }

  async function api(path, method, body, isForm) {
    var headers = { Authorization: "Bearer " + token };
    if (body && !isForm) headers["Content-Type"] = "application/json";
    var res = await fetch(API + path, {
      method: method || "GET",
      headers: headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (res.status === 401) {
      localStorage.removeItem("dx_token");
      location.href = "login.html";
    }
    if (!res.ok) throw new Error(data.msg || "Something went wrong");
    return data;
  }

  // ── Step state ───────────────────────────────────────────
  var state = null;

  async function refresh() {
    state = await api("/verify/status");
    var me = await api("/auth/me");
    renderPhotos(me.photos || []);

    var order = [
      ["s-email", state.email],
      ["s-selfie", state.selfie],
      ["s-photo", state.photo],
    ];
    var activeSet = false;
    order.forEach(function (pair) {
      var el = $(pair[0]);
      el.classList.toggle("done", pair[1]);
      var active = !pair[1] && !activeSet;
      el.classList.toggle("active", active);
      if (active) activeSet = true;
    });
    // Photos stay editable after the first one is in
    if (state.selfie && state.photo) $("s-photo").classList.add("active");

    $("attempts").textContent =
      state.attemptsLeft < 5
        ? state.attemptsLeft + " selfie attempts left today"
        : "";
    $("btn-done").hidden = !state.verified;
  }

  // ── 1. Email ─────────────────────────────────────────────
  $("btn-email").addEventListener("click", async function () {
    var code = $("email-code").value.trim();
    if (!/^\d{6}$/.test(code)) return toast("Enter the 6-digit code");
    try {
      await api("/auth/verify-email", "POST", { code: code });
      toast("Email confirmed", true);
      refresh();
    } catch (e) {
      toast(e.message);
    }
  });

  $("btn-resend").addEventListener("click", async function () {
    try {
      await api("/auth/resend-code", "POST");
      toast("New code sent", true);
    } catch (e) {
      toast(e.message);
    }
  });

  // ── 2. Live selfie ───────────────────────────────────────
  var stream = null;

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  function grabFrame(video) {
    var scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
    var c = document.createElement("canvas");
    c.width = Math.round(video.videoWidth * scale);
    c.height = Math.round(video.videoHeight * scale);
    c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.88);
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach(function (t) {
      t.stop();
    });
    stream = null;
    $("cam").classList.remove("on");
  }

  $("btn-selfie").addEventListener("click", async function () {
    var btn = this;
    btn.disabled = true;
    var video = $("video");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
        audio: false,
      });
    } catch (e) {
      btn.disabled = false;
      return toast("Camera access is needed to verify");
    }

    try {
      video.srcObject = stream;
      await video.play();
      $("cam").classList.add("on");
      btn.textContent = "HOLD STILL…";

      var ch = await api("/verify/challenge", "POST");
      var frames = [];
      for (var i = 0; i < ch.steps.length; i++) {
        $("cam-prompt").textContent = ch.steps[i].prompt;
        for (var n = 3; n > 0; n--) {
          $("cam-count").textContent = n;
          await sleep(900);
        }
        $("cam-count").textContent = "";
        frames.push(grabFrame(video));
        await sleep(250);
      }
      $("cam-prompt").textContent = "Checking…";
      btn.textContent = "CHECKING…";

      await api("/verify/selfie", "POST", { nonce: ch.nonce, frames: frames });
      toast("You're verified as a real person", true);
    } catch (e) {
      toast(e.message);
    } finally {
      stopCamera();
      btn.disabled = false;
      btn.textContent = "TRY AGAIN";
      refresh();
    }
  });

  // ── 3. Photos ────────────────────────────────────────────
  function renderPhotos(urls) {
    var grid = $("photo-grid");
    grid.innerHTML = "";
    urls.forEach(function (u) {
      var tile = document.createElement("div");
      tile.className = "photo-tile";
      var img = document.createElement("img");
      img.src = window.DX_ORIGIN + u;
      img.alt = "";
      var del = document.createElement("button");
      del.textContent = "×";
      del.setAttribute("aria-label", "Remove photo");
      del.addEventListener("click", async function () {
        try {
          await api("/photos/" + u.split("/").pop(), "DELETE");
          refresh();
        } catch (e) {
          toast(e.message);
        }
      });
      tile.appendChild(img);
      tile.appendChild(del);
      grid.appendChild(tile);
    });
  }

  $("photo-input").addEventListener("change", async function () {
    var file = this.files[0];
    this.value = "";
    if (!file) return;
    var fd = new FormData();
    fd.append("photo", file);
    toast("Checking photo…", true);
    try {
      await api("/photos", "POST", fd, true);
      toast("Photo added", true);
      refresh();
    } catch (e) {
      toast(e.message);
    }
  });

  $("btn-done").addEventListener("click", function () {
    location.href = "browse.html";
  });

  refresh().catch(function (e) {
    toast(e.message);
  });
})();
