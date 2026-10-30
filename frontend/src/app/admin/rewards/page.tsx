
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Gift,
  IndianRupee,
  Users,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertCircle,
  Copy,
  ArrowLeft,
  Clock,
  Wallet,
  ShieldCheck,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type RewardSettings = {
  configured: boolean;
  amount: number;
  currency: string;
  updated_at?: string | null;
};

type EligibleReport = {
  report_id: string;
  tracking_reference: string;
  category?: string;
  status: string;
  completed_at?: string | null;
};

type Reward = {
  reward_id: string;
  report_id: string;
  tracking_reference: string;
  amount: number;
  status: string;
  issued_at?: string | null;
  redeemed_at?: string | null;
  utr?: string | null;
};

type GrantResponse = {
  message: string;
  reward_code: string;
  tracking_reference: string;
  amount: number;
  currency: string;
  status: string;
  important?: string;
};

export default function AdminRewardsPage() {
  const router = useRouter();

  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("0");
  const [settingsConfigured, setSettingsConfigured] = useState(false);

  const [eligibleReports, setEligibleReports] = useState<EligibleReport[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [grantingId, setGrantingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [generatedReward, setGeneratedReward] =
    useState<GrantResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const getErrorMessage = (err: unknown) => {
    if (axios.isAxiosError(err)) {
      return (
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Something went wrong. Please try again."
      );
    }

    return "An unexpected error occurred.";
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);

  const formatDate = (value?: string | null) => {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const handleUnauthorized = () => {
    sessionStorage.removeItem("admin_token");
    router.replace("/admin/login");
  };

  const loadDashboard = useCallback(async (authToken: string) => {
    setLoading(true);
    setError("");

    const headers = {
      Authorization: `Bearer ${authToken}`,
    };

    try {
      const [settingsResponse, eligibleResponse, rewardsResponse] =
        await Promise.all([
          axios.get(`${API_URL}/admin/rewards/settings`, { headers }),
          axios.get(`${API_URL}/admin/rewards/eligible`, { headers }),
          axios.get(`${API_URL}/admin/rewards`, { headers }),
        ]);

      const settings = settingsResponse.data as RewardSettings;

      setSettingsConfigured(settings.configured);
      setAmount(String(settings.amount ?? 0));

      setEligibleReports(eligibleResponse.data.reports ?? []);
      setRewards(
        Array.isArray(rewardsResponse.data)
          ? rewardsResponse.data
          : rewardsResponse.data.rewards ?? []
      );
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleUnauthorized();
        return;
      }

      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedToken = sessionStorage.getItem("admin_token");

    if (!savedToken) {
      router.replace("/admin/login");
      return;
    }

    setToken(savedToken);
    void loadDashboard(savedToken);
  }, [router, loadDashboard]);

  const saveSettings = async () => {
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount < 1) {
      setError("Enter a valid reward amount of at least ₹1.");
      return;
    }

    if (parsedAmount > 100000) {
      setError("The reward amount cannot exceed ₹1,00,000.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await axios.put(
        `${API_URL}/admin/rewards/settings`,
        { amount: parsedAmount },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setAmount(String(response.data.amount));
      setSettingsConfigured(true);
      setMessage(response.data.message || "Reward settings saved successfully.");

      await loadDashboard(token);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleUnauthorized();
        return;
      }

      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const grantReward = async (report: EligibleReport) => {
    const confirmed = window.confirm(
      `Grant a reward to report ${report.tracking_reference} for ${formatCurrency(
        Number(amount)
      )}? The generated reward code will be shown only once.`
    );

    if (!confirmed) return;

    setGrantingId(report.report_id);
    setError("");
    setMessage("");
    setGeneratedReward(null);
    setCopied(false);

    try {
      const response = await axios.post(
        `${API_URL}/admin/rewards/${report.report_id}/grant`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setGeneratedReward(response.data);
      setMessage(response.data.message || "Reward granted successfully.");

      await loadDashboard(token);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleUnauthorized();
        return;
      }

      setError(getErrorMessage(err));
    } finally {
      setGrantingId(null);
    }
  };

  const copyRewardCode = async () => {
    if (!generatedReward?.reward_code) return;

    try {
      await navigator.clipboard.writeText(generatedReward.reward_code);
      setCopied(true);
      setMessage("Reward code copied successfully.");
    } catch {
      setError("Could not copy automatically. Please select and copy the code.");
    }
  };

  const statusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "bg-green-100 text-green-700";
      case "failed":
      case "reversed":
        return "bg-red-100 text-red-700";
      case "issued":
        return "bg-blue-100 text-blue-700";
      case "processing":
      case "pending":
      case "queued":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-5 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-100 p-3 text-purple-700">
              <Gift size={26} />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Reward Management
              </h1>
              <p className="text-sm text-slate-500">
                Manage citizen rewards and monitor payouts
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/admin/dashboard")}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={17} />
            Back to Dashboard
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-6 px-5 py-8">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {message && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <p>{message}</p>
          </div>
        )}

        {generatedReward && (
          <div className="rounded-xl border border-purple-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="text-purple-600" size={23} />
              <h2 className="text-lg font-bold text-slate-900">
                Reward Granted Successfully
              </h2>
            </div>

            <p className="mb-3 text-sm text-slate-600">
              Reward code for report{" "}
              <strong>{generatedReward.tracking_reference}</strong>
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1 break-all rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 p-4 text-center font-mono text-lg font-bold text-purple-800">
                {generatedReward.reward_code}
              </div>

              <button
                onClick={copyRewardCode}
                className="flex items-center justify-center gap-2 rounded-lg border border-purple-300 px-5 py-3 font-semibold text-purple-700 hover:bg-purple-50"
              >
                <Copy size={17} />
                {copied ? "Copied" : "Copy Code"}
              </button>
            </div>

            <p className="mt-4 text-sm font-semibold text-amber-700">
              Important: Save this code securely. It is displayed only once.
            </p>

            {generatedReward.important && (
              <p className="mt-1 text-sm text-slate-600">
                {generatedReward.important}
              </p>
            )}

            <button
              onClick={() => setGeneratedReward(null)}
              className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
            >
              Close
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Eligible Reports
              </p>
              <Users className="text-blue-600" size={22} />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {eligibleReports.length}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Rewards Granted
              </p>
              <Gift className="text-purple-600" size={22} />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {rewards.length}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Current Reward
              </p>
              <IndianRupee className="text-green-600" size={22} />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {formatCurrency(Number(amount) || 0)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2 text-green-700">
              <IndianRupee size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Reward Amount Settings
              </h2>
              <p className="text-sm text-slate-500">
                Set the amount citizens receive for an eligible report.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Reward Amount (INR)
              </label>
              <input
                type="number"
                min="1"
                max="100000"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter reward amount"
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-2 text-xs text-slate-500">
                Minimum ₹1 and maximum ₹1,00,000.
              </p>
            </div>

            <button
              onClick={saveSettings}
              disabled={saving || loading}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {saving ? "Saving..." : "Save Reward Amount"}
            </button>
          </div>

          <p className="mt-4 text-sm">
            {settingsConfigured ? (
              <span className="font-medium text-green-700">
                Reward amount is configured.
              </span>
            ) : (
              <span className="font-medium text-amber-700">
                Reward amount has not been configured yet.
              </span>
            )}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 sm:p-7">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Eligible Reports
              </h2>
              <p className="text-sm text-slate-500">
                Grant rewards to completed and verified reports.
              </p>
            </div>

            <button
              onClick={() => void loadDashboard(token)}
              disabled={loading || !token}
              className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
              <RefreshCw size={20} className="animate-spin" />
              Loading reward information...
            </div>
          ) : eligibleReports.length === 0 ? (
            <div className="rounded-lg bg-slate-50 py-12 text-center">
              <CheckCircle2
                className="mx-auto mb-3 text-green-600"
                size={34}
              />
              <p className="font-semibold text-slate-700">
                No eligible reports at the moment.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Completed and verified reports will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-600">
                    <th className="px-4 py-3 font-semibold">Tracking Reference</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Completed At</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {eligibleReports.map((report) => (
                    <tr
                      key={report.report_id}
                      className="border-b last:border-0"
                    >
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {report.tracking_reference}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {report.category || "Not specified"}
                      </td>

                      <td className="px-4 py-4">
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                          {report.status.replaceAll("_", " ")}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {formatDate(report.completed_at)}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => void grantReward(report)}
                          disabled={
                            !settingsConfigured ||
                            grantingId !== null ||
                            loading
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {grantingId === report.report_id ? (
                            <RefreshCw
                              size={16}
                              className="animate-spin"
                            />
                          ) : (
                            <Gift size={16} />
                          )}
                          {grantingId === report.report_id
                            ? "Granting..."
                            : "Grant Reward"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!settingsConfigured && !loading && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Configure and save the reward amount before granting rewards.
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-white p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <Wallet size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Granted Rewards and Payouts
              </h2>
              <p className="text-sm text-slate-500">
                View issued rewards and their payment status.
              </p>
            </div>
          </div>

          {loading ? (
            <p className="py-8 text-center text-slate-500">
              Loading rewards...
            </p>
          ) : rewards.length === 0 ? (
            <div className="rounded-lg bg-slate-50 py-10 text-center">
              <Gift
                className="mx-auto mb-3 text-slate-400"
                size={32}
              />
              <p className="font-semibold text-slate-700">
                No rewards have been granted yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-600">
                    <th className="px-4 py-3 font-semibold">Tracking Reference</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Issued At</th>
                    <th className="px-4 py-3 font-semibold">Redeemed At</th>
                    <th className="px-4 py-3 font-semibold">UTR</th>
                  </tr>
                </thead>

                <tbody>
                  {rewards.map((reward) => (
                    <tr
                      key={reward.reward_id}
                      className="border-b last:border-0"
                    >
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {reward.tracking_reference}
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {formatCurrency(reward.amount)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor(
                            reward.status
                          )}`}
                        >
                          {reward.status.toUpperCase()}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {formatDate(reward.issued_at)}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {formatDate(reward.redeemed_at)}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {reward.utr || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
          <Clock size={19} className="mt-0.5 shrink-0" />
          <p>
            <strong>Important:</strong> A reward code is generated when an
            administrator grants a reward. The code is displayed only once,
            so copy and securely share it with the correct citizen. Payment
            status is shown separately from reward issuance.
          </p>
        </div>
      </section>
    </main>
  );
}
