"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import axios from "axios";
import {
  ShieldCheck,
  RefreshCw,
  LogOut,
  Gift,
  Search,
  MapPin,
  Calendar,
  UserCheck,
  AlertTriangle,
  ClipboardList,
  X,
  CheckCircle2,
  Activity,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Eye,
  ExternalLink,
  Check,
  XCircle,
  Navigation,
  User,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Report = {
  id: string;
  tracking_reference: string;
  category: string;
  description: string;
  location_text: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at?: string;
};

type Officer = {
  id: string;
  full_name: string;
  username: string;
};

type Investigation = {
  id: string;
  findings: string;
  verification_result: string;
  action_taken: string | null;
  latitude: number | null;
  longitude: number | null;
  submitted_at: string;
  officer: {
    id: string | null;
    full_name: string;
    username: string;
  };
  evidence_files: {
    stored_name: string;
    original_name: string;
    content_type: string;
    size: number;
  }[];
};

const trackingPhases = [
  { status: "submitted", label: "Report Submitted" },
  { status: "under_review", label: "Admin Review" },
  { status: "assigned", label: "Officer Assigned" },
  {
    status: "investigation_in_progress",
    label: "Investigation in Progress",
  },
  {
    status: "investigation_submitted",
    label: "Investigation Submitted",
  },
  { status: "admin_verification", label: "Admin Verification" },
  { status: "action_completed", label: "Action Completed" },
];

export default function AdminDashboard() {
  const router = useRouter();

  const [reports, setReports] = useState<Report[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [officerId, setOfficerId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState("");

  const [investigations, setInvestigations] = useState<
    Record<string, Investigation | null>
  >({});
  const [investigationLoading, setInvestigationLoading] = useState<
    Record<string, boolean>
  >({});
  const [reviewingReport, setReviewingReport] = useState<string | null>(null);
  const [expandedInvestigation, setExpandedInvestigation] = useState<
    string | null
  >(null);

  const [expandedTracking, setExpandedTracking] = useState<string | null>(
    null
  );

  const getToken = () => sessionStorage.getItem("admin_token");

  const authConfig = () => {
    const token = getToken();
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  const loadDashboard = useCallback(
    async (showLoader = true) => {
      const token = getToken();

      if (!token) {
        router.push("/admin/login");
        return;
      }

      if (showLoader) {
        setRefreshing(true);
      }

      setError("");

      try {
        const config = {
          headers: { Authorization: `Bearer ${token}` },
        };

        const [reportResponse, officerResponse] = await Promise.all([
          axios.get(`${API_URL}/admin/reports`, config),
          axios.get(`${API_URL}/admin/officers`, config),
        ]);

        setReports(
          Array.isArray(reportResponse.data) ? reportResponse.data : []
        );

        setOfficers(
          Array.isArray(officerResponse.data) ? officerResponse.data : []
        );
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          sessionStorage.removeItem("admin_token");
          router.push("/admin/login");
        } else {
          setError(
            axios.isAxiosError(err)
              ? err.response?.data?.detail ||
                  "Unable to load admin dashboard."
              : "Unexpected error occurred."
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadDashboard();

    const interval = window.setInterval(() => {
      loadDashboard(false);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  const logout = () => {
    sessionStorage.removeItem("admin_token");
    router.push("/admin/login");
  };

  const assignReport = async () => {
    if (!selectedReport || !officerId) {
      setMessage("Please select an officer.");
      return;
    }

    const token = getToken();

    if (!token) {
      router.push("/admin/login");
      return;
    }

    setAssigning(true);
    setMessage("");

    try {
      await axios.post(
        `${API_URL}/admin/reports/${selectedReport.id}/assign`,
        {
          officer_id: officerId,
          priority,
          deadline: deadline
            ? new Date(deadline).toISOString()
            : null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage("Report assigned successfully.");
      setSelectedReport(null);
      setOfficerId("");
      setDeadline("");
      setPriority("medium");

      await loadDashboard(false);
    } catch (err: unknown) {
      setMessage(
        axios.isAxiosError(err)
          ? err.response?.data?.detail || "Report assignment failed."
          : "Unexpected error occurred."
      );
    } finally {
      setAssigning(false);
    }
  };

  // Load an investigation when the admin opens its details.
  const loadInvestigation = async (reportId: string) => {
    if (investigationLoading[reportId]) return;

    setInvestigationLoading((previous) => ({
      ...previous,
      [reportId]: true,
    }));

    try {
      const response = await axios.get(
        `${API_URL}/admin/reports/${reportId}/investigation`,
        authConfig()
      );

      const investigation =
        response.data?.investigation ?? response.data ?? null;

      setInvestigations((previous) => ({
        ...previous,
        [reportId]: investigation,
      }));
    } catch (err: unknown) {
      setMessage(
        axios.isAxiosError(err)
          ? err.response?.data?.detail ||
              "Unable to load investigation details."
          : "Unable to load investigation details."
      );
    } finally {
      setInvestigationLoading((previous) => ({
        ...previous,
        [reportId]: false,
      }));
    }
  };

  const toggleInvestigation = async (reportId: string) => {
    if (expandedInvestigation === reportId) {
      setExpandedInvestigation(null);
      return;
    }

    setExpandedInvestigation(reportId);

    if (!(reportId in investigations)) {
      await loadInvestigation(reportId);
    }
  };

  // Approve, reject or mark the investigation inconclusive.
  const reviewInvestigation = async (
    report: Report,
    decision: "approved" | "rejected" | "inconclusive"
  ) => {
    const token = getToken();

    if (!token) {
      router.push("/admin/login");
      return;
    }

    const confirmation = window.confirm(
      `Are you sure you want to mark this investigation as ${decision}?`
    );

    if (!confirmation) return;

    setReviewingReport(report.id);
    setMessage("");

    try {
      await axios.post(
        `${API_URL}/admin/reports/${report.id}/review`,
        { decision },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage(`Investigation marked as ${decision}.`);
      await loadDashboard(false);
    } catch (err: unknown) {
      setMessage(
        axios.isAxiosError(err)
          ? err.response?.data?.detail || "Investigation review failed."
          : "Investigation review failed."
      );
    } finally {
      setReviewingReport(null);
    }
  };

  // Mark an approved report as action completed.
  const completeReport = async (report: Report) => {
    const token = getToken();

    if (!token) {
      router.push("/admin/login");
      return;
    }

    if (
      !window.confirm(
        `Mark report ${report.tracking_reference} as action completed?`
      )
    ) {
      return;
    }

    setReviewingReport(report.id);
    setMessage("");

    try {
      await axios.post(
        `${API_URL}/admin/reports/${report.id}/complete`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage("Report marked as action completed.");
      await loadDashboard(false);
    } catch (err: unknown) {
      setMessage(
        axios.isAxiosError(err)
          ? err.response?.data?.detail || "Unable to complete report."
          : "Unable to complete report."
      );
    } finally {
      setReviewingReport(null);
    }
  };

  // Open evidence using the authenticated API request.
  const openEvidence = async (reportId: string, storedName: string) => {
    const token = getToken();

    if (!token) {
      router.push("/admin/login");
      return;
    }

    // Open a blank tab immediately so the browser does not block the popup.
    const newTab = window.open("about:blank", "_blank");

    if (!newTab) {
      setMessage(
        "Your browser blocked the new tab. Please allow pop-ups for this site and try again."
      );
      return;
    }

    newTab.document.title = "Loading evidence...";
    newTab.document.body.innerHTML =
      "<p style='font-family: sans-serif; padding: 24px;'>Loading evidence file...</p>";

    try {
      const response = await axios.get(
        `${API_URL}/reports/${reportId}/evidence/${encodeURIComponent(
          storedName
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: "blob",
        }
      );

      const contentType = response.headers["content-type"];

const blob = new Blob([response.data], {
  type:
    typeof contentType === "string"
      ? contentType
      : "application/octet-stream",
});


      const fileUrl = window.URL.createObjectURL(blob);

      newTab.location.href = fileUrl;

      // Keep the object URL available while the new tab loads the file.
      window.setTimeout(() => {
        window.URL.revokeObjectURL(fileUrl);
      }, 60000);
    } catch (err: unknown) {
      newTab.close();

      if (axios.isAxiosError(err) && err.response?.status === 401) {
        sessionStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }

      setMessage(
        axios.isAxiosError(err)
          ? "Unable to open evidence file. Please check the file and try again."
          : "Unable to open evidence file."
      );
    }
  };

  const filteredReports = reports.filter((report) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      report.tracking_reference?.toLowerCase().includes(searchText) ||
      report.category?.toLowerCase().includes(searchText) ||
      report.location_text?.toLowerCase().includes(searchText) ||
      report.description?.toLowerCase().includes(searchText);

    const matchesStatus =
      statusFilter === "all" || report.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatLabel = (value: string) =>
    value
      ? value
          .replaceAll("_", " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())
      : "Unknown";

  const getTrackingProgress = (status: string) =>
    trackingPhases.findIndex((phase) => phase.status === status);

  const statusColor = (status: string) => {
    switch (status) {
      case "action_completed":
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      case "inconclusive":
        return "bg-yellow-100 text-yellow-800";
      case "assigned":
        return "bg-blue-100 text-blue-700";
      case "investigation_in_progress":
        return "bg-indigo-100 text-indigo-700";
      case "investigation_submitted":
        return "bg-purple-100 text-purple-700";
      case "admin_verification":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const awaitingAssignment = reports.filter(
    (report) =>
      report.status === "submitted" ||
      report.status === "under_review"
  ).length;

  const activeInvestigations = reports.filter(
    (report) =>
      report.status === "assigned" ||
      report.status === "investigation_in_progress"
  ).length;

  const completedReports = reports.filter(
    (report) => report.status === "action_completed"
  ).length;

  const awaitingVerification = reports.filter(
    (report) => report.status === "investigation_submitted"
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-slate-600">Loading admin dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 text-blue-700 p-3 rounded-xl">
              <ShieldCheck size={25} />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-900">
                NashaMukt Admin
              </h1>
              <p className="text-xs text-slate-500">
                Government Report Management
              </p>
            </div>
          </div>


<div className="flex flex-wrap gap-3">
  <button
    onClick={() => router.push("/admin/rewards")}
    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
  >
    <Gift size={16} />
    Reward Management
  </button>

  <button
    onClick={() => loadDashboard()}
    disabled={refreshing}
    className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
  >
    <RefreshCw
      size={16}
      className={refreshing ? "animate-spin" : ""}
    />
    Refresh
  </button>

  <button
    onClick={logout}
    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white"
  >
    <LogOut size={16} />
    Logout
  </button>
</div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="mb-5 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-lg bg-blue-50 p-4 text-blue-700">
            <p>{message}</p>
            <button onClick={() => setMessage("")} aria-label="Dismiss message">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
          <div className="bg-white p-5 rounded-xl border">
            <ClipboardList className="text-blue-600 mb-3" />
            <p className="text-sm text-slate-500">Total Reports</p>
            <h2 className="text-3xl font-bold">{reports.length}</h2>
          </div>

          <div className="bg-white p-5 rounded-xl border">
            <AlertTriangle className="text-orange-600 mb-3" />
            <p className="text-sm text-slate-500">Awaiting Assignment</p>
            <h2 className="text-3xl font-bold">{awaitingAssignment}</h2>
          </div>

          <div className="bg-white p-5 rounded-xl border">
            <Activity className="text-indigo-600 mb-3" />
            <p className="text-sm text-slate-500">Active Investigations</p>
            <h2 className="text-3xl font-bold">{activeInvestigations}</h2>
          </div>

          <div className="bg-white p-5 rounded-xl border">
            <Eye className="text-purple-600 mb-3" />
            <p className="text-sm text-slate-500">Awaiting Verification</p>
            <h2 className="text-3xl font-bold">{awaitingVerification}</h2>
          </div>

          <div className="bg-white p-5 rounded-xl border">
            <UserCheck className="text-green-600 mb-3" />
            <p className="text-sm text-slate-500">Completed Reports</p>
            <h2 className="text-3xl font-bold">{completedReports}</h2>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-bold text-slate-900">
              Citizen Reports
            </h2>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search
                  className="absolute left-3 top-3 text-slate-400"
                  size={17}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search reports..."
                  className="border rounded-lg pl-10 pr-3 py-2 w-full"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-lg px-3 py-2"
              >
                <option value="all">All statuses</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="assigned">Assigned</option>
                <option value="investigation_in_progress">
                  Investigation in Progress
                </option>
                <option value="investigation_submitted">
                  Investigation Submitted
                </option>
                <option value="admin_verification">
                  Admin Verification
                </option>
                <option value="action_completed">Action Completed</option>
                <option value="rejected">Rejected</option>
                <option value="inconclusive">Inconclusive</option>
              </select>
            </div>
          </div>

          {filteredReports.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No reports found.
            </div>
          ) : (
            <div className="space-y-5">
              {filteredReports.map((report) => {
                const progress = getTrackingProgress(report.status);
                const isExpanded = expandedTracking === report.id;
                const isInvestigationExpanded =
                  expandedInvestigation === report.id;
                const investigation = investigations[report.id];

                return (
                  <div
                    key={report.id}
                    className="border rounded-xl p-5 hover:border-blue-300 transition"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="font-bold text-slate-900">
                            {report.tracking_reference}
                          </span>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(
                              report.status
                            )}`}
                          >
                            {formatLabel(report.status)}
                          </span>

                          <span className="text-xs bg-slate-100 px-3 py-1 rounded-full">
                            {formatLabel(report.priority || "medium")} priority
                          </span>
                        </div>

                        <h3 className="font-semibold text-slate-800 mb-2">
                          {formatLabel(report.category)}
                        </h3>

                        <p className="text-sm text-slate-600 mb-3">
                          {report.description}
                        </p>

                        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            {report.location_text}
                          </span>

                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {report.created_at
                              ? new Date(report.created_at).toLocaleString()
                              : "Date unavailable"}
                          </span>
                        </div>

                        {report.updated_at && (
                          <p className="text-xs text-slate-400 mt-2">
                            Last status update:{" "}
                            {new Date(report.updated_at).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setSelectedReport(report);
                          setMessage("");
                        }}
                        disabled={
                          report.status !== "submitted" &&
                          report.status !== "under_review"
                        }
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
                      >
                        Assign Officer
                      </button>
                    </div>

                    {/* Investigation details */}
                    {[
                      "investigation_submitted",
                      "admin_verification",
                      "action_completed",
                      "rejected",
                      "inconclusive",
                    ].includes(report.status) && (
                      <div className="mt-4">
                        <button
                          onClick={() => toggleInvestigation(report.id)}
                          className="flex w-full items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-800 hover:bg-purple-100"
                        >
                          <span className="flex items-center gap-2">
                            <FileText size={17} />
                            View Investigation & Evidence
                          </span>

                          {isInvestigationExpanded ? (
                            <ChevronUp size={18} />
                          ) : (
                            <ChevronDown size={18} />
                          )}
                        </button>

                        {isInvestigationExpanded && (
                          <div className="mt-3 rounded-xl border bg-slate-50 p-4">
                            {investigationLoading[report.id] ? (
                              <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
                                <RefreshCw
                                  size={17}
                                  className="animate-spin"
                                />
                                Loading investigation...
                              </div>
                            ) : !investigation ? (
                              <div className="py-5 text-sm text-slate-500">
                                No investigation details were returned.
                                <button
                                  onClick={() => loadInvestigation(report.id)}
                                  className="ml-2 text-blue-600 underline"
                                >
                                  Try again
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="rounded-lg bg-white border p-4">
                                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                                      <User size={17} />
                                      <span className="text-xs font-semibold uppercase">
                                        Investigating Officer
                                      </span>
                                    </div>
                                    <p className="font-semibold text-slate-900">
                                      {investigation.officer?.full_name ||
                                        "Not available"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {investigation.officer?.username || ""}
                                    </p>
                                  </div>

                                  <div className="rounded-lg bg-white border p-4">
                                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                                      <Calendar size={17} />
                                      <span className="text-xs font-semibold uppercase">
                                        Submitted At
                                      </span>
                                    </div>
                                    <p className="font-semibold text-slate-900">
                                      {investigation.submitted_at
                                        ? new Date(
                                            investigation.submitted_at
                                          ).toLocaleString()
                                        : "Not available"}
                                    </p>
                                  </div>
                                </div>

                                <div className="rounded-lg bg-white border p-4">
                                  <h4 className="font-semibold text-slate-800 mb-2">
                                    Investigation Findings
                                  </h4>
                                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                                    {investigation.findings ||
                                      "No findings provided."}
                                  </p>
                                </div>

                                <div className="rounded-lg bg-white border p-4">
                                  <h4 className="font-semibold text-slate-800 mb-2">
                                    Verification Result
                                  </h4>
                                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                                    {investigation.verification_result ||
                                      "No verification result provided."}
                                  </p>
                                </div>

                                <div className="rounded-lg bg-white border p-4">
                                  <h4 className="font-semibold text-slate-800 mb-2">
                                    Action Taken
                                  </h4>
                                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                                    {investigation.action_taken ||
                                      "No action details provided."}
                                  </p>
                                </div>

                                <div className="rounded-lg bg-white border p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Navigation
                                      size={18}
                                      className="text-blue-600"
                                    />
                                    <h4 className="font-semibold text-slate-800">
                                      Officer GPS Location
                                    </h4>
                                  </div>

                                  {investigation.latitude !== null &&
                                  investigation.longitude !== null ? (
                                    <div>
                                      <p className="text-sm text-slate-600 mb-3">
                                        Latitude:{" "}
                                        {investigation.latitude}
                                        <br />
                                        Longitude:{" "}
                                        {investigation.longitude}
                                      </p>

                                      <a
                                        href={`https://www.google.com/maps?q=${investigation.latitude},${investigation.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                                      >
                                        <MapPin size={16} />
                                        View Officer Location
                                        <ExternalLink size={14} />
                                      </a>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-slate-500">
                                      Officer GPS location was not submitted.
                                    </p>
                                  )}
                                </div>

                                <div className="rounded-lg bg-white border p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <FileText
                                      size={18}
                                      className="text-purple-600"
                                    />
                                    <h4 className="font-semibold text-slate-800">
                                      Evidence Files
                                    </h4>
                                  </div>

                                  {investigation.evidence_files?.length ? (
                                    <div className="space-y-2">
                                      {investigation.evidence_files.map(
                                        (file) => (
                                          <div
                                            key={file.stored_name}
                                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3"
                                          >
                                            <div>
                                              <p className="text-sm font-medium text-slate-800">
                                                {file.original_name}
                                              </p>
                                              <p className="text-xs text-slate-500">
                                                {file.content_type} ·{" "}
                                                {(
                                                  file.size / 1024
                                                ).toFixed(1)}{" "}
                                                KB
                                              </p>
                                            </div>

                                            <button
                                              onClick={() =>
                                                openEvidence(
                                                  report.id,
                                                  file.stored_name
                                                )
                                              }
                                              className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50"
                                            >
                                              <Eye size={15} />
                                              Open Evidence
                                            </button>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-slate-500">
                                      No evidence files uploaded.
                                    </p>
                                  )}
                                </div>

                                {report.status ===
                                  "investigation_submitted" ||
                                report.status === "admin_verification" ? (
                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold text-slate-800 mb-3">
                                      Admin Review
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <button
                                        onClick={() =>
                                          reviewInvestigation(
                                            report,
                                            "approved"
                                          )
                                        }
                                        disabled={
                                          reviewingReport === report.id
                                        }
                                        className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
                                      >
                                        <Check size={17} />
                                        Approve
                                      </button>

                                      <button
                                        onClick={() =>
                                          reviewInvestigation(
                                            report,
                                            "rejected"
                                          )
                                        }
                                        disabled={
                                          reviewingReport === report.id
                                        }
                                        className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
                                      >
                                        <XCircle size={17} />
                                        Reject
                                      </button>

                                      <button
                                        onClick={() =>
                                          reviewInvestigation(
                                            report,
                                            "inconclusive"
                                          )
                                        }
                                        disabled={
                                          reviewingReport === report.id
                                        }
                                        className="flex items-center justify-center gap-2 rounded-lg bg-yellow-500 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
                                      >
                                        <AlertTriangle size={17} />
                                        Inconclusive
                                      </button>
                                    </div>

                                    {reviewingReport === report.id && (
                                      <p className="mt-3 text-sm text-slate-500">
                                        Processing review...
                                      </p>
                                    )}
                                  </div>
                                ) : null}

                                {report.status === "admin_verification" && (
                                  <div className="border-t pt-4">
                                    <button
                                      onClick={() => completeReport(report)}
                                      disabled={
                                        reviewingReport === report.id
                                      }
                                      className="w-full rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                                    >
                                      {reviewingReport === report.id
                                        ? "Processing..."
                                        : "Mark Action Completed"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tracking progress */}
                    <div className="mt-4">
                      <button
                        onClick={() =>
                          setExpandedTracking(
                            isExpanded ? null : report.id
                          )
                        }
                        aria-expanded={isExpanded}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition"
                      >
                        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
                          <Activity size={17} className="text-blue-600" />
                          Track Progress

                          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                            {formatLabel(report.status)}
                          </span>
                        </span>

                        {isExpanded ? (
                          <ChevronUp
                            size={18}
                            className="text-slate-500"
                          />
                        ) : (
                          <ChevronDown
                            size={18}
                            className="text-slate-500"
                          />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                          {report.status === "rejected" ||
                          report.status === "inconclusive" ? (
                            <p
                              className={`text-sm font-semibold ${
                                report.status === "rejected"
                                  ? "text-red-700"
                                  : "text-yellow-700"
                              }`}
                            >
                              {report.status === "rejected"
                                ? "Report Rejected"
                                : "Investigation Inconclusive"}
                            </p>
                          ) : progress === -1 ? (
                            <p className="text-sm text-slate-500">
                              Unknown tracking status: {report.status}
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {trackingPhases.map((phase, index) => {
                                const completed = index <= progress;
                                const active = index === progress;

                                return (
                                  <div
                                    key={phase.status}
                                    className="flex items-center gap-3"
                                  >
                                    <div
                                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                                        completed
                                          ? "bg-green-600 text-white"
                                          : "bg-slate-200 text-slate-500"
                                      }`}
                                    >
                                      {completed ? (
                                        <CheckCircle2 size={15} />
                                      ) : (
                                        index + 1
                                      )}
                                    </div>

                                    <span
                                      className={`text-xs ${
                                        active
                                          ? "font-bold text-blue-700"
                                          : completed
                                          ? "text-green-700"
                                          : "text-slate-400"
                                      }`}
                                    >
                                      {phase.label}
                                      {active ? " (Current)" : ""}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {report.updated_at && (
                            <p className="mt-4 border-t pt-3 text-xs text-slate-500">
                              <Clock size={13} className="inline mr-1" />
                              Last updated:{" "}
                              {new Date(report.updated_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Assign officer modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Assign Investigation</h2>

              <button
                onClick={() => setSelectedReport(null)}
                aria-label="Close assignment dialog"
              >
                <X />
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-4">
              Report: {selectedReport.tracking_reference}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Select Local Officer
                </label>

                <select
                  value={officerId}
                  onChange={(e) => setOfficerId(e.target.value)}
                  className="w-full border rounded-lg p-3"
                >
                  <option value="">Choose an officer</option>

                  {officers.map((officer) => (
                    <option key={officer.id} value={officer.id}>
                      {officer.full_name} ({officer.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Investigation Priority
                </label>

                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full border rounded-lg p-3"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Investigation Deadline
                </label>

                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full border rounded-lg p-3"
                />
              </div>

              <button
                onClick={assignReport}
                disabled={assigning || !officerId}
                className="w-full bg-blue-600 text-white font-semibold rounded-lg py-3 disabled:bg-slate-300"
              >
                {assigning ? "Assigning..." : "Confirm Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}