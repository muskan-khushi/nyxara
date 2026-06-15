// src/services/mockData.js

const mockAlerts = [
  { _id: "alert_01", alertId: "alert_01", accountId: "acc_demo_01", riskScore: 0.94, decision: "BLOCK", riskFactors: ["High Velocity", "Dark Web IP"], createdAt: new Date().toISOString() },
  { _id: "alert_02", alertId: "alert_02", accountId: "acc_demo_02", riskScore: 0.81, decision: "FLAG", riskFactors: ["Anomalous Location", "New Device"], createdAt: new Date(Date.now() - 3600000).toISOString() },
  { _id: "alert_03", alertId: "alert_03", accountId: "acc_demo_03", riskScore: 0.65, decision: "REVIEW", riskFactors: ["Structuring Patterns"], createdAt: new Date(Date.now() - 7200000).toISOString() }
];

export const mockEndpoints = {
  "/api/auth/login": {
    data: { token: "demo-mock-token", user: { id: "1", name: "Demo Admin", role: "admin" } }
  },
  "/api/admin/stats": {
    data: { counts: { total: 12450, blocked: 432, flagged: 856, review: 124, approved: 11038 } }
  },
  "/api/accounts": {
    data: { accounts: [{ accountId: "acc_demo_01", riskScore: 0.94, decision: "BLOCK", balance: 54000, txCount: 142 }] }
  },
  "/api/admin/evaluate": {
    data: { auc: 0.982, f1: 0.91, precision: 0.94, recall: 0.89 }
  },
  "/api/alerts": {
    data: { alerts: mockAlerts }
  },
  "/api/accounts/analyze": {
    data: { 
      result: { 
        accountId: "acc_new_demo", 
        riskScore: 0.98, 
        decision: "BLOCK", 
        riskFactors: ["Rapid Transfer", "Known Fraud Entity"],
        graphData: { nodes: [], edges: [] }
      } 
    }
  },
  "/api/rings": {
    data: { 
      rings: [
        { id: "ring_1", entities: ["acc_10", "acc_21", "acc_33"], totalVolume: 145000, riskScore: 0.96 }
      ] 
    }
  },
  "/api/clusters": {
    data: { 
      clusters: [
        { id: "cluster_1", nodeCount: 12, edgeCount: 38, density: 0.85, risk: "HIGH" }
      ] 
    }
  },
  "/api/compliance/merkle-root": {
    data: { root: "0x8f3c7a2b9d0e...demo", timestamp: new Date().toISOString() }
  },
  "/api/compliance/verify": {
    data: { verified: true, matchCount: 8 }
  }
};

// Dynamic path matchers
export const getMockResponse = (url) => {
  // Exact match
  if (mockEndpoints[url]) return mockEndpoints[url];

  // Pattern matches
  if (url.includes("/api/alerts/") && url.includes("/action")) {
    return { data: { success: true } };
  }
  if (url.includes("/api/compliance/str/")) {
    return { data: { title: "STR-DEMO-001", details: "Suspicious pattern detected matching money laundering typology." } };
  }
  if (url.includes("/api/compliance/audit/")) {
    return { 
      data: { 
        logs: [
          { action: "SYSTEM_FLAG", timestamp: new Date(Date.now() - 86400000).toISOString(), user: "AI Engine", details: "Risk exceeded 0.8" },
          { action: "REVIEW", timestamp: new Date().toISOString(), user: "Demo Admin", details: "Manual review initiated." }
        ] 
      } 
    };
  }

  // Fallback
  return { data: { success: true, message: "Mock Fallback Response" } };
};

export const getMockLiveAlert = () => {
  const id = "demo_live_" + Math.floor(Math.random() * 10000);
  return {
    _id: id,
    alertId: id,
    accountId: "acc_demo_" + Math.floor(Math.random() * 999),
    riskScore: 0.8 + Math.random() * 0.2,
    decision: Math.random() > 0.5 ? "BLOCK" : "FLAG",
    riskFactors: ["Synthetic Identity", "Velocity Spike"],
    createdAt: new Date().toISOString()
  };
};
