
"use client";

import { useState } from "react";
import axios from "axios";
import {
  Gift,
  Search,
  Copy,
  CheckCircle2,
  Clock,
  AlertCircle,
  Wallet,
  RefreshCw,
  ShieldCheck,
  IndianRupee,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type RewardStatus = {
  eligible?: boolean;
  reward_issued?: boolean;
  report_status?: string;
  amount?: number;
  currency?: string;
  status?: string;
  utr?: string | null;
  upi_id?: string | null;
  message?: string;
};

export default function CitizenRewardsPage() {
  const [trackingReference, setTrackingReference] = useState("");
  const [trackingSecret, setTrackingSecret] = useState("");

  const [rewardCode, setRewardCode] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [upiId, setUpiId] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");

  const [rewardStatus, setRewardStatus] =
    useState<RewardStatus | null>(null);

  const [checking, setChecking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [loadingPaymentStatus, setLoadingPaymentStatus] =
    useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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

  const checkReward = async () => {
    if (!trackingReference.trim() || !trackingSecret.trim()) {
      setError("Please enter your tracking reference and tracking secret.");
      return;
    }

    setChecking(true);
    setError("");
    setMessage("");
    setRewardCode("");
    setRewardStatus(null);
    setAmount(null);

    try {
      const response = await axios.post(
        `${API_URL}/reports/rewards/status`,
        {
          tracking_reference: trackingReference.trim(),
          tracking_secret: trackingSecret.trim(),
        }
      );

      setRewardStatus(response.data);

      if (response.data.reward_issued) {
        setAmount(response.data.amount);
      }

      setMessage(response.data.message || "Reward information loaded.");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  const generateRewardCode = async () => {
    setGenerating(true);
    setError("");
    setMessage("");

    try {
      const response = await axios.post(
        `${API_URL}/reports/rewards/issue-code`,
        {
          tracking_reference: trackingReference.trim(),
          tracking_secret: trackingSecret.trim(),
        }
      );

      setRewardCode(response.data.reward_code);
      setAmount(response.data.amount);

      setRewardStatus({
        eligible: true,
        reward_issued: true,
        amount: response.data.amount,
        currency: "INR",
        status: response.data.status,
        message: response.data.message,
      });

      setMessage(
        "Your reward code has been generated. Copy and save it securely."
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const copyRewardCode = async () => {
    if (!rewardCode) return;

    try {
      await navigator.clipboard.writeText(rewardCode);
      setCopied(true);
      setMessage("Reward code copied successfully.");
    } catch {
      setError("Unable to copy automatically. Please select and copy the code.");
    }
  };

  const redeemReward = async () => {
    if (!rewardCode.trim() || !upiId.trim() || !beneficiaryName.trim()) {
      setError("Please enter your reward code, UPI ID and beneficiary name.");
      return;
    }

    if (!/^[A-Za-z0-9][A-Za-z0-9.-]{0,98}@[A-Za-z0-9.-]+$/.test(upiId.trim())) {
      setError("Please enter a valid UPI ID.");
      return;
    }

    setRedeeming(true);
    setError("");
    setMessage("");

    try {
      const response = await axios.post(
        `${API_URL}/reports/rewards/redeem`,
        {
          reward_code: rewardCode.trim(),
          upi_id: upiId.trim(),
          beneficiary_name: beneficiaryName.trim(),
        }
      );

      setRewardStatus((previous) => ({
        ...previous,
        eligible: true,
        reward_issued: true,
        amount: response.data.amount,
        currency: response.data.currency,
        status: response.data.status,
        utr: response.data.utr || null,
        upi_id: response.data.upi_id || null,
        message: response.data.message,
      }));

      setAmount(response.data.amount);
      setMessage(response.data.message);
      setRewardCode("");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setRedeeming(false);
    }
  };

  const checkPaymentStatus = async () => {
    setLoadingPaymentStatus(true);
    setError("");
    setMessage("");

    try {
      const response = await axios.post(
        `${API_URL}/reports/rewards/payment-status`,
        {
          tracking_reference: trackingReference.trim(),
          tracking_secret: trackingSecret.trim(),
        }
      );

      setRewardStatus(response.data);

      if (response.data.amount !== undefined) {
        setAmount(response.data.amount);
      }

      setMessage(response.data.message || "Payment status updated.");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingPaymentStatus(false);
    }
  };

  const statusColor = (status?: string) => {
    switch (status) {
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

  const paymentIsFinal = ["paid", "failed", "reversed"].includes(
    rewardStatus?.status || ""
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-5 py-5">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="rounded-xl bg-purple-100 p-3 text-purple-700">
            <Gift size={26} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900">
              NashaMukt Rewards
            </h1>
            <p className="text-sm text-slate-500">
              Check and redeem your citizen reward
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl space-y-6 px-5 py-8">
        <div className="rounded-xl border bg-white p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="text-blue-600" size={23} />
            <h2 className="text-lg font-bold text-slate-900">
              Verify Your Report
            </h2>
          </div>

          <p className="mb-5 text-sm leading-6 text-slate-600">
            Enter the tracking reference and secret you received when
            submitting your anonymous report. These details verify that
            you own the report.
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Tracking Reference
              </label>
              <input
                value={trackingReference}
                onChange={(e) => setTrackingReference(e.target.value)}
                placeholder="Example: NM-AB12CD34"
                autoComplete="off"
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Tracking Secret
              </label>
              <input
                type="password"
                value={trackingSecret}
                onChange={(e) => setTrackingSecret(e.target.value)}
                placeholder="Enter your tracking secret"
                autoComplete="off"
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              onClick={checkReward}
              disabled={checking}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {checking ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Search size={18} />
              )}
              {checking ? "Checking..." : "Check Reward Eligibility"}
            </button>
          </div>
        </div>

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

        {rewardStatus && (
          <>
            <div className="rounded-xl border bg-white p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2 text-green-700">
                  <Gift size={22} />
                </div>

                <div>
                  <h2 className="font-bold text-slate-900">
                    Your Reward Details
                  </h2>
                  <p className="text-sm text-slate-500">
                    Report: {trackingReference}
                  </p>
                </div>
              </div>

              {rewardStatus.reward_issued ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-slate-50 p-5">
                    <p className="mb-1 text-sm text-slate-500">
                      Reward Amount
                    </p>
                    <p className="text-3xl font-bold text-slate-900">
                      {formatCurrency(amount || 0)}
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-sm text-slate-500">
                      Reward / Payment Status
                    </p>
                    <span
                      className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${statusColor(
                        rewardStatus.status
                      )}`}
                    >
                      {rewardStatus.status
                        ? rewardStatus.status.replaceAll("_", " ").toUpperCase()
                        : "ISSUED"}
                    </span>
                  </div>

                  {rewardStatus.upi_id && (
                    <p className="text-sm text-slate-600">
                      UPI ID: {rewardStatus.upi_id}
                    </p>
                  )}

                  {rewardStatus.utr && (
                    <p className="text-sm text-slate-600">
                      Transaction UTR: {rewardStatus.utr}
                    </p>
                  )}

                  {rewardStatus.status === "paid" && (
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-sm font-medium text-green-700">
                      <CheckCircle2 size={19} />
                      Your reward payment has been marked as paid.
                    </div>
                  )}
                </div>
              ) : rewardStatus.eligible ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-5">
                  <p className="font-semibold text-green-800">
                    Congratulations! Your report is eligible for a reward.
                  </p>
                  <p className="mt-1 text-sm text-green-700">
                    Generate your unique reward code to continue.
                  </p>

                  <button
                    onClick={generateRewardCode}
                    disabled={generating}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                  >
                    {generating ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Gift size={18} />
                    )}
                    {generating
                      ? "Generating..."
                      : "Generate Reward Code"}
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-5">
                  <p className="font-semibold text-yellow-800">
                    Your report is not yet eligible.
                  </p>
                  <p className="mt-1 text-sm text-yellow-700">
                    Your reward becomes available after investigation
                    verification and action completion.
                  </p>
                  {rewardStatus.report_status && (
                    <p className="mt-2 text-sm text-yellow-800">
                      Current report status:{" "}
                      {rewardStatus.report_status.replaceAll("_", " ")}
                    </p>
                  )}
                </div>
              )}
            </div>

            {rewardCode && (
              <div className="rounded-xl border border-purple-200 bg-white p-5 sm:p-7">
                <div className="mb-4 flex items-center gap-2">
                  <Gift className="text-purple-600" size={22} />
                  <h2 className="text-lg font-bold text-slate-900">
                    Your Unique Reward Code
                  </h2>
                </div>

                <p className="mb-3 text-sm text-slate-600">
                  Save this code securely. It is displayed only once.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1 break-all rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 p-4 text-center font-mono text-lg font-bold text-purple-800">
                    {rewardCode}
                  </div>

                  <button
                    onClick={copyRewardCode}
                    className="flex items-center justify-center gap-2 rounded-lg border border-purple-300 px-5 py-3 text-sm font-semibold text-purple-700 hover:bg-purple-50"
                  >
                    <Copy size={17} />
                    {copied ? "Copied" : "Copy Code"}
                  </button>
                </div>

                <p className="mt-3 text-xs text-amber-700">
                  Keep this code private. Do not share it with anyone.
                </p>
              </div>
            )}

            {rewardStatus.reward_issued &&
              rewardStatus.status !== "paid" &&
              rewardStatus.status !== "failed" &&
              rewardStatus.status !== "reversed" && (
                <div className="rounded-xl border bg-white p-5 sm:p-7">
                  <div className="mb-5 flex items-center gap-2">
                    <Wallet className="text-blue-600" size={23} />
                    <h2 className="text-lg font-bold text-slate-900">
                      Redeem Your Reward
                    </h2>
                  </div>

                  <p className="mb-5 text-sm leading-6 text-slate-600">
                    Enter your saved reward code, UPI ID and beneficiary
                    name to request payment directly to your bank account.
                    No mobile number is required.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Reward Code
                      </label>
                      <input
                        value={rewardCode}
                        onChange={(e) => setRewardCode(e.target.value)}
                        placeholder="Paste your saved reward code"
                        autoComplete="off"
                        className="w-full rounded-lg border px-4 py-3 font-mono outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        UPI ID
                      </label>
                      <input
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="Example: name@upi"
                        autoComplete="off"
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Beneficiary Name
                      </label>
                      <input
                        value={beneficiaryName}
                        onChange={(e) => setBeneficiaryName(e.target.value)}
                        placeholder="Name registered with your bank"
                        autoComplete="name"
                        className="w-full rounded-lg border px-4 py-3 outline-none focus:border-blue-500"
                      />
                    </div>

                    <button
                      onClick={redeemReward}
                      disabled={redeeming || !rewardCode.trim()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-700 px-5 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
                    >
                      {redeeming ? (
                        <RefreshCw size={18} className="animate-spin" />
                      ) : (
                        <IndianRupee size={18} />
                      )}
                      {redeeming
                        ? "Submitting..."
                        : "Redeem Reward"}
                    </button>
                  </div>
                </div>
              )}

            {rewardStatus.reward_issued && (
              <button
                onClick={checkPaymentStatus}
                disabled={loadingPaymentStatus}
                className="flex w-full items-center justify-center gap-2 rounded-lg border bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingPaymentStatus ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <Clock size={17} />
                )}
                {loadingPaymentStatus
                  ? "Checking..."
                  : "Refresh Payment Status"}
              </button>
            )}
          </>
        )}

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
          <strong>Privacy notice:</strong> NashaMukt does not ask for
          your mobile number to redeem a reward. Your tracking
          credentials are used to verify report ownership. Your UPI ID
          is used only when you request a payout.
        </div>
      </section>
    </main>
  );
}
