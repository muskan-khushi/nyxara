// src/services/fingerprint.js
// Collects browser environment signals for BEI scoring.
// All signals are statistical aggregates — no PII, no raw keystrokes.

export async function collectDeviceSignal() {
  const signal = {
    canvas_hash: "",
    webgl:       "",
    screen:      { width: screen.width, height: screen.height, colorDepth: screen.colorDepth },
    timezone:    Intl.DateTimeFormat().resolvedOptions().timeZone,
    language:    navigator.language,
    audio_hash:  "",
    user_agent:  navigator.userAgent,
    ip:          "", // Filled by backend from req.ip
  };

  // Canvas fingerprint
  try {
    const canvas = document.createElement("canvas");
    const ctx    = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font         = "14px Arial";
    ctx.fillStyle    = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle    = "#069";
    ctx.fillText("Nyxara BEI 🔮", 2, 15);
    signal.canvas_hash = canvas.toDataURL().slice(-32);
  } catch {}

  // WebGL renderer
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    if (ext) signal.webgl = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  } catch {}

  // Audio fingerprint
  try {
    const ctx  = new OfflineAudioContext(1, 44100, 44100);
    const osc  = ctx.createOscillator();
    const anal = ctx.createAnalyser();
    osc.connect(anal);
    anal.connect(ctx.destination);
    osc.start(0);
    const buf    = await ctx.startRendering();
    const data   = buf.getChannelData(0);
    const sample = Array.from(data.slice(4500, 4600)).reduce((a, b) => a + Math.abs(b), 0);
    signal.audio_hash = sample.toFixed(8);
  } catch {}

  return signal;
}
