
import { useState } from "react";
import api from "../services/api";

const initialForm = {
  category: "drug_consumer",
  description: "",
  location_text: "",
  latitude: "",
  longitude: "",
  observed_frequency: "",
  observed_quantity: "",
  incident_datetime: "",
};

function ReportForm() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (form.description.trim().length < 20) {
      setError("Please enter at least 20 characters in the description.");
      return;
    }

    if (form.location_text.trim().length < 3) {
      setError("Please enter a location with at least 3 characters.");
      return;
    }

    const payload = {
      category: form.category,
      description: form.description.trim(),
      location_text: form.location_text.trim(),
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
      observed_frequency: form.observed_frequency.trim() || null,
      observed_quantity: form.observed_quantity.trim() || null,
      incident_datetime: form.incident_datetime
        ? new Date(form.incident_datetime).toISOString()
        : null,
    };

    if (
      (payload.latitude === null) !== (payload.longitude === null) ||
      (payload.latitude !== null &&
        (!Number.isFinite(payload.latitude) ||
          payload.latitude < -90 ||
          payload.latitude > 90)) ||
      (payload.longitude !== null &&
        (!Number.isFinite(payload.longitude) ||
          payload.longitude < -180 ||
          payload.longitude > 180))
    ) {
      setError("Please enter valid latitude and longitude together, or leave both blank.");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/reports", payload);

      setMessage(
        response.data?.message ||
          "Your report was submitted successfully."
      );
      setForm(initialForm);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "We couldn't submit your report. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="report-form-section" id="report">
      <div className="report-form-container">
        <div className="report-form-heading">
          <span className="section-tag">CITIZEN REPORTING</span>
          <h2>Report a Drug-Related Activity</h2>
          <p>
            Share accurate information to help the authorities take appropriate
            action. Avoid including unnecessary personal information.
          </p>
        </div>

        <form className="report-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="category">Report category *</label>
            <select
              id="category"
              name="category"
              value={form.category}
              onChange={handleChange}
              required
            >
              <option value="drug_consumer">Drug consumption</option>
              <option value="drug_seller">Drug selling</option>
              <option value="drug_producer">Drug production</option>
              <option value="miscellaneous">Other activity</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="description">Description * (20–5000 characters)</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              minLength={20}
              maxLength={5000}
              rows={5}
              placeholder="Describe what you observed, including relevant details..."
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="location_text">Incident location *</label>
            <input
              id="location_text"
              name="location_text"
              value={form.location_text}
              onChange={handleChange}
              minLength={3}
              maxLength={500}
              placeholder="Enter area, landmark or address"
              required
            />
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="latitude">Latitude (optional)</label>
              <input
                id="latitude"
                name="latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                value={form.latitude}
                onChange={handleChange}
                placeholder="e.g. 31.3260"
              />
            </div>

            <div className="form-field">
              <label htmlFor="longitude">Longitude (optional)</label>
              <input
                id="longitude"
                name="longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                value={form.longitude}
                onChange={handleChange}
                placeholder="e.g. 75.5762"
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="observed_frequency">Observed frequency</label>
              <input
                id="observed_frequency"
                name="observed_frequency"
                value={form.observed_frequency}
                onChange={handleChange}
                maxLength={100}
                placeholder="e.g. Daily, evenings"
              />
            </div>

            <div className="form-field">
              <label htmlFor="observed_quantity">Observed quantity</label>
              <input
                id="observed_quantity"
                name="observed_quantity"
                value={form.observed_quantity}
                onChange={handleChange}
                maxLength={150}
                placeholder="Only if known"
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="incident_datetime">Date and time of incident (optional)</label>
            <input
              id="incident_datetime"
              name="incident_datetime"
              type="datetime-local"
              value={form.incident_datetime}
              onChange={handleChange}
            />
          </div>

          {error && <div className="form-message error">{error}</div>}
          {message && <div className="form-message success">{message}</div>}

          <button className="submit-report-button" type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Submit Anonymous Report"}
          </button>

          <p className="form-privacy-note">
            Please do not include your name, phone number or other identifying
            details in the description. This form does not itself guarantee
            anonymity; that also depends on backend handling.
          </p>
        </form>
      </div>
    </section>
  );
}

export default ReportForm;
