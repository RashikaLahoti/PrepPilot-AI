import {
  getAllInterviewReports,
  generateInterviewReport,
  getInterviewReportById,
  generateResumePdf,
  togglePinInterviewReport,
  deleteInterviewReport,
} from "../services/interview.api";
import { useContext } from "react";
import { InterviewContext } from "../interview.context";

export const useInterview = () => {
  const context = useContext(InterviewContext);

  if (!context) {
    throw new Error("useInterview must be used within an InterviewProvider");
  }

  const { loading, setLoading, report, setReport, reports, setReports } =
    context;

  const generateReport = async ({
    jobDescription,
    selfDescription,
    resumeFile,
  }) => {
    setLoading(true);
    try {
      const response = await generateInterviewReport({
        jobDescription,
        selfDescription,
        resumeFile,
      });

      if (response && response.interviewReport) {
        setReport(response.interviewReport);
        return response.interviewReport;
      }
      throw new Error("Invalid response received from server.");
    } finally {
      setLoading(false);
    }
  };

  const getReportById = async (interviewId) => {
    setLoading(true);
    try {
      const response = await getInterviewReportById(interviewId);
      if (response && response.interviewReport) {
        setReport(response.interviewReport);
        return response.interviewReport;
      }
      throw new Error("Interview report not found.");
    } finally {
      setLoading(false);
    }
  };

  const getReports = async () => {
    const response = await getAllInterviewReports();
    if (response && response.interviewReports) {
      setReports(response.interviewReports);
      return response.interviewReports;
    }
    return [];
  };

  const togglePinReport = async (interviewId) => {
    const response = await togglePinInterviewReport(interviewId);
    return response;
  };

  const deleteReport = async (interviewId) => {
    const response = await deleteInterviewReport(interviewId);
    return response;
  };

  const getResumePdf = async (interviewReportId) => {
    const response = await generateResumePdf({ interviewReportId });
    const url = window.URL.createObjectURL(
      new Blob([response], { type: "application/pdf" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `resume_${interviewReportId}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return true;
  };

  return {
    loading,
    setLoading,
    report,
    setReport,
    reports,
    setReports,
    generateReport,
    getReportById,
    getReports,
    togglePinReport,
    deleteReport,
    getResumePdf,
  };
};
