// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Shield, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [email, setEmail]       = useState("admin@nyxara.ai");
  const [password, setPassword] = useState("nyxara2026");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-night flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-grape/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-grape/20 border border-grape/40 mb-4 glow-grape">
            <Shield className="w-8 h-8 text-orchid" />
          </div>
          <h1 className="text-3xl font-bold text-frost">
            Nyx<span className="text-orchid">ara</span>
          </h1>
          <p className="text-frost/50 mt-1 text-sm">Intelligence Platform for Mule Account Detection</p>
        </div>

        {/* Form */}
        <div className="card">
          <h2 className="text-lg font-semibold text-frost mb-6">Sign in to your account</h2>

          {error && (
            <div className="bg-crimson/10 border border-crimson/30 text-crimson rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-frost/70 text-sm mb-1 block">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div>
              <label className="text-frost/70 text-sm mb-1 block">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-frost/40 hover:text-frost/80"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2 disabled:opacity-50">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-frost/30 text-xs text-center mt-4">
            Demo: admin@nyxara.ai / nyxara2026
          </p>
        </div>
      </div>
    </div>
  );
}
