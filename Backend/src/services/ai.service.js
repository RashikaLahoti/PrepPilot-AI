const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const puppeteer = require("puppeteer");

// Model configuration
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.8-flash";
// Budget calibrated for candidate report + reasoning tokens (model supports up to 65536)
const MAX_OUTPUT_TOKENS = 8192;
const TEMPERATURE = 0.2;

// Bounded retry parameters
const MAX_TRANSIENT_RETRIES = 2;
const TRANSIENT_BACKOFF_MS = 1500;
const MAX_MALFORMED_RETRIES = 1;

/**
 * Read configured Gemini API keys from environment
 */
function getApiKeys() {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY1,
    process.env.GEMINI_API_KEY2,
    process.env.GEMINI_API_KEY3,
  ].filter(Boolean);
}

/**
 * Mask API key for safe diagnostics
 */
function maskKey(key) {
  if (!key || typeof key !== "string") return "unknown";
  return `...${key.slice(-4)}`;
}

/**
 * Zod schema matching the interview preparation report requirements
 */
const interviewReportSchema = z.object({
  matchScore: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "A score between 0 and 100 indicating how well the candidate's profile matches the job description",
    ),
  technicalQuestions: z
    .array(
      z.object({
        question: z
          .string()
          .min(1)
          .describe("The technical question that can be asked in the interview"),
        intention: z
          .string()
          .min(1)
          .describe("The intention of interviewer behind asking this question"),
        answer: z
          .string()
          .min(1)
          .describe(
            "How to answer this question, what points to cover, what approach to take etc.",
          ),
      }),
    )
    .min(1)
    .describe(
      "Technical questions that can be asked in the interview along with their intention and how to answer them",
    ),
  behavioralQuestions: z
    .array(
      z.object({
        question: z
          .string()
          .min(1)
          .describe("The behavioral question that can be asked in the interview"),
        intention: z
          .string()
          .min(1)
          .describe("The intention of interviewer behind asking this question"),
        answer: z
          .string()
          .min(1)
          .describe(
            "How to answer this question, what points to cover, what approach to take etc.",
          ),
      }),
    )
    .min(1)
    .describe(
      "Behavioral questions that can be asked in the interview along with their intention and how to answer them",
    ),
  skillGaps: z
    .array(
      z.object({
        skill: z.string().min(1).describe("The skill which the candidate is lacking"),
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
          .int()
          .positive()
          .describe("The day number in the preparation plan, starting from 1"),
        focus: z
          .string()
          .min(1)
          .describe(
            "The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc.",
          ),
        tasks: z
          .array(z.string().min(1))
          .min(1)
          .describe(
            "List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.",
          ),
      }),
    )
    .min(1)
    .describe(
      "A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively",
    ),
  title: z
    .string()
    .min(1)
    .describe(
      "The title of the job for which the interview report is generated",
    ),
  resumeHtml: z
    .string()
    .min(1)
    .describe("Clean, valid semantic HTML resume tailored for this job"),
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clean markdown wrapping if present
 */
function cleanJsonString(rawText) {
  if (!rawText || typeof rawText !== "string") return "";
  let text = rawText.trim();
  if (text.startsWith("```json")) {
    text = text.slice(7);
  } else if (text.startsWith("```")) {
    text = text.slice(3);
  }
  if (text.endsWith("```")) {
    text = text.slice(0, -3);
  }
  return text.trim();
}

/**
 * Validate Gemini response candidate and extract/validate JSON object
 */
function parseAndValidateResponse(response, schema) {
  if (!response) {
    throw new Error("No response received from AI model.");
  }

  const candidate = response.candidates?.[0];
  if (!candidate) {
    throw new Error("No candidate output returned by AI model.");
  }

  const finishReason = candidate.finishReason;

  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      "AI generation was truncated because the output token limit was reached (finishReason: MAX_TOKENS).",
    );
  }

  if (finishReason === "SAFETY") {
    throw new Error(
      "AI generation was blocked by safety filters (finishReason: SAFETY).",
    );
  }

  if (finishReason === "RECITATION") {
    throw new Error(
      "AI generation was blocked by recitation filters (finishReason: RECITATION).",
    );
  }

  const rawText = cleanJsonString(response.text);
  if (!rawText) {
    throw new Error("AI model returned an empty text response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (parseError) {
    throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
  }

  const validationResult = schema.safeParse(parsed);
  if (!validationResult.success) {
    const errorDetails = validationResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`AI response does not match the required schema: ${errorDetails}`);
  }

  return validationResult.data;
}

/**
 * Classify if error is caused by quota/rate exhaustion
 */
function isQuotaError(error) {
  if (!error) return false;
  if (error.status === 429) return true;
  const msg = (error.message || "").toUpperCase();
  return (
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("QUOTA") ||
    msg.includes("RATE_LIMIT")
  );
}

/**
 * Classify if error is transient (temporary network or server spike)
 */
function isTransientError(error) {
  if (!error) return false;
  if (error.status === 503 || error.status === 500) return true;
  const msg = (error.message || "").toUpperCase();
  return (
    msg.includes("UNAVAILABLE") ||
    msg.includes("HIGH DEMAND") ||
    msg.includes("FETCH FAILED") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT")
  );
}

/**
 * Generate structured content using Gemini with key rotation and bounded retries
 */
