// services/aiService.js
const axios = require("axios");

const AI_URL = process.env.AI_ENGINE_URL || "http://localhost:8001";
const TIMEOUT = 30000; // 30s — GNN inference can be slow first call

async function score(payload) {
  try {
    const { data } = await axios.post(`${AI_URL}/v1/score`, payload, { timeout: TIMEOUT });
    return data;
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      throw new Error("AI Engine is not running. Start it with: cd ai-engine && uvicorn main:app --port 8001");
    }
    throw new Error(`AI Engine error: ${err.response?.data?.detail || err.message}`);
  }
}

async function getMetrics() {
  const { data } = await axios.get(`${AI_URL}/v1/metrics`, { timeout: 5000 });
  return data;
}

async function getRings() {
  const { data } = await axios.get(`${AI_URL}/v1/rings`, { timeout: 5000 });
  return data;
}

async function getClusters() {
  const { data } = await axios.get(`${AI_URL}/v1/clusters`, { timeout: 5000 });
  return data;
}

module.exports = { score, getMetrics, getRings, getClusters };