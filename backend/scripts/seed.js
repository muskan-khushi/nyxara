/**
 * Nyxara Seed Script
 * Creates demo admin user, sample accounts, transactions, and alerts.
 * Usage: npm run seed
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const crypto   = require("crypto");

// ── Models ────────────────────────────────────────────────────
const User     = require("../models/User");
const Account  = require("../models/Account");
const Alert    = require("../models/Alert");
const AuditLog = require("../models/AuditLog");

// ── Config ────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/nyxara";

// ── Demo Data ─────────────────────────────────────────────────
const BANKS = [
  "State Bank of India", "HDFC Bank", "ICICI Bank", "Punjab National Bank",
  "Bank of Baroda", "Canara Bank", "Axis Bank", "Kotak Mahindra Bank",
  "Union Bank of India", "IndusInd Bank",
];

const IFSC_PREFIXES = ["SBIN", "HDFC", "ICIC", "PUNB", "BARB", "CNRB", "UTIB", "KKBK", "UBIN", "INDB"];

const NAMES = [
  "Aarav Sharma", "Priya Patel", "Rohan Gupta", "Sneha Iyer", "Vikram Singh",
  "Ananya Reddy", "Karan Mehta", "Diya Nair", "Arjun Joshi", "Meera Rao",
  "Siddharth Verma", "Kavya Agarwal", "Amit Kumar", "Riya Chopra", "Nikhil Bhatt",
  "Pooja Malhotra", "Rahul Saxena", "Ishita Das", "Manish Tiwari", "Tanvi Kulkarni",
];

const OCCUPATIONS = [
  "Salaried", "Self-employed", "Student", "Housewife", "Retired", "Unemployed",
  "Business Owner", "Freelancer",
];

const BRANCHES = ["MUM001", "DEL002", "BLR003", "CHN004", "HYD005", "KOL006", "PUN007", "AHM008"];

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max)); }
function pick(arr) { return arr[randInt(0, arr.length)]; }

function generateAccountId() {
  return `ACC${randInt(100000, 999999)}`;
}

function generateFeatures(occupation, isSuspicious) {
  const base = {};
  // Core banking features (subset that the AI engine cares about)
  base.F115  = rand(0, isSuspicious ? 1 : 0.3);        // Transaction velocity anomaly
  base.F321  = rand(0, isSuspicious ? 0.95 : 0.2);      // Balance volatility
  base.F527  = rand(0, isSuspicious ? 0.98 : 0.15);     // Pass-through ratio
  base.F1042 = rand(0, isSuspicious ? 0.9 : 0.1);       // Rapid deposit-withdrawal
  base.F2082 = isSuspicious ? rand(0, 3) : 0;           // International exposure
  base.F2122 = rand(0, isSuspicious ? 0.8 : 0.1);       // Structuring indicator
  base.F3043 = isSuspicious ? null : rand(1, 10);       // Account age (years)
  base.F3836 = rand(1000, isSuspicious ? 5000000 : 200000); // Amount involved
  base.F3889 = pick(BRANCHES);                          // Branch code
  base.F3891 = occupation;                              // Occupation
  base.F3924 = isSuspicious ? 1 : 0;                    // Ground truth label

  // Fill a few more numbered features to make it realistic
  for (let i = 0; i < 15; i++) {
    const fNum = randInt(100, 3900);
    if (!base[`F${fNum}`]) base[`F${fNum}`] = rand(0, 1);
  }
  return base;
}

// ── Seed Function ─────────────────────────────────────────────
async function seed() {
  console.log("\n🔮 Nyxara Seed Script");
  console.log("━".repeat(50));

  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Account.deleteMany({}),
    Alert.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log("🗑️  Cleared existing data");

  // ── Create Admin User ─────────────────────────────────────
  const adminHash = await bcrypt.hash("nyxara2026", 12);
  await User.create({
    email: "admin@nyxara.ai",
    passwordHash: adminHash,
    role: "admin",
    name: "Demo Admin",
  });
  console.log("👤 Created admin user: admin@nyxara.ai / nyxara2026");

  // Also create an analyst user
  const analystHash = await bcrypt.hash("analyst123", 12);
  await User.create({
    email: "analyst@nyxara.ai",
    passwordHash: analystHash,
    role: "analyst",
    name: "Riya Analyst",
  });
  console.log("👤 Created analyst user: analyst@nyxara.ai / analyst123");

  // ── Create Demo Accounts ──────────────────────────────────
  const accounts = [];
  const decisions = ["APPROVE", "REVIEW", "FLAG", "BLOCK"];
  const decisionWeights = [0.55, 0.20, 0.15, 0.10]; // Realistic distribution

  for (let i = 0; i < NAMES.length; i++) {
    const name = NAMES[i];
    const occupation = pick(OCCUPATIONS);
    const bankIdx = i % BANKS.length;

    // Determine if this account should be suspicious
    const roll = Math.random();
    let decision, riskScore;
    let cumulative = 0;
    for (let d = 0; d < decisions.length; d++) {
      cumulative += decisionWeights[d];
      if (roll <= cumulative) {
        decision = decisions[d];
        break;
      }
    }
    decision = decision || "APPROVE";

    // Generate risk score based on decision
    switch (decision) {
      case "APPROVE": riskScore = rand(0.05, 0.39); break;
      case "REVIEW":  riskScore = rand(0.40, 0.69); break;
      case "FLAG":    riskScore = rand(0.70, 0.84); break;
      case "BLOCK":   riskScore = rand(0.85, 0.99); break;
    }

    const isSuspicious = decision === "FLAG" || decision === "BLOCK";
    const features = generateFeatures(occupation, isSuspicious);
    const accountId = generateAccountId();

    const gnnScore      = riskScore + rand(-0.1, 0.1);
    const ensembleScore = riskScore + rand(-0.08, 0.08);
    const vaeScore      = riskScore + rand(-0.15, 0.15);
    const beiScore      = isSuspicious ? rand(0.3, 0.9) : rand(0.0, 0.3);
    const graphScore    = isSuspicious ? rand(0.2, 0.7) : rand(0.0, 0.2);

    const shapFactors = [
      { feature: "F527",  shap_value: isSuspicious ? rand(0.1, 0.4) : rand(-0.1, 0.05), raw_value: features.F527, direction: isSuspicious ? "risk" : "safe" },
      { feature: "F115",  shap_value: isSuspicious ? rand(0.05, 0.3) : rand(-0.15, 0.02), raw_value: features.F115, direction: isSuspicious ? "risk" : "safe" },
      { feature: "F321",  shap_value: rand(-0.05, 0.2), raw_value: features.F321, direction: features.F321 > 0.5 ? "risk" : "safe" },
      { feature: "F3891", shap_value: occupation === "Student" ? 0.15 : -0.05, raw_value: occupation, direction: occupation === "Student" ? "risk" : "safe" },
      { feature: "F1042", shap_value: rand(-0.1, 0.15), raw_value: features.F1042, direction: features.F1042 > 0.5 ? "risk" : "safe" },
    ];

    const alertText = isSuspicious
      ? `Account ${accountId} (${name}) flagged: High pass-through ratio (${(features.F527 * 100).toFixed(1)}%), ${occupation} with anomalous transaction velocity. Ring membership: ${isSuspicious ? "suspected" : "none"}.`
      : null;

    const account = await Account.create({
      accountId,
      features,
      riskScore: Math.max(0, Math.min(1, riskScore)),
      decision,
      gnnScore:      Math.max(0, Math.min(1, gnnScore)),
      ensembleScore: Math.max(0, Math.min(1, ensembleScore)),
      vaeScore:      Math.max(0, Math.min(1, vaeScore)),
      beiScore:      Math.max(0, Math.min(1, beiScore)),
      graphScore:    Math.max(0, Math.min(1, graphScore)),
      ringMembership: isSuspicious && Math.random() > 0.4,
      communityFraudRate: isSuspicious ? rand(0.3, 0.8) : rand(0, 0.15),
      shap: shapFactors,
      alertText,
      overrideApplied: false,
      lastAnalyzed: new Date(Date.now() - randInt(0, 7 * 24 * 60 * 60 * 1000)), // Last 7 days
    });

    accounts.push(account);
  }
  console.log(`📊 Created ${accounts.length} demo accounts`);

  // ── Create Alerts for flagged/blocked accounts ─────────────
  const alertAccounts = accounts.filter(a => ["REVIEW", "FLAG", "BLOCK"].includes(a.decision));
  const alerts = [];

  for (const account of alertAccounts) {
    const alert = await Alert.create({
      accountId: account.accountId,
      decision: account.decision,
      riskScore: account.riskScore,
      alertText: account.alertText || `Risk score ${(account.riskScore * 100).toFixed(1)}% — requires review.`,
      cyberFlags: account.beiScore > 0.5
        ? ["High device velocity", "Timezone mismatch"]
        : [],
      analystAction: Math.random() > 0.6 ? pick(["confirmed", "dismissed", "escalated"]) : null,
      analystNote: Math.random() > 0.7 ? "Reviewed during routine scan." : null,
      analystId: Math.random() > 0.7 ? "demo-admin" : null,
      createdAt: new Date(Date.now() - randInt(0, 5 * 24 * 60 * 60 * 1000)),
    });
    alerts.push(alert);
  }
  console.log(`🚨 Created ${alerts.length} alerts`);

  // ── Create Audit Log entries ───────────────────────────────
  for (const account of accounts.slice(0, 12)) {
    const hash = crypto.createHash("sha256")
      .update(`${account.accountId}|${account.riskScore}|${account.decision}|${Date.now()}`)
      .digest("hex");

    await AuditLog.create({
      accountId: account.accountId,
      decision: account.decision,
      riskScore: account.riskScore,
      decisionHash: hash,
      merkleLeafHash: crypto.createHash("sha256").update(hash).digest("hex"),
      blockchainBatchId: `BATCH-${randInt(1, 5)}`,
    });
  }
  console.log("🔗 Created audit log entries\n");

  // ── Summary ────────────────────────────────────────────────
  console.log("━".repeat(50));
  console.log("✨ Seed complete!\n");
  console.log("  Login credentials:");
  console.log("  ├─ Admin:   admin@nyxara.ai / nyxara2026");
  console.log("  └─ Analyst: analyst@nyxara.ai / analyst123\n");

  const counts = {};
  for (const a of accounts) counts[a.decision] = (counts[a.decision] || 0) + 1;
  console.log("  Account distribution:");
  for (const [decision, count] of Object.entries(counts)) {
    console.log(`  ├─ ${decision}: ${count}`);
  }
  console.log(`  └─ Total: ${accounts.length}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