async function generateWithFallback(prompt, schema) {
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new Error("No Gemini API keys are configured in environment variables.");
  }

  const jsonSchema = zodToJsonSchema(schema);
  let lastError = null;

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const key = keys[keyIndex];
    const masked = maskKey(key);

    let transientAttempts = 0;
    let malformedAttempts = 0;

    while (transientAttempts <= MAX_TRANSIENT_RETRIES) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });

        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: jsonSchema,
            temperature: TEMPERATURE,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        });

        // Parse and validate with schema
        return parseAndValidateResponse(response, schema);
      } catch (error) {
        lastError = error;

        // 1. Quota or rate limit error: Rotate immediately to next key
        if (isQuotaError(error)) {
          console.warn(
            `[AI Service] API key ${masked} hit quota/rate limit. Rotating to next key.`,
          );
          break; // Exit retry loop for this key, try next key in outer loop
        }

        // 2. Authentication failure: Move to next key immediately
        if (error.status === 401 || error.status === 403) {
          console.warn(
            `[AI Service] API key ${masked} authentication failed (${error.status}). Rotating to next key.`,
          );
          break; // Move to next key
        }

        // 3. Transient server or network error: Retry with bounded backoff on same key
        if (isTransientError(error) && transientAttempts < MAX_TRANSIENT_RETRIES) {
          transientAttempts++;
          const waitTime = TRANSIENT_BACKOFF_MS * transientAttempts;
          console.warn(
            `[AI Service] Transient error on key ${masked}. Retrying in ${waitTime}ms (attempt ${transientAttempts}/${MAX_TRANSIENT_RETRIES})...`,
          );
          await delay(waitTime);
          continue;
        }

        // 4. Token limit truncation: Do not switch keys (model limit, not key quota)
        if (error.message && error.message.includes("MAX_TOKENS")) {
          console.error(
            `[AI Service] Output token limit exceeded. Generation truncated.`,
          );
          throw error;
        }

        // 5. Malformed JSON or Schema mismatch: Bounded retry, DO NOT switch API keys
        if (
          error.message &&
          (error.message.includes("Failed to parse AI response as JSON") ||
            error.message.includes("AI response does not match the required schema"))
        ) {
          if (malformedAttempts < MAX_MALFORMED_RETRIES) {
            malformedAttempts++;
            console.warn(
              `[AI Service] Malformed or invalid AI response. Performing bounded retry (attempt ${malformedAttempts}/${MAX_MALFORMED_RETRIES})...`,
            );
            await delay(1000);
            continue;
          }
          console.error(
            `[AI Service] Malformed JSON or schema validation failed after retry. Aborting without key rotation.`,
          );
          throw error;
        }

        // 6. Any other permanent error (e.g. 400 Bad Request, safety filters): Throw immediately
        throw error;
      }
    }
  }

  // All keys exhausted
  if (lastError && isQuotaError(lastError)) {
    throw new Error(
      "All configured Gemini API keys have exceeded their quota or rate limits. Please try again later.",
    );
  }

  throw (
    lastError ||
    new Error("Failed to generate AI interview report: all available attempts exhausted.")
  );
}

/**
 * Filter resume text intelligently without losing key candidate content
 */
function compressResume(resumeText) {
  if (!resumeText || typeof resumeText !== "string") {
    return "";
  }

  const lines = resumeText.split("\n");
  const importantLines = lines.filter((line) =>
    line.match(
      /experience|project|skill|education|work|summary|certif|tech|award|role|responsib|developer|engineer/i,
    ),
  );

  // If filtered lines retain reasonable content, use them; otherwise use trimmed resume
  const filtered = importantLines.join("\n").trim();
  if (filtered.length >= 100) {
    return filtered.slice(0, 10000);
  }

  return resumeText.trim().slice(0, 10000);
}

/**
 * Generate interview report given candidate profile and target job
 */
async function generateInterviewReport({
  resume,
  selfDescription,
  jobDescription,
}) {
  const compressedResume = compressResume(resume);

  const prompt = `
You are an expert technical interviewer and career coach.
Generate a comprehensive interview preparation report and tailored resume for the candidate based on the provided details.

Resume Details:
${compressedResume || "Not provided"}

Candidate Self-Description:
${selfDescription || "Not provided"}

Target Job Description:
${jobDescription || "Not provided"}

Instructions:
1. Provide a realistic matchScore (0 to 100) reflecting how well the candidate fits the target job.
2. Provide a clear job title for the report.
3. Generate 3 to 5 relevant technicalQuestions tailored to the role and tech stack. For each, include:
   - question: The technical question
   - intention: What the interviewer is evaluating
   - answer: Recommended structure, key points to cover, and technical approach
4. Generate 3 to 5 relevant behavioralQuestions assessing communication, teamwork, and problem-solving. For each, include:
   - question: The behavioral question
   - intention: What the interviewer is evaluating
   - answer: How to structure the response (using STAR framework principles)
5. Identify specific skillGaps between the candidate and the job requirements, with severity ("low", "medium", or "high").
6. Provide a structured 5 to 7 day preparationPlan with daily focus and concrete actionable tasks.
7. For resumeHtml: Provide a clean, professionally formatted, single-page HTML resume tailored specifically for this target job.
   - Structure using semantic HTML (e.g., <div>, <header>, <section>, <h1>, <h2>, <h3>, <p>, <ul>, <li>).
   - Use clean, modern inline CSS styles (margins, padding, subtle borders, clean typography).
   - Output valid HTML markup inside the JSON string without markdown code fences or backticks.

Return ONLY a valid JSON object strictly conforming to the required schema.
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

module.exports = {
  generateInterviewReport,
  generateResumePdf,
  generatePdfFromHtml,
  generateWithFallback,
  parseAndValidateResponse,
  interviewReportSchema,
  compressResume,
  isQuotaError,
  isTransientError,
};

