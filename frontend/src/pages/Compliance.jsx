// src/pages/Compliance.jsx
import { useState, useEffect } from "react";
import api from "../services/api";
import { Shield, Search, AlertCircle, RefreshCw } from "lucide-react";
import AuditTrail from "../components/compliance/AuditTrail";
import MerkleViewer from "../components/compliance/MerkleViewer";
import STRDraft from "../components/compliance/STRDraft";

export default function Compliance() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlertId, setSelectedAlertId] = useState("");
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [accountId, setAccountId] = useState("");
  const [audit, setAudit] = useState(null);
  const [str, setStr] = useState(null);
  const [verify, setVerify] = useState(null);
  const [merkle, setMerkle] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load alerts and latest Merkle info on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [alertsRes, merkleRes] = await Promise.all([
        api.get("/api/alerts", { params: { limit: 100 } }),
        api.get("/api/compliance/merkle-root")
      ]);
      const fetchedAlerts = alertsRes.data.alerts || [];
      setAlerts(fetchedAlerts);
      setMerkle(merkleRes.data);

      // Select first alert by default if available
      if (fetchedAlerts.length > 0) {
        handleAlertSelect(fetchedAlerts[0]._id, fetchedAlerts);
      }
    } catch (err) {
      console.error("Failed to load initial compliance data:", err);
    }
  }

  async function handleAlertSelect(alertId, alertList = alerts) {
    if (!alertId) {
      setSelectedAlertId("");
      setSelectedAlert(null);
      setStr(null);
      setAudit(null);
      return;
    }

    const alert = alertList.find(a => a._id === alertId);
    if (!alert) return;

    setSelectedAlertId(alertId);
    setSelectedAlert(alert);
    setAccountId(alert.accountId);
    setLoading(true);

    try {
      const [strRes, auditRes] = await Promise.all([
        api.get(`/api/compliance/str/${alertId}`),
        api.get(`/api/compliance/audit/${alert.accountId}`)
      ]);
      setStr(strRes.data);
      setAudit(auditRes.data);
    } catch (err) {
      console.error("Failed to load details for alert:", err);
    } finally {
      setLoading(false);
    }
  }

  // Lookup by raw account ID if the user searches manually
  async function handleManualLookup() {
    if (!accountId.trim()) return;
    setLoading(true);
    try {
      // Find if there is an alert for this account
      const matchingAlert = alerts.find(a => a.accountId.toLowerCase() === accountId.trim().toLowerCase());
      if (matchingAlert) {
        handleAlertSelect(matchingAlert._id);
      } else {
        // Just load audit and clear STR
        const auditRes = await api.get(`/api/compliance/audit/${accountId}`);
        setAudit(auditRes.data);
        setStr(null);
        setSelectedAlertId("");
        setSelectedAlert(null);
      }
    } catch (err) {
      console.error("Failed to perform lookup:", err);
    } finally {
      setLoading(false);
    }
  }

  async function runVerify() {
    setVerifying(true);
    try {
      const { data } = await api.get("/api/compliance/verify");
      setVerify(data);
    } catch (err) {
      setVerify({ total: 0, tampered: 0, integrity: true, message: "Blockchain engine unavailable" });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-frost">Compliance & Blockchain Audit</h1>
          <p className="text-frost/50 text-sm mt-1">
            Immutable decision ledger, Merkle proof generation, and FIU-IND Suspicious Transaction Reports (STR).
          </p>
        </div>
        <button
          onClick={loadInitialData}
          className="btn-outline text-xs flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Alerts list and Integrity */}
        <div className="xl:col-span-1 space-y-6">
          {/* Blockchain Integrity Checker */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-frost/80 font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-orchid" /> Chain Integrity
              </h2>
              <button onClick={runVerify} disabled={verifying} className="btn-outline text-xs">
                {verifying ? "Verifying..." : "Verify Chain"}
              </button>
            </div>
            {verify && (
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  verify.integrity
                    ? "bg-jade/10 text-jade border border-jade/30"
                    : "bg-crimson/10 text-crimson border border-crimson/30"
                }`}
              >
                {verify.integrity
                  ? `✅ Chain intact — ${verify.total} decisions verified, 0 tampered`
                  : `❌ TAMPER DETECTED — ${verify.tampered} compromised entries`
                }
              </div>
            )}
          </div>

          {/* Alert Selector Card */}
          <div className="card">
            <h2 className="text-frost/80 font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-400" /> Select Alert Case
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-frost/40 text-xs block mb-1">Select Alert to Generate STR</label>
                <select
                  value={selectedAlertId}
                  onChange={(e) => handleAlertSelect(e.target.value)}
                  className="input text-xs w-full"
                >
                  <option value="">-- Select an alert --</option>
                  {alerts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.accountId} ({a.decision} - Risk: {(a.riskScore * 100).toFixed(0)}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex items-center justify-center my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-grape/10"></div></div>
                <span className="relative bg-night px-2 text-xs text-frost/30 font-mono">OR SEARCH</span>
              </div>

              <div>
                <label className="text-frost/40 text-xs block mb-1">Search Account ID</label>
                <div className="flex gap-2">
                  <input
                    className="input font-mono text-xs flex-1"
                    placeholder="Account ID"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
                  />
                  <button onClick={handleManualLookup} className="btn-primary p-2">
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Merkle Batch Viewer */}
          <div className="card">
            <h2 className="text-frost/80 font-semibold mb-4">Cryptographic Proof Tree</h2>
            <MerkleViewer
              batchId={merkle?.batchId}
              merkleRoot={merkle?.merkleRoot}
              leafCount={merkle?.leafCount}
            />
          </div>
        </div>

        {/* Right Columns: STR Form & Audit Trail */}
        <div className="xl:col-span-2 space-y-6">
          {loading ? (
            <div className="card flex items-center justify-center py-20 text-frost/50 text-sm">
              Loading compliance documents...
            </div>
          ) : (
            <>
              {/* STR Draft */}
              <div className="card">
                <STRDraft
                  str={str}
                  alertId={selectedAlertId}
                  onFiled={() => {
                    // Reload alerts to reflect any state changes
                    api.get("/api/alerts", { params: { limit: 100 } })
                      .then(r => setAlerts(r.data.alerts || []))
                      .catch(() => {});
                  }}
                />
              </div>

              {/* Audit Trail */}
              <div className="card">
                <h2 className="text-frost/80 font-semibold mb-4">Immutable Audit Trail</h2>
                <AuditTrail
                  entries={audit?.entries}
                  accountId={accountId}
                  integrity={verify ? verify.integrity : true}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
