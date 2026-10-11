import React, { useState, useRef, useEffect, useMemo } from "react";
import "../style/home.scss";
import { useInterview } from "../hooks/useInterview.js";
import { useNavigate } from "react-router";
import { useAuth } from "../../auth/hooks/useAuth.js";
import { notify } from "../../../utils/toast";
import { getErrorMessage } from "../../../utils/errorHandler";

const Home = () => {
  const {
    loading,
    generateReport,
    reports,
    setReports,
    getReports,
    togglePinReport,
    deleteReport,
  } = useInterview();

  const { user, handleLogout } = useAuth();
  const [jobDescription, setJobDescription] = useState("");
  const [selfDescription, setSelfDescription] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [jobError, setJobError] = useState(false);
  const [selfError, setSelfError] = useState(false);
  const [resumeError, setResumeError] = useState(false);
  const [isFetchingReports, setIsFetchingReports] = useState(true);
  const [pinningIds, setPinningIds] = useState(new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const resumeInputRef = useRef();

  const navigate = useNavigate();

  // Helper to ensure plans are sorted with pinned first, then by date descending
  const sortPlans = (plans) => {
    return [...plans].sort((a, b) => {
      const aPinned = Boolean(a.isPinned);
      const bPinned = Boolean(b.isPinned);
      if (aPinned !== bPinned) return bPinned ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  };

  // Load recent interview plans on mount
  useEffect(() => {
    let isMounted = true;
    setIsFetchingReports(true);
    getReports()
      .then((data) => {
        if (isMounted && data) {
          setReports(sortPlans(data));
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to fetch recent reports:", err);
          notify.error("Unable to load recent interview plans.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsFetchingReports(false);
        }
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedReports = useMemo(() => {
    return sortPlans(reports || []);
  }, [reports]);

  const handleFileChange = (file) => {
    if (!file) return;

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setResumeError(true);
      notify.error("Only PDF files are supported. Please upload a PDF resume.");
      if (resumeInputRef.current) resumeInputRef.current.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setResumeError(true);
      notify.error("File size exceeds 5MB limit. Please upload a smaller PDF.");
      if (resumeInputRef.current) resumeInputRef.current.value = "";
      return;
    }

    setResumeFile(file);
    setResumeError(false);
  };

  const handleGenerateReport = async () => {
    let hasError = false;

    if (!jobDescription || jobDescription.trim().length === 0) {
      setJobError(true);
      notify.error("Target job description is required.");
      hasError = true;
    }

    if (!selfDescription || selfDescription.trim().length === 0) {
      setSelfError(true);
      notify.error("Quick self-description is required.");
      hasError = true;
    }

    if (!resumeFile) {
      setResumeError(true);
      notify.error("Please upload your resume in PDF format.");
      hasError = true;
    }

    if (hasError) return;

    setJobError(false);
    setSelfError(false);
    setResumeError(false);

    try {
      const data = await generateReport({
        jobDescription: jobDescription.trim(),
        selfDescription: selfDescription.trim(),
        resumeFile,
      });

      if (data && data._id) {
        notify.success("Interview strategy generated successfully!");
        navigate(`/interview/${data._id}`);
      } else {
        throw new Error("Unable to load created interview plan.");
      }
    } catch (err) {
      const errorMsg = getErrorMessage(
        err,
        "Failed to generate interview strategy. Please try again."
      );
      notify.error(errorMsg);
    }
  };

  // Toggle pin/unpin with optimistic UI and duplicate-click protection
  const handleTogglePin = async (e, plan) => {
    e.stopPropagation();

    if (pinningIds.has(plan._id)) return;

    setPinningIds((prev) => new Set(prev).add(plan._id));

    const previousReports = [...reports];
    const newPinnedStatus = !plan.isPinned;

    // Optimistic UI update
    setReports((prev) =>
      sortPlans(
        prev.map((item) =>
          item._id === plan._id ? { ...item, isPinned: newPinnedStatus } : item
        )
      )
    );

    try {
      const res = await togglePinReport(plan._id);
      notify.success(
        res.message ||
          (newPinnedStatus ? "Interview plan pinned." : "Interview plan unpinned.")
      );
    } catch (err) {
      // Revert on error
      setReports(previousReports);
      notify.error(
        getErrorMessage(err, "Failed to update pin status. Please try again.")
      );
    } finally {
      setPinningIds((prev) => {
        const next = new Set(prev);
        next.delete(plan._id);
        return next;
      });
    }
  };

  // Open delete confirmation modal
  const handleDeleteClick = (e, plan) => {
    e.stopPropagation();
    setDeleteTarget(plan);
  };

  // Confirm delete request
  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteReport(deleteTarget._id);
      setReports((prev) => prev.filter((item) => item._id !== deleteTarget._id));
      notify.success("Interview plan deleted successfully.");
      setDeleteTarget(null);
    } catch (err) {
      notify.error(
        getErrorMessage(err, "Failed to delete interview plan. Please try again.")
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
  };

  const onLogout = async () => {
    try {
      await handleLogout();
      notify.success("Logged out successfully.");
      navigate("/login", { replace: true });
    } catch {
      notify.error("Failed to log out. Please try again.");
    }
  };

  if (loading) {
    return (
      <main className="loading-screen">
        <h1>Loading your interview plan...</h1>
        <p style={{ marginTop: "0.5rem", color: "#7d8590", fontSize: "0.9rem" }}>
          AI analysis in progress (approx 30s). Please wait...
        </p>
      </main>
    );
  }

  return (
    <div className="home-page">
      {/* Page Header */}
      <header className="page-header">
        <span className="welcome-text">Hi {user?.username || "there"},</span>
        <h1>
          Create Your Custom <span className="highlight">Interview Plan</span>
        </h1>
        <p>
          Let our AI analyze the job requirements and your unique profile to
          build a winning strategy.
        </p>
      </header>

      {/* Main Card */}
      <div className="interview-card">
        <div className="interview-card__body">
          {/* Left Panel - Job Description */}
          <div className="panel panel--left">
            <div className="panel__header">
              <span className="panel__icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </span>
              <h2>Target Job Description</h2>
              <span className="badge badge--required">Required</span>
            </div>
            <textarea
              value={jobDescription}
              onChange={(e) => {
                setJobDescription(e.target.value);
                if (e.target.value.trim().length > 0) setJobError(false);
              }}
              className={`panel__textarea ${jobError ? "panel__textarea--error" : ""}`}
              placeholder={`Paste the full job description here...\ne.g. 'Senior Frontend Engineer at Google requires proficiency in React, TypeScript, and large-scale system design...'`}
              maxLength={5000}
            />
            {jobError && (
              <span className="error-message">Job description is required</span>
            )}
            <div className="char-counter">{jobDescription.length} / 5000 chars</div>
          </div>

          {/* Vertical Divider */}
          <div className="panel-divider" />

          {/* Right Panel - Profile */}
          <div className="panel panel--right">
            <div className="panel__header">
              <span className="panel__icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <h2>Your Profile</h2>
            </div>

            {/* Upload Resume */}
            <div className="upload-section">
              <label className="section-label">
                Upload Resume
                <span className="badge badge--best">PDF Only</span>
              </label>
              <label className={`dropzone ${resumeError ? "dropzone--error" : ""}`} htmlFor="resume">
                <span className="dropzone__icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="16 16 12 12 8 16" />
                    <line x1="12" y1="12" x2="12" y2="21" />
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                  </svg>
                </span>
                <p className="dropzone__title">
                  {resumeFile ? resumeFile.name : "Click to upload or drag & drop"}
                </p>
                <p className="dropzone__subtitle">
                  {resumeFile ? `${(resumeFile.size / 1024 / 1024).toFixed(2)} MB` : "PDF (Max 5MB)"}
                </p>
                <input
                  ref={resumeInputRef}
                  hidden
                  type="file"
                  id="resume"
                  name="resume"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    handleFileChange(e.target.files[0]);
                  }}
               />
              </label>
              {resumeError && (
                <span className="error-message">Valid PDF resume is required</span>
              )}
            </div>

            {/* Quick Self-Description */}
            <div className="self-description">
              <label className="section-label" htmlFor="selfDescription">
                Quick Self-Description
              </label>
              <textarea
                value={selfDescription}
                onChange={(e) => {
                  setSelfDescription(e.target.value);
                  if (e.target.value.trim().length > 0) setSelfError(false);
                }}
                id="selfDescription"
                name="selfDescription"
                className={`panel__textarea panel__textarea--short ${selfError ? "panel__textarea--error" : ""}`}
                placeholder="Briefly describe your experience, key skills, and years of experience..."
              />
              {selfError && (
                <span className="error-message">Self description is required</span>
              )}
            </div>

            {/* Ready Indicator */}
            {(() => {
              const filledCount = [
                jobDescription.trim().length > 0,
                !!resumeFile,
                selfDescription.trim().length > 0,
              ].filter(Boolean).length;
              const isComplete = filledCount === 3;
              const pct = Math.round((filledCount / 3) * 100);

              return (
                <div className={`ready-indicator ${isComplete ? "ready-indicator--complete" : filledCount > 0 ? "ready-indicator--progress" : ""}`}>
                  <div className="ready-indicator__header">
                    <span className="ready-indicator__icon">
                      {isComplete ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      )}
                    </span>
                    <span className="ready-indicator__label">
                      {isComplete
                        ? "Ready to generate your strategy."
                        : filledCount > 0
                        ? `${filledCount} of 3 inputs filled — keep going…`
                        : "Awaiting inputs to begin analysis…"}
                    </span>
                    {filledCount > 0 && !isComplete && (
                      <span className="ready-indicator__pct">{pct}%</span>
                    )}
                  </div>
                  <div className="ready-indicator__track">
                    <div
                      className="ready-indicator__fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Card Footer */}
        <div className="interview-card__footer">
          <span className="footer-info">
            AI-Powered Strategy Generation &bull; Approx 30s
          </span>
          <button
            onClick={handleGenerateReport}
            className="generate-btn"
            disabled={loading}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
            </svg>
            {loading ? "Generating Strategy..." : "Generate My Interview Strategy"}
          </button>
        </div>
      </div>

      {/* Recent Reports List */}
      <section className="recent-reports">
        <div className="recent-reports__header">
          <h2>My Recent Interview Plans</h2>
          {sortedReports.length > 0 && (
            <span className="plans-counter">
              {sortedReports.length} {sortedReports.length === 1 ? "plan" : "plans"}
            </span>
          )}
        </div>

        {isFetchingReports ? (
          <div className="reports-loading">
            <div className="loading-spinner" />
            <p>Loading your interview plans...</p>
          </div>
        ) : sortedReports.length > 0 ? (
          <ul className="reports-list">
            {sortedReports.map((item) => (
              <li
                key={item._id}
                className={`report-item ${item.isPinned ? "report-item--pinned" : ""}`}
                onClick={() => navigate(`/interview/${item._id}`)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    navigate(`/interview/${item._id}`);
                  }
                }}
              >
                <div className="report-item__top">
                  <div className="title-area">
                    {item.isPinned && (
                      <span className="pinned-badge" title="Pinned plan">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M16 3a1 1 0 0 1 .117 1.993L16 5v4.586l1.707 1.707A1 1 0 0 1 18 12v2a1 1 0 0 1-.883.993L17 15h-4v6a1 1 0 0 1-1.993.117L11 21v-6H7a1 1 0 0 1-.993-.883L6 14v-2a1 1 0 0 1 .206-.608l.087-.099L8 9.586V5a1 1 0 0 1-.117-1.993L8 3h8z" />
                        </svg>
                        Pinned
                      </span>
                    )}
                    <h3 className="report-title" title={item.title || "Untitled Position"}>
                      {item.title || "Untitled Position"}
                    </h3>
                  </div>

                  {/* Actions: Pin & Delete */}
                  <div
                    className="card-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={`action-btn action-btn--pin ${item.isPinned ? "action-btn--pinned" : ""}`}
                      onClick={(e) => handleTogglePin(e, item)}
                      title={item.isPinned ? "Unpin plan" : "Pin plan to top"}
                      aria-label={item.isPinned ? "Unpin interview plan" : "Pin interview plan to top"}
                      disabled={pinningIds.has(item._id)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill={item.isPinned ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M16 3a1 1 0 0 1 .117 1.993L16 5v4.586l1.707 1.707A1 1 0 0 1 18 12v2a1 1 0 0 1-.883.993L17 15h-4v6a1 1 0 0 1-1.993.117L11 21v-6H7a1 1 0 0 1-.993-.883L6 14v-2a1 1 0 0 1 .206-.608l.087-.099L8 9.586V5a1 1 0 0 1-.117-1.993L8 3h8z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      className="action-btn action-btn--delete"
                      onClick={(e) => handleDeleteClick(e, item)}
                      title="Delete interview plan"
                      aria-label="Delete interview plan"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </div>

                <p className="report-meta">
                  Generated on{" "}
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>

                <div className="report-item__bottom">
                  <span
                    className={`match-score ${
                      item.matchScore >= 80
                        ? "score--high"
                        : item.matchScore >= 60
                        ? "score--mid"
                        : "score--low"
                    }`}
                  >
                    Match Score: {item.matchScore}%
                  </span>
                  <span className="view-link">View Plan &rarr;</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="reports-empty-state">
            <div className="empty-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h3>No interview plans yet</h3>
            <p>
              Fill in your target job description and profile above to generate
              your first AI-tailored strategy.
            </p>
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="modal-backdrop"
          onClick={handleCancelDelete}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon modal-icon--danger">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div>
                <h3 id="modal-title">Delete Interview Plan?</h3>
                <p className="modal-desc">
                  Are you sure you want to delete the plan for{" "}
                  <strong>"{deleteTarget.title || "this position"}"</strong>? This
                  will permanently remove the plan and cannot be undone.
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="modal-btn modal-btn--cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="modal-btn modal-btn--delete"
              >
                {isDeleting ? "Deleting..." : "Delete Plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Footer */}
      <footer className="page-footer">
        <div className="footer-links">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Help Center</a>
        </div>
        <button onClick={onLogout} className="logout-btn">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </footer>
    </div>
  );
};

export default Home;
