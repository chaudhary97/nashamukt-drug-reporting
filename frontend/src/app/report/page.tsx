
"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  MapPin,
  FileText,
  CheckCircle2,
  Copy,
  LockKeyhole,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type ReportResult = {
  message: string;
  tracking_reference: string;
  tracking_secret: string;
  status: string;
};

export default function ReportPage() {
  const [form, setForm] = useState({
    category: "drug_seller",
    description: "",
    location_text: "",
    latitude: "",
    longitude: "",
    observed_frequency: "Once",
    observed_quantity: "",
    incident_datetime: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [copied, setCopied] = useState(false);

  function updateField(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    const payload = {
      category: form.category,
      description: form.description.trim(),
      location_text: form.location_text.trim(),
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      observed_frequency: form.observed_frequency,
      observed_quantity: form.observed_quantity || null,
      incident_datetime: form.incident_datetime
        ? new Date(form.incident_datetime).toISOString()
        : null,
    };

    try {
      const response = await fetch(`${API_URL}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to submit report. Please try again."
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Check your backend connection."
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyTrackingDetails() {
    if (!result) return;

    const details =
      `Tracking reference: ${result.tracking_reference}\n` +
      `Tracking secret: ${result.tracking_secret}`;

    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
    } catch {
      setError("Unable to copy. Please save the tracking details manually.");
    }
  }

  if (result) {
    return (
      <main className="min-h-screen bg-[#f8f3eb] px-5 py-12">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-xl sm:p-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle2 size={38} />
          </div>

          <h1 className="text-center text-3xl font-extrabold text-[#203879]">
            Report Submitted!
          </h1>

          <p className="mt-3 text-center text-gray-500">
            Thank you for responsibly sharing information. Your report
            has been submitted successfully.
          </p>

          <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-sm font-semibold text-gray-600">
              Tracking reference
            </p>
            <p className="mt-2 break-all text-xl font-bold text-[#304dbb]">
              {result.tracking_reference}
            </p>

            <div className="my-5 border-t border-blue-200" />

            <p className="text-sm font-semibold text-gray-600">
              Your private tracking secret
            </p>
            <p className="mt-2 break-all font-mono text-lg font-bold text-[#203879]">
              {result.tracking_secret}
            </p>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl bg-orange-50 p-4 text-sm text-orange-800">
            <LockKeyhole className="mt-0.5 shrink-0" size={20} />
            <p>
              Save both credentials securely. You need them to track
              your report. The tracking secret cannot be recovered if
              you lose it.
            </p>
          </div>

          <button
            onClick={copyTrackingDetails}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#304dbb] px-5 py-4 font-bold text-white transition hover:bg-[#203879]"
          >
            <Copy size={18} />
            {copied ? "Copied successfully" : "Copy tracking details"}
          </button>

          <Link
            href="/track"
            className="mt-3 block w-full rounded-xl border border-[#304dbb] px-5 py-4 text-center font-bold text-[#304dbb] transition hover:bg-blue-50"
          >
            Track Your Report
          </Link>

          <Link
            href="/"
            className="mt-5 block text-center text-sm font-semibold text-gray-500 hover:text-[#304dbb]"
          >
            Return to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f3eb] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-7 inline-flex items-center gap-2 font-semibold text-[#304dbb] hover:text-orange-600"
        >
          <ArrowLeft size={18} />
          Back to Home
        </Link>

        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="bg-gradient-to-r from-[#203879] to-[#3856bf] px-6 py-9 text-white sm:px-10">
            <div className="mb-4 flex items-center gap-3">
              <ShieldCheck size={34} />
              <span className="text-sm font-bold tracking-widest">
                NASHA MUKT
              </span>
            </div>

            <h1 className="text-3xl font-extrabold sm:text-4xl">
              Report an Incident
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-7 text-blue-100">
              Share information about suspected drug-related activity.
              Your report can help authorized officials assess the
              situation.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-7 p-6 sm:p-10">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 font-bold text-green-800">
                <LockKeyhole size={19} />
                Anonymous reporting
              </div>
              <p className="mt-2 text-sm leading-6 text-green-700">
                This form does not ask for your name, phone number,
                Aadhaar number or account registration.
              </p>
            </div>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-[#203879]">
                <FileText size={21} />
                Incident details
              </h2>

              <label className="mb-2 block text-sm font-bold text-gray-700">
                Incident category *
              </label>

              <select
                name="category"
                value={form.category}
                onChange={updateField}
                required
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#304dbb] focus:ring-2 focus:ring-blue-100"
              >
                <option value="drug_consumer">Drug Consumer</option>
                <option value="drug_seller">Drug Seller</option>
                <option value="drug_producer">Drug Producer</option>
                <option value="miscellaneous">Miscellaneous</option>
              </select>
            </section>

            <section>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Describe the incident *
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={updateField}
                required
                minLength={20}
                maxLength={5000}
                rows={5}
                placeholder="Describe what you observed, when it happened and any relevant details. Avoid speculation."
                className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#304dbb] focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1 text-right text-xs text-gray-400">
                {form.description.length}/5000 characters
              </p>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-[#203879]">
                <MapPin size={21} />
                Incident location
              </h2>

              <label className="mb-2 block text-sm font-bold text-gray-700">
                Location or area description *
              </label>

              <input
                name="location_text"
                value={form.location_text}
                onChange={updateField}
                required
                minLength={3}
                maxLength={500}
                placeholder="Enter area, street or nearby landmark"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#304dbb] focus:ring-2 focus:ring-blue-100"
              />

              <p className="mb-3 mt-2 text-xs text-gray-500">
                Coordinates are optional. Do not put your home address
                or personal location here.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Latitude (optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="latitude"
                    value={form.latitude}
                    onChange={updateField}
                    min="-90"
                    max="90"
                    placeholder="e.g. 31.326"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#304dbb]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Longitude (optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="longitude"
                    value={form.longitude}
                    onChange={updateField}
                    min="-180"
                    max="180"
                    placeholder="e.g. 75.576"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#304dbb]"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-[#203879]">
                Observation details
              </h2>

              <label className="mb-2 block text-sm font-bold text-gray-700">
                How frequently was it observed?
              </label>

              <select
                name="observed_frequency"
                value={form.observed_frequency}
                onChange={updateField}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#304dbb]"
              >
                <option>Once</option>
                <option>Multiple times</option>
                <option>Daily</option>
                <option>Weekly</option>
                <option>Unknown</option>
              </select>

              <label className="mb-2 mt-5 block text-sm font-bold text-gray-700">
                Quantity observed (optional)
              </label>

              <input
                name="observed_quantity"
                value={form.observed_quantity}
                onChange={updateField}
                maxLength={150}
                placeholder="Enter only if known; otherwise leave blank"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#304dbb]"
              />

              <label className="mb-2 mt-5 block text-sm font-bold text-gray-700">
                Date and time of incident (optional)
              </label>

              <input
                type="datetime-local"
                name="incident_datetime"
                value={form.incident_datetime}
                onChange={updateField}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#304dbb]"
              />
            </section>

            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm leading-6 text-orange-900">
                <strong>Safety notice:</strong> Share only information
                you believe is accurate. Do not confront, follow or
                investigate anyone yourself. For immediate danger,
                contact the appropriate emergency services.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#ed650f] px-6 py-4 font-bold text-white shadow-lg transition hover:bg-[#d95708] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Submitting Report..." : "Submit Anonymous Report"}
            </button>

            <p className="text-center text-xs text-gray-400">
              NashaMukt · जागरूकता · सुरक्षा · बदलाव
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
