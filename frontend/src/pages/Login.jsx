// src/pages/Login.jsx
// Nyxara authentication screen

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials. Try admin@nyxara.ai / nyxara2026");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-night flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ width: "600px", height: "400px", background: "radial-gradient(ellipse, rgba(123,47,190,0.10) 0%, transparent 70%)" }}
      />

      {/* Card */}
      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-grape/20 border border-grape/40 mb-4">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 1L20 6.5V16.5L11 22L2 16.5V6.5L11 1Z" stroke="#C084FC" strokeWidth="1.3" fill="none"/>
              <circle cx="11" cy="11" r="3.5" fill="#C084FC" fillOpacity="0.7"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Nyx<span className="text-orchid">ara</span></h1>
          <p className="text-frost/40 text-sm mt-1">Intelligence Platform</p>
        </div>

        <div className="card border-grape/25">
          <h2 className="text-frost/80 font-semibold text-base mb-5">Sign in to continue</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-frost/40 text-xs mb-1.5 block uppercase tracking-wider">Email</label>
              <input
                type="email"
                className="input"
                placeholder="analyst@nyxara.ai"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-frost/40 text-xs mb-1.5 block uppercase tracking-wider">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-crimson/8 border border-crimson/25 rounded-lg px-3 py-2.5 text-crimson text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : "Sign In"}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-4 pt-4 border-t border-grape/10">
            <p className="text-frost/25 text-xs text-center">Demo credentials</p>
            <button
              type="button"
              onClick={() => { setEmail("admin@nyxara.ai"); setPassword("nyxara2026"); }}
              className="w-full mt-1.5 text-center text-orchid/50 hover:text-orchid text-xs transition-colors font-mono"
            >
              admin@nyxara.ai · nyxara2026
            </button>
          </div>
        </div>

        <p className="text-center mt-5 text-frost/20 text-xs">
          <Link to="/" className="hover:text-frost/40 transition-colors">← Back to overview</Link>
        </p>
      </div>
    </div>
  );
}