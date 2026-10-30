
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  ClipboardList,
  ArrowLeft,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function OfficerLogin() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        username,
        password,
      });

      if (response.data.role !== "officer") {
        setError("Access denied. Local officer account required.");
        return;
      }

      sessionStorage.setItem("officer_token", response.data.access_token);
      router.push("/officer/dashboard");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.detail || "Unable to connect to the server."
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-orange-600"
        >
          <ArrowLeft size={17} />
          Back to homepage
        </Link>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
            <ClipboardList size={34} />
          </div>

          <h1 className="text-3xl font-bold text-slate-800">
            NashaMukt
          </h1>

          <p className="mt-2 text-slate-500">
            Local Officer Investigation Portal
          </p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-lg">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-slate-800">
              Officer Login
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Sign in to access your assigned reports and investigations.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Officer Username
              </label>

              <div className="flex items-center rounded-xl border border-slate-300 px-4 focus-within:border-orange-500">
                <User size={19} className="text-slate-400" />

                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter officer username"
                  autoComplete="username"
                  className="w-full bg-transparent p-3 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Password
              </label>

              <div className="flex items-center rounded-xl border border-slate-300 px-4 focus-within:border-orange-500">
                <Lock size={19} className="text-slate-400" />

                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full bg-transparent p-3 outline-none"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-slate-400"
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-orange-600 py-3 font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Officer Sign In"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={16} />
            Authorized officers only
          </div>
        </div>
      </div>
    </main>
  );
}
