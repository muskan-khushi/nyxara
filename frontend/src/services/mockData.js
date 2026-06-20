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
      accountId: "ACC-MOCK-DEMO", 
      finalRisk: 0.98, 
      decision: "BLOCK", 
      riskFactors: ["Rapid Transfer", "Known Fraud Entity"],
      ringMembership: true,
      scores: { gnn: 0.96, ensemble: 0.94, vae: 0.88, bei: 0.72, graph: 0.99 },
      shap: [
        { feature: "F3836_Avg_Txn", shap_value: 0.42, raw_value: 450000 },
        { feature: "F3894_Velocity", shap_value: 0.38, raw_value: 85 },
        { feature: "F527_PassThrough", shap_value: 0.31, raw_value: 0.94 },
        { feature: "F1692_LinkedDevices", shap_value: 0.25, raw_value: 6 },
        { feature: "F3891_Occupation", shap_value: 0.18, raw_value: "student" },
        { feature: "F2956_Nocturnal", shap_value: 0.15, raw_value: 0.45 },
        { feature: "F3043_AccountAge", shap_value: -0.05, raw_value: 25 }
      ],
      graphData: { nodes: [], edges: [] }
    }
  },
  "/api/rings": {
    data: { 
      rings: [
        { 
          ring_id: "ring_smurf_01", 
          accounts: ["acc_101", "acc_102", "acc_103", "acc_104", "hub_master_1"], 
          fraud_rate: 0.96,
          shape: "STAR",
          hub_node: "hub_master_1",
          roles: { "hub_master_1": "hub", "acc_101": "mule", "acc_102": "mule", "acc_103": "mule", "acc_104": "mule" }
        },
        { 
          ring_id: "ring_cycle_02", 
          accounts: ["cyc_1", "cyc_2", "cyc_3", "cyc_4"], 
          fraud_rate: 0.88,
          shape: "CYCLE"
        },
        { 
          ring_id: "ring_chain_03", 
          accounts: ["chn_1", "chn_2", "chn_3"], 
          fraud_rate: 0.75,
          shape: "CHAIN"
        }
      ] 
    }
  },
  "/api/clusters": {
    data: { 
      clusters: [
        { cluster_id: "comm_01", node_count: 24, edge_count: 58, fraud_rate: 0.85 },
        { cluster_id: "comm_02", node_count: 12, edge_count: 18, fraud_rate: 0.42 },
        { cluster_id: "comm_03", node_count: 45, edge_count: 112, fraud_rate: 0.92 }
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
    return { 
      data: { 
        reporting_entity: "Nyxara FinSec Platform",
        firc_code: "FIRC-IND-8002",
        account_id: "ACC-MOCK-DEMO",
        customer_occupation: "Student",
        account_type: "Savings",
        str_type: "mule_network",
        risk_score: 0.94,
        observation_period: "Last 90 Days",
        nature_of_suspicion: "Coordinated smurfing activity detected. High pass-through ratio and nocturnal transaction surges align with AI typologies for mule networking.",
        risk_indicators: ["High Velocity", "Synthetic Identity", "Pass-Through Ratio"],
        amount_involved: "₹1,45,000",
        audit_hash: "0x8f3c7a2b9d0e11a123f1",
        generated_at: new Date().toLocaleString()
      } 
    };
  }
  if (url.includes("/api/compliance/audit/")) {
    return { 
      data: { 
        entries: [
          { decision: "BLOCK", accountId: "ACC-MOCK-DEMO", riskScore: 0.94, timestamp: new Date().toISOString(), decisionHash: "0x4e2d...a1", merkleLeafHash: "0x98bb...c3", blockchainBatchId: "BATCH-891" },
          { decision: "FLAG", accountId: "ACC-MOCK-DEMO", riskScore: 0.72, timestamp: new Date(Date.now() - 86400000).toISOString(), decisionHash: "0x2a1b...d9", merkleLeafHash: "0x77aa...e2" }
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
