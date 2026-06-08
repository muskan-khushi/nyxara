// services/cyberService.js
const axios = require("axios");
const CYBER_URL = process.env.CYBER_ENGINE_URL || "http://localhost:8002";

async function scoreDevice(deviceSignal) {
  try {
    const { data } = await axios.post(`${CYBER_URL}/v1/bei`, deviceSignal, { timeout: 5000 });
    return data;
  } catch {
    // Cybersec engine offline — return neutral score, don't fail the whole pipeline
    return { bei_risk_score: 0.0, flags: [], error: "Cybersec engine unavailable" };
  }
}

module.exports = { scoreDevice };