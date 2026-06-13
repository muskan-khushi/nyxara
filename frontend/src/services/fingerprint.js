// src/services/fingerprint.js
// Browser Entropy Index (BEI) — device signal collection for cybersec engine

export async function collectDeviceSignal() {
  const signals = {};

  // Canvas fingerprint
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#7B2FBE";
    ctx.fillText("Nyxara🔮BEI", 2, 2);
    ctx.fillStyle = "rgba(192,132,252,0.5)";
    ctx.fillRect(50, 1, 62, 20);
    signals.canvas_fp = canvas.toDataURL().slice(-32);
  } catch {}

  // WebGL renderer
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    if (ext) {
      signals.webgl_renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      signals.webgl_vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
    }
  } catch {}

  // Screen & timezone
  signals.screen_width = window.screen.width;
  signals.screen_height = window.screen.height;
  signals.screen_color_depth = window.screen.colorDepth;
  signals.pixel_ratio = window.devicePixelRatio;
  signals.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  signals.language = navigator.language;
  signals.platform = navigator.platform;
  signals.cookie_enabled = navigator.cookieEnabled;
  signals.do_not_track = navigator.doNotTrack;

  // Audio fingerprint
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
      signals.audio_fp = data.slice(0, 32).reduce((a, b) => a + b, 0).toFixed(6);
      oscillator.stop();
      ac.close();
    }
  } catch {}

  // Touch & connection
  signals.max_touch_points = navigator.maxTouchPoints;
  signals.connection_type = navigator.connection?.effectiveType || "unknown";
  signals.hardware_concurrency = navigator.hardwareConcurrency;
  signals.device_memory = navigator.deviceMemory;

  // Session timing (behavioral signal)
  signals.session_start = Date.now();
  signals.user_agent_hash = await hashString(navigator.userAgent);

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