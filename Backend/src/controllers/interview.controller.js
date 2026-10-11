const mongoose = require("mongoose");
const pdfParse = require("pdf-parse");
const {
  generateInterviewReport,
  generateResumePdf,
} = require("../services/ai.service");
const interviewReportModel = require("../models/interviewReport.model");

/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Resume PDF file is required.",
      });
    }

    const { selfDescription, jobDescription } = req.body;

    if (!jobDescription || !jobDescription.trim()) {
      return res.status(400).json({
        message: "Job description is required.",
      });
    }

    if (!selfDescription || !selfDescription.trim()) {
      return res.status(400).json({
        message: "Self description is required.",
      });
    }

    let resumeContent;
    try {
      const parsed = await new pdfParse.PDFParse(
        Uint8Array.from(req.file.buffer),
      ).getText();
      resumeContent = parsed.text;
    } catch (parseErr) {
      console.error("PDF parse error:", parseErr);
      return res.status(400).json({
        message: "Unable to parse resume PDF. Please ensure it is a valid PDF document.",
      });
    }

    const interViewReportByAi = await generateInterviewReport({
      resume: resumeContent,
      selfDescription,
      jobDescription,
    });

    const interviewReport = await interviewReportModel.create({
      user: req.user.id,
      resume: resumeContent,
      selfDescription,
      jobDescription,
      ...interViewReportByAi,
    });

    return res.status(201).json({
      message: "Interview report generated successfully.",
      interviewReport,
    });
  } catch (err) {
    console.error("Generate interview report error:", err);
    return res.status(500).json({
      message: "Failed to generate interview report. Please try again later.",
    });
  }
}

/**
 * Get interview report by ID
 */
async function getInterviewReportByIdController(req, res) {
  try {
    const { interviewId } = req.params;

    const interviewReport = await interviewReportModel.findOne({
      _id: interviewId,
      user: req.user.id,
    });

    if (!interviewReport) {
      return res.status(404).json({
        message: "Interview report not found.",
      });
    }

    return res.status(200).json({
      message: "Interview report fetched successfully.",
      interviewReport,
    });
  } catch (err) {
    console.error("Error fetching interview report:", err);
    return res.status(500).json({
      message: "Error fetching interview report.",
    });
  }
}

/**
 * Get all reports
 */
async function getAllInterviewReportsController(req, res) {
  try {
    const interviewReports = await interviewReportModel
      .find({ user: req.user.id })
      .sort({ isPinned: -1, createdAt: -1 })
      .select(
        "-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan -resumeHtml",
      );

    return res.status(200).json({
      message: "Interview reports fetched successfully.",
      interviewReports,
    });
  } catch (err) {
    console.error("Error fetching interview reports:", err);
    return res.status(500).json({
      message: "Error fetching interview reports.",
    });
  }
}

/**
 * Toggle pin/unpin interview report
 */
async function togglePinInterviewReportController(req, res) {
  try {
    const { interviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({
        message: "Invalid interview report ID.",
      });
    }

    const interviewReport = await interviewReportModel.findOne({
      _id: interviewId,
      user: req.user.id,
    });

    if (!interviewReport) {
      return res.status(404).json({
        message: "Interview report not found.",
      });
    }

    interviewReport.isPinned = !interviewReport.isPinned;
    await interviewReport.save();

    return res.status(200).json({
      message: interviewReport.isPinned
        ? "Interview plan pinned."
        : "Interview plan unpinned.",
      interviewReport,
    });
  } catch (err) {
    console.error("Error toggling pin status:", err);
    return res.status(500).json({
      message: "Failed to update pin status. Please try again.",
    });
  }
}

/**
 * Delete interview report
 */
async function deleteInterviewReportController(req, res) {
  try {
    const { interviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({
        message: "Invalid interview report ID.",
      });
    }

    const deletedReport = await interviewReportModel.findOneAndDelete({
      _id: interviewId,
      user: req.user.id,
    });

    if (!deletedReport) {
      return res.status(404).json({
        message: "Interview report not found.",
      });
    }

    return res.status(200).json({
      message: "Interview plan deleted successfully.",
      deletedId: interviewId,
    });
  } catch (err) {
    console.error("Error deleting interview report:", err);
    return res.status(500).json({
      message: "Failed to delete interview report. Please try again.",
    });
  }
}

/**
 * Generate resume PDF
 */
async function generateResumePdfController(req, res) {
  try {
    const { interviewReportId } = req.params;

    const interviewReport =
      await interviewReportModel.findById(interviewReportId);

    if (!interviewReport) {
      return res.status(404).json({
        message: "Interview report not found.",
      });
    }

    const pdfBuffer = await generateResumePdf(interviewReport.resumeHtml);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`,
    });

    return res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF generation error:", err);

    return res.status(500).json({
      message: "Error generating resume PDF. Please try again later.",
    });
  }
}

module.exports = {
  generateInterViewReportController,
  getInterviewReportByIdController,
  getAllInterviewReportsController,
  togglePinInterviewReportController,
  deleteInterviewReportController,
  generateResumePdfController,
};
