const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer");

const keys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY1,
  process.env.GEMINI_API_KEY2,
  process.env.GEMINI_API_KEY3,
].filter(Boolean);

const interviewReportSchema = z.object({
  matchScore: z
    .number()
    .describe(
      "A score between 0 and 100 indicating how well the candidate's profile matches the job describe",
    ),
  technicalQuestions: z
    .array(
      z.object({
        question: z
          .string()
          .describe("The technical question can be asked in the interview"),
        intention: z
          .string()
          .describe("The intention of interviewer behind asking this question"),
        answer: z
          .string()
          .describe(
            "How to answer this question, what points to cover, what approach to take etc.",
          ),
      }),
    )
    .describe(
      "Technical questions that can be asked in the interview along with their intention and how to answer them",
    ),
  behavioralQuestions: z
    .array(
      z.object({
        question: z
          .string()
          .describe("The technical question can be asked in the interview"),
        intention: z
          .string()
          .describe("The intention of interviewer behind asking this question"),
        answer: z
          .string()
          .describe(
            "How to answer this question, what points to cover, what approach to take etc.",
          ),
      }),
    )
    .describe(
      "Behavioral questions that can be asked in the interview along with their intention and how to answer them",
    ),
  skillGaps: z
    .array(
      z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z
          .enum(["low", "medium", "high"])
          .describe(
            "The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances",
          ),
      }),
    )
    .describe(
      "List of skill gaps in the candidate's profile along with their severity",
    ),
  preparationPlan: z
    .array(
      z.object({
        day: z
          .number()
          .describe("The day number in the preparation plan, starting from 1"),
        focus: z
          .string()
          .describe(
            "The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc.",
          ),
        tasks: z
          .array(z.string())
          .describe(
            "List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.",
          ),
      }),
    )
    .describe(
      "A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively",
    ),
  title: z
    .string()
    .describe(
      "The title of the job for which the interview report is generated",
    ),
  resumeHtml: z.string().describe("HTML resume tailored for this job"),
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithFallback(prompt, schema) {
  for (const key of keys) {
    try {
      console.log("Trying key:", key?.slice(-6));

      const ai = new GoogleGenAI({ apiKey: key });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: zodToJsonSchema(schema),
          temperature: 0.2,
          maxOutputTokens: 2000,
        },
      });

      return JSON.parse(response.text);
    } catch (error) {
      console.log("Error from key:", key?.slice(-6));
      console.log(error.message);

      if (
        error.message.includes("quota") ||
        error.message.includes("RESOURCE_EXHAUSTED") ||
        error.status === 429
      ) {
        console.log("Quota or rate limit hit. Waiting 3 seconds...");

        await delay(32000); // 👈 THIS IS THE RETRY DELAY

        continue;
      }

      throw error;
    }
  }

  throw new Error("All Gemini API keys exhausted");
}

function compressResume(resumeText) {
  const lines = resumeText.split("\n");

  const importantLines = lines.filter((line) =>
    line.match(
      /experience|project|skill|education|react|node|java|python|mongodb|api/i,
    ),
  );

  return importantLines.join("\n");
}

async function generateInterviewReport({
  resume,
  selfDescription,
  jobDescription,
}) {
  const compressedResume = compressResume(resume);
  console.log("Compressed Resume- >", compressedResume);

  const prompt = `
Generate a detailed interview preparation report.

Resume:
${compressedResume}

Self Description:
${selfDescription}

Job Description:
${jobDescription}

Return JSON containing:
- matchScore
- title
- technicalQuestions
- behavioralQuestions
- skillGaps
- preparationPlan
- resumeHtml
`;

  const result = await generateWithFallback(prompt, interviewReportSchema);

  return result;
}

async function generatePdfFromHtml(htmlContent) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
      printBackground: true,
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

async function generateResumePdf(htmlContent) {
  const pdfBuffer = await generatePdfFromHtml(htmlContent);

  return pdfBuffer;
}

module.exports = { generateInterviewReport, generateResumePdf };
