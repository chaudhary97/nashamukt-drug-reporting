"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  ShieldCheck,
  RefreshCw,
  LogOut,
  Search,
  MapPin,
  Clock,
  FileText,
  AlertTriangle,
  X,
  Send,
  Upload,
  Image as ImageIcon,
  Video,
  ClipboardList,
  CheckCircle2,
  Navigation,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const normalizeStatus = (status?: string) =>
  (status || "").trim().toUpperCase();

type Assignment = {
  assignment_id: string;
  report_id: string;
  category: string;
  description: string;
  location_text: string;
  priority: string;
  status: string;
  deadline: string;
};

type EvidenceFile = {
  file: File;
  id: string;
};

type OfficerLocation = {
  latitude: number;
  longitude: number;
};

export default function OfficerDashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<Assignment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const [findings, setFindings] = useState("");
  const [verificationResult, setVerificationResult] = useState("verified");
  const [actionTaken, setActionTaken] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getToken = () => sessionStorage.getItem("officer_token");

  const loadAssignments = async () => {
    const token = getToken();

    if (!token) {
      router.replace("/officer/login");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.get(
        `${API_URL}/officer/assignments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const reports: Assignment[] = Array.isArray(response.data)
        ? response.data
        : [];

      setAssignments(reports);
      setFilteredAssignments(reports);
      setError("");
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        sessionStorage.removeItem("officer_token");
        router.replace("/officer/login");
      } else {
        setError(
          err.response?.data?.detail || "Unable to load assigned reports."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  useEffect(() => {
    const value = search.toLowerCase().trim();

    if (!value) {
      setFilteredAssignments(assignments);
      return;
    }

    setFilteredAssignments(
      assignments.filter((report) =>
        [
          report.report_id,
          report.category,
          report.location_text,
          report.description,
          report.priority,
          report.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(value)
      )
    );
  }, [search, assignments]);

  const logout = () => {
    sessionStorage.removeItem("officer_token");
    router.replace("/officer/login");
  };

  const openInvestigation = (report: Assignment) => {
    setSelectedReport(report);
    setFindings("");
    setVerificationResult("verified");
    setActionTaken("");
    setEvidenceFiles([]);
    setError("");
    setSuccess("");
  };

  const closeInvestigation = () => {
    if (submitting) return;

    setSelectedReport(null);
    setEvidenceFiles([]);
    setError("");
  };

  const handleFileSelection = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected = Array.from(event.target.files || []);

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/quicktime",
    ];

    setError("");

    if (evidenceFiles.length + selected.length > 5) {
      setError("You can upload a maximum of 5 files.");
      event.target.value = "";
      return;
    }

    for (const file of selected) {
      if (!allowedTypes.includes(file.type)) {
        setError(
          `${file.name}: Only JPG, PNG, WEBP, MP4 and MOV files are allowed.`
        );
        event.target.value = "";
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        setError(`${file.name}: File size must not exceed 20 MB.`);
        event.target.value = "";
        return;
      }
    }

    setEvidenceFiles((previous) => [
      ...previous,
      ...selected.map((file) => ({
        file,
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      })),
    ]);

    event.target.value = "";
  };

  const removeEvidence = (id: string) => {
    setEvidenceFiles((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  // Get the officer's current GPS location.
  const getOfficerLocation = (): Promise<OfficerLocation> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error("Your browser does not support GPS location.")
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (locationError) => {
          let message = "Unable to get your current location.";

          if (locationError.code === locationError.PERMISSION_DENIED) {
            message =
              "Location permission denied. Please allow location access in your browser and try again.";
          } else if (
            locationError.code === locationError.POSITION_UNAVAILABLE
          ) {
            message =
              "Your current location is unavailable. Please enable GPS and try again.";
          } else if (locationError.code === locationError.TIMEOUT) {
            message =
              "GPS request timed out. Please try again.";
          }

          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      );
    });
  };

  const submitInvestigation = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!selectedReport) return;

    if (findings.trim().length < 20) {
      setError("Investigation findings must contain at least 20 characters.");
      return;
    }

    const token = getToken();

    if (!token) {
      router.replace("/officer/login");
      return;
    }

    try {
      setSubmitting(true);
      setGettingLocation(true);
      setError("");

      // Capture GPS before submitting the investigation.
      const officerLocation = await getOfficerLocation();

      setGettingLocation(false);

      const formData = new FormData();

      formData.append("findings", findings.trim());
      formData.append("verification_result", verificationResult);
      formData.append("action_taken", actionTaken.trim());

      formData.append(
        "latitude",
        officerLocation.latitude.toString()
      );

      formData.append(
        "longitude",
        officerLocation.longitude.toString()
      );

      evidenceFiles.forEach((item) => {
        formData.append("files", item.file);
      });

      const response = await axios.post(
        `${API_URL}/officer/reports/${selectedReport.report_id}/investigation`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const uploadedFiles = response.data.uploaded_files;

      setSuccess(
        `Investigation submitted successfully. ${
          uploadedFiles ?? evidenceFiles.length
        } evidence file(s) uploaded. Officer GPS location saved.`
      );

      setSelectedReport(null);
      setEvidenceFiles([]);
      setFindings("");
      setActionTaken("");

      await loadAssignments();
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Investigation submission failed. Please try again."
      );
    } finally {
      setSubmitting(false);
      setGettingLocation(false);
    }
  };

  const priorityStyle = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-green-100 text-green-700";
    }
  };

  const formatDate = (value: string) => {
    if (!value) return "Not specified";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not specified";

    return date.toLocaleString();
  };

  const formatSize = (size: number) => {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const pendingCount = assignments.filter((item) =>
    ["ASSIGNED", "INVESTIGATION_IN_PROGRESS"].includes(
      normalizeStatus(item.status)
    )
  ).length;

  const submittedCount = assignments.filter(
    (item) =>
      normalizeStatus(item.status) === "INVESTIGATION_SUBMITTED"
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <ShieldCheck size={25} />
            </div>

            <div>
              <h1 className="text-xl font-bold">NashaMukt</h1>
              <p className="text-xs text-slate-500">
                Local Officer Portal
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold">Officer Dashboard</h2>
            <p className="mt-1 text-sm text-slate-500">
              Review assigned reports and submit investigation findings.
            </p>
          </div>

          <button
            onClick={loadAssignments}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh Reports
          </button>
        </div>

        {success && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={18} />
            {success}
            <button
              onClick={() => setSuccess("")}
              className="ml-auto"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {error && !selectedReport && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Total Assigned</p>
              <ClipboardList className="text-blue-600" />
            </div>
            <p className="mt-3 text-3xl font-bold">
              {assignments.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Pending Investigation</p>
              <Clock className="text-amber-600" />
            </div>
            <p className="mt-3 text-3xl font-bold">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Submitted</p>
              <CheckCircle2 className="text-green-600" />
            </div>
            <p className="mt-3 text-3xl font-bold">
              {submittedCount}
            </p>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by report ID, location or category..."
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="font-semibold">Assigned Reports</h3>
            <span className="text-sm text-slate-500">
              {filteredAssignments.length} reports
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <RefreshCw className="animate-spin" size={20} />
              Loading reports...
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="mx-auto mb-3 text-slate-300" size={40} />
              <p className="font-medium">No reports found</p>
              <p className="mt-1 text-sm text-slate-500">
                Assigned reports will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredAssignments.map((report) => {
                const reportStatus = normalizeStatus(report.status);

                const canSubmit = [
                  "ASSIGNED",
                  "INVESTIGATION_IN_PROGRESS",
                ].includes(reportStatus);

                return (
                  <div
                    key={report.assignment_id}
                    className="p-5 transition hover:bg-slate-50"
                  >
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="font-semibold">
                            {report.category.replaceAll("_", " ")}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyle(
                              report.priority
                            )}`}
                          >
                            {report.priority} Priority
                          </span>

                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                            {reportStatus.replaceAll("_", " ").toLowerCase()}
                          </span>
                        </div>

                        <p className="mb-2 break-all text-xs text-slate-400">
                          Report ID: {report.report_id}
                        </p>

                        <p className="mb-3 text-sm text-slate-700">
                          {report.description}
                        </p>

                        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            {report.location_text}
                          </span>

                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            Deadline: {formatDate(report.deadline)}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {canSubmit ? (
                          <button
                            onClick={() => openInvestigation(report)}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                          >
                            <FileText size={16} />
                            Submit Investigation
                          </button>
                        ) : (
                          <span className="text-sm font-medium text-slate-400">
                            Submitted for review
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5">
          <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold">
                  Investigation Submission
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Report: {selectedReport.report_id}
                </p>
              </div>

              <button
                onClick={closeInvestigation}
                disabled={submitting}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={submitInvestigation}
              className="space-y-5 overflow-y-auto p-5"
            >
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <MapPin size={16} className="text-emerald-700" />
                  Report Location
                </div>
                <p className="text-sm text-slate-600">
                  {selectedReport.location_text}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Category: {selectedReport.category.replaceAll("_", " ")}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <Navigation size={17} />
                  Officer GPS Location
                </div>
                <p className="mt-2 text-xs leading-5 text-emerald-700">
                  Your current GPS location will be captured when you submit
                  this investigation. Please allow location access in your
                  browser when prompted.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Investigation Findings *
                </label>

                <textarea
                  required
                  minLength={20}
                  value={findings}
                  onChange={(event) => setFindings(event.target.value)}
                  placeholder="Describe the inspection, observations, evidence and investigation findings..."
                  rows={5}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-600"
                />

                <p className="mt-1 text-xs text-slate-400">
                  Minimum 20 characters.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Verification Result *
                </label>

                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    {
                      value: "verified",
                      label: "Verified",
                      color: "border-green-500 bg-green-50 text-green-700",
                    },
                    {
                      value: "false",
                      label: "False",
                      color: "border-red-500 bg-red-50 text-red-700",
                    },
                    {
                      value: "inconclusive",
                      label: "Inconclusive",
                      color: "border-amber-500 bg-amber-50 text-amber-700",
                    },
                  ].map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setVerificationResult(option.value)}
                      className={`rounded-xl border p-3 text-sm font-semibold transition ${
                        verificationResult === option.value
                          ? option.color
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Action Taken
                </label>

                <textarea
                  value={actionTaken}
                  onChange={(event) => setActionTaken(event.target.value)}
                  placeholder="Describe the action taken, if any..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-semibold">
                    Investigation Evidence
                  </label>
                  <span className="text-xs text-slate-500">
                    {evidenceFiles.length}/5 files
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                  multiple
                  onChange={handleFileSelection}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={evidenceFiles.length >= 5}
                  className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-emerald-500 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <Upload size={25} className="mb-2 text-emerald-700" />
                  <span className="text-sm font-semibold">
                    Upload photos or videos
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    JPG, PNG, WEBP, MP4, MOV · Maximum 20 MB each
                  </span>
                </button>

                {evidenceFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {evidenceFiles.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                      >
                        {item.file.type.startsWith("video/") ? (
                          <Video size={20} className="shrink-0 text-purple-600" />
                        ) : (
                          <ImageIcon size={20} className="shrink-0 text-blue-600" />
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatSize(item.file.size)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeEvidence(item.id)}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                        >
                          <X size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                Ensure that all findings and evidence are accurate and relate
                to this assigned report. Submission will send the investigation
                to the admin for review.
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeInvestigation}
                  disabled={submitting}
                  className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={17} className="animate-spin" />
                      {gettingLocation
                        ? "Getting GPS location..."
                        : "Submitting..."}
                    </>
                  ) : (
                    <>
                      <Send size={17} />
                      Submit Investigation
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}


