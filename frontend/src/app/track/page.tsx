
"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  FileSearch,
  LockKeyhole,
  AlertCircle,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type TrackingResult = {
  tracking_reference: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const statusSteps = [
  { value: "submitted", label: "Report Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "assigned", label: "Assigned to Officer" },
  { value: "investigation_in_progress", label: "Investigation in Progress" },
  { value: "investigation_submitted", label: "Investigation Submitted" },
  { value: "admin_verification", label: "Admin Verification" },
  { value: "action_completed", label: "Action Completed" },
];

export default function TrackPage() {
  const [reference, setReference] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TrackingResult | null>(null);

  async function handleTrack(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/reports/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tracking_reference: reference.trim(),
          tracking_secret: secret.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to find your report."
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  }

  const currentIndex = result
    ? statusSteps.findIndex((step) => step.value === result.status)
    : -1;

  const isFinalFailure =
    result?.status === "rejected" ||
    result?.status === "inconclusive";

  return (
    <main className="min-h-screen bg-[#f8f3eb] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 font-semibold text-[#304dbb]"
        >
          <ArrowLeft size={18} />
          Back to Home
        </Link>

        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="bg-gradient-to-r from-[#203879] to-[#3856bf] px-7 py-10 text-center text-white sm:px-12">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
              <FileSearch size={36} />
            </div>

            <h1 className="text-3xl font-extrabold sm:text-4xl">
              Track Your Report
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-blue-100">
              Check the latest status of your submitted report using
              your private tracking credentials.
            </p>
          </div>

          <div className="p-6 sm:p-10">
            {!result && (
              <form onSubmit={handleTrack} className="space-y-6">
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 font-bold text-[#203879]">
                    <LockKeyhole size={19} />
                    Secure report tracking
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Your report details are protected. Enter both
                    credentials received after submission.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Tracking Reference
                  </label>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    required
                    minLength={8}
                    maxLength={30}
                    placeholder="Example: NM-A1B2C3D4"
                    className="w-full rounded-xl border border-gray-300 px-4 py-4 outline-none focus:border-[#304dbb] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Private Tracking Secret
                  </label>
                  <input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    required
                    minLength={20}
                    maxLength={100}
                    placeholder="Enter your private tracking secret"
                    className="w-full rounded-xl border border-gray-300 px-4 py-4 outline-none focus:border-[#304dbb] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                  >
                    <AlertCircle size={19} className="mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ed650f] px-6 py-4 font-bold text-white transition hover:bg-[#d95708] disabled:opacity-60"
                >
                  <Search size={20} />
                  {loading ? "Checking Report..." : "Track My Report"}
                </button>
              </form>
            )}

            {result && (
              <div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                  <p className="text-sm text-gray-500">
                    Tracking reference
                  </p>
                  <p className="mt-2 break-all text-xl font-extrabold text-[#203879]">
                    {result.tracking_reference}
                  </p>

                  <div className="mt-5 flex items-center gap-2 text-sm font-bold text-[#304dbb]">
                    <Clock size={19} />
                    Current status
                  </div>
                  <p className="mt-2 text-lg font-bold capitalize text-[#203879]">
                    {result.status.replaceAll("_", " ")}
                  </p>
                </div>

                <h2 className="mb-6 mt-9 text-xl font-extrabold text-[#203879]">
                  Report Progress
                </h2>

                {isFinalFailure ? (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 text-orange-900">
                    <p className="font-bold capitalize">
                      Report {result.status}
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      The current report status is {result.status}.
                      Contact the appropriate authority through an
                      official channel if you need further clarification.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {statusSteps.map((step, index) => {
                      const completed =
                        currentIndex >= 0 && index <= currentIndex;
                      const active = index === currentIndex;

                      return (
                        <div key={step.value} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                completed
                                  ? "bg-green-600 text-white"
                                  : "bg-gray-100 text-gray-400"
                              }`}
                            >
                              {completed ? (
                                <CheckCircle2 size={21} />
                              ) : (
                                <span className="text-sm font-bold">
                                  {index + 1}
                                </span>
                              )}
                            </div>
                            {index !== statusSteps.length - 1 && (
                              <div
                                className={`h-12 w-0.5 ${
                                  completed ? "bg-green-500" : "bg-gray-200"
                                }`}
                              />
                            )}
                          </div>

                          <div className="pb-8 pt-1">
                            <p
                              className={`font-bold ${
                                active
                                  ? "text-[#304dbb]"
                                  : completed
                                    ? "text-green-700"
                                    : "text-gray-400"
                              }`}
                            >
                              {step.label}
                            </p>
                            {active && (
                              <p className="mt-1 text-xs text-gray-500">
                                Current report stage
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                  <p>
                    <strong>Submitted:</strong>{" "}
                    {new Date(result.created_at).toLocaleString()}
                  </p>
                  <p className="mt-2">
                    <strong>Last updated:</strong>{" "}
                    {new Date(result.updated_at).toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setResult(null);
                    setReference("");
                    setSecret("");
                    setError("");
                  }}
                  className="mt-6 w-full rounded-xl border border-[#304dbb] px-5 py-4 font-bold text-[#304dbb] transition hover:bg-blue-50"
                >
                  Track Another Report
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          NashaMukt · Say No to Drugs. Say Yes to Life.
        </p>
      </div>
    </main>
  );
}
