// src/services/fingerprint.js
// Browser Entropy Index (BEI) — device signal collection for cybersec engine

export async function collectDeviceSignal() {
  const signals = {};

  // 1. Canvas fingerprint
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#7B2FBE";
    ctx.fillText("Nyxara🔮BEI", 2, 2);
    ctx.fillStyle = "rgba(192,132,252,0.5)";
    ctx.fillRect(50, 1, 62, 20);
    signals.canvas_hash = canvas.toDataURL().slice(-32);
  } catch {
    signals.canvas_hash = "";
  }

  // 2. WebGL renderer
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    if (ext) {
      signals.webgl = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "";
    } else {
      signals.webgl = "";
    }
  } catch {
    signals.webgl = "";
  }

  // 3. Screen parameters (nested)
  signals.screen = {
    width: window.screen.width,
    height: window.screen.height,
    color_depth: window.screen.colorDepth,
    pixel_ratio: window.devicePixelRatio,
  };

  // 4. Timezone, language, user agent
  signals.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  signals.language = navigator.language || "";
  signals.user_agent = navigator.userAgent || "";

  // 5. Audio fingerprint
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ac = new AudioCtx();
      const analyser = ac.createAnalyser();
      const oscillator = ac.createOscillator();
      oscillator.connect(analyser);
      analyser.connect(ac.destination);
      oscillator.start(0);
      const data = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(data);
      signals.audio_hash = data.slice(0, 32).reduce((a, b) => a + b, 0).toFixed(6);
      oscillator.stop();
      ac.close();
    } else {
      signals.audio_hash = "";
    }
  } catch {
    signals.audio_hash = "";
  }

  // 6. IP & JA3
  signals.ip = "127.0.0.1"; // Backend overrides this
  signals.ja3_hash = null;

  // 7. Behavioral biometrics (real/simulated)
  const simMode = window.__nyxara_sim_mode || null;
  
  let keystroke_intervals_ms = [];
  let mouse_coordinates = [];
  let event_count = 0;
  let session_duration_seconds = 5.0;
  let form_fill_seconds = null;

  if (simMode === "bot") {
    keystroke_intervals_ms = [150.0, 150.0, 150.0, 150.0, 150.0, 150.0, 150.0, 150.0, 150.0, 150.0];
    mouse_coordinates = [];
    for (let i = 0; i < 30; i++) {
      mouse_coordinates.push([100 + i * 10, 100 + i * 10]);
    }
    event_count = 120;
    session_duration_seconds = 1.5;
    form_fill_seconds = 1.2;
  } else if (simMode === "rat") {
    keystroke_intervals_ms = [120.0, 540.0, 210.0, 890.0, 150.0, 720.0, 310.0, 940.0];
    mouse_coordinates = [];
    for (let i = 0; i < 30; i++) {
      mouse_coordinates.push([Math.round(Math.random() * 800), Math.round(Math.random() * 600)]);
    }
    event_count = 180;
    session_duration_seconds = 2.0;
    form_fill_seconds = 10.0;
  } else {
    if (window.__nyxara_key_timings && window.__nyxara_key_timings.length > 1) {
      const timings = window.__nyxara_key_timings;
      for (let i = 1; i < timings.length; i++) {
        keystroke_intervals_ms.push(timings[i] - timings[i - 1]);
      }
    }
    if (window.__nyxara_mouse_history) {
      mouse_coordinates = window.__nyxara_mouse_history.map(pt => [Math.round(pt.x), Math.round(pt.y)]);
    }
    event_count = keystroke_intervals_ms.length + mouse_coordinates.length;
    session_duration_seconds = Math.max(1.0, (Date.now() - (window.__nyxara_session_start || Date.now())) / 1000);
  }

  signals.keystroke_intervals_ms = keystroke_intervals_ms;
  signals.mouse_coordinates = mouse_coordinates;
  signals.event_count = event_count;
  signals.session_duration_seconds = parseFloat(session_duration_seconds.toFixed(2));
  signals.form_fill_seconds = form_fill_seconds;

  return signals;
}

async function hashString(str) {
  if (!crypto.subtle) return str.slice(0, 16);
  const encoded = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

// Behavioral biometrics — keyboard timing recorder
export class BiometricRecorder {
  constructor() {
    this.keyTimings = [];
    this.mouseEntropy = [];
    this._boundKey = this._onKey.bind(this);
    this._boundMouse = this._onMouse.bind(this);
  }

  start() {
    document.addEventListener("keydown", this._boundKey);
    document.addEventListener("mousemove", this._boundMouse);
  }

  stop() {
    document.removeEventListener("keydown", this._boundKey);
    document.removeEventListener("mousemove", this._boundMouse);
  }

  _onKey(e) {
    this.keyTimings.push({ key: e.key.slice(0, 1), ts: Date.now() });
    if (this.keyTimings.length > 100) this.keyTimings.shift();
  }

  _onMouse(e) {
    this.mouseEntropy.push({ x: e.clientX, y: e.clientY, ts: Date.now() });
    if (this.mouseEntropy.length > 200) this.mouseEntropy.shift();
  }

  getFeatures() {
    if (this.keyTimings.length < 5) return { typing_consistency: null, mouse_entropy: null };

    const intervals = [];
    for (let i = 1; i < this.keyTimings.length; i++) {
      intervals.push(this.keyTimings[i].ts - this.keyTimings[i - 1].ts);
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / intervals.length;
    const cv = Math.sqrt(variance) / mean; // coefficient of variation — low = robotic

    let mouseEntropy = 0;
    if (this.mouseEntropy.length > 10) {
      const dists = [];
      for (let i = 1; i < this.mouseEntropy.length; i++) {
        const dx = this.mouseEntropy[i].x - this.mouseEntropy[i - 1].x;
        const dy = this.mouseEntropy[i].y - this.mouseEntropy[i - 1].y;
        dists.push(Math.sqrt(dx * dx + dy * dy));
      }
      const mMean = dists.reduce((a, b) => a + b, 0) / dists.length;
      mouseEntropy = dists.reduce((s, v) => s + Math.abs(v - mMean), 0) / dists.length;
    }

    return {
      typing_consistency: parseFloat(cv.toFixed(4)),
      typing_mean_interval_ms: parseFloat(mean.toFixed(0)),
      mouse_entropy: parseFloat(mouseEntropy.toFixed(2)),
      sample_count: this.keyTimings.length,
    };
  }
}