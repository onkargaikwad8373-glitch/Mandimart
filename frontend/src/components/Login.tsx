import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Sprout, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "../context/LanguageContext";

export default function Login() {
  const { login, error, setError } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans" id="login-screen-root">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-200 mb-4 animate-fade-in" id="login-logo-container">
          <Sprout className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight" id="login-title">
          MandiMate
        </h2>
        <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto" id="login-subtitle">
          Wholesale Vegetable Management Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-100 rounded-2xl border border-slate-100 sm:px-10" id="login-card">
          <form className="space-y-6" onSubmit={handleSubmit} id="login-form">
            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-sm text-rose-800 flex items-start gap-2.5 animate-shake" id="login-error-alert">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Email Address
              </label>
              <div className="mt-1.5 relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-sm"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Password
              </label>
              <div className="mt-1.5 relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                id="login-submit-button"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <span className="text-xs font-medium text-slate-400 block">
              MandiMate Wholesale Management System
            </span>
          </div>
        </div>
        
        {/* Developer / Demo Tip */}
        <div className="mt-4 text-center">
          <div className="inline-block bg-emerald-50/50 border border-emerald-100/50 rounded-xl px-4 py-2.5 text-slate-500 text-xs text-center max-w-sm">
            <span className="font-bold text-emerald-700 block mb-0.5">Owner Account (Pre-configured)</span>
            Email: <span className="font-mono font-bold text-slate-700">owner@mandimate.com</span> | Password: <span className="font-mono font-bold text-slate-700">owner123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
