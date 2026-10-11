const assert = require("assert");
require("dotenv").config();
const {
  generateInterviewReport,
  parseAndValidateResponse,
  interviewReportSchema,
  compressResume,
  isQuotaError,
  isTransientError,
} = require("../src/services/ai.service");

let passed = 0;
let failed = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`  PASS: ${testName}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${testName}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn();
    console.log(`  PASS: ${testName}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${testName}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function runAllTests() {
  console.log("=== RUNNING AI SERVICE TEST SUITE ===\n");

  // ----------------------------------------------------
  // Scenario 1: Output Token Limit (MAX_TOKENS) Handling
  // ----------------------------------------------------
  console.log("--- Test Category: Token Limit Truncation ---");
  runTest("Should catch MAX_TOKENS finishReason and throw descriptive error without parsing", () => {
    const mockResponse = {
      candidates: [
        {
          finishReason: "MAX_TOKENS",
        },
      ],
      text: '{"matchScore": 85, "title": "Frontend Engineer", "technicalQuestions": [{"question": "What is Clos',
    };

    assert.throws(
      () => parseAndValidateResponse(mockResponse, interviewReportSchema),
      (err) => {
        assert(
          err.message.includes("MAX_TOKENS"),
          `Expected MAX_TOKENS error, got: ${err.message}`,
        );
        return true;
      },
    );
  });

  // ----------------------------------------------------
  // Scenario 2: Safety & Recitation Filters Handling
  // ----------------------------------------------------
  console.log("\n--- Test Category: Safety & Recitation Filters ---");
  runTest("Should handle SAFETY finishReason cleanly", () => {
    const mockResponse = {
      candidates: [{ finishReason: "SAFETY" }],
      text: "",
    };

    assert.throws(
      () => parseAndValidateResponse(mockResponse, interviewReportSchema),
      (err) => {
        assert(err.message.includes("SAFETY"));
        return true;
      },
    );
  });

  // ----------------------------------------------------
  // Scenario 3: Empty or Unusable Responses
  // ----------------------------------------------------
  console.log("\n--- Test Category: Empty or Unusable Responses ---");
  runTest("Should handle null or missing response", () => {
    assert.throws(
      () => parseAndValidateResponse(null, interviewReportSchema),
      /No response received from AI model/,
    );
  });

  runTest("Should handle empty candidates array", () => {
    const mockResponse = { candidates: [] };
    assert.throws(
      () => parseAndValidateResponse(mockResponse, interviewReportSchema),
      /No candidate output returned by AI model/,
    );
  });

  runTest("Should handle empty text response", () => {
    const mockResponse = {
      candidates: [{ finishReason: "STOP" }],
      text: "   ",
    };
    assert.throws(
      () => parseAndValidateResponse(mockResponse, interviewReportSchema),
      /empty text response/,
    );
  });

  // ----------------------------------------------------
  // Scenario 4: Malformed JSON Handling
  // ----------------------------------------------------
  console.log("\n--- Test Category: Malformed JSON Output ---");
  runTest("Should detect genuine malformed JSON and throw clear JSON parse error", () => {
    const mockResponse = {
      candidates: [{ finishReason: "STOP" }],
      text: '{"matchScore": 85, "title": "Developer", "technicalQuestions": [unquotedKey: 123]}',
    };
    assert.throws(
      () => parseAndValidateResponse(mockResponse, interviewReportSchema),
      /Failed to parse AI response as JSON/,
    );
  });

  // ----------------------------------------------------
  // Scenario 5: Schema Validation Failure Handling
  // ----------------------------------------------------
  console.log("\n--- Test Category: Schema Validation Failures ---");
  runTest("Should detect missing required schema fields", () => {
    const mockResponse = {
      candidates: [{ finishReason: "STOP" }],
      text: JSON.stringify({
        matchScore: 90,
        title: "Engineer",
        // Missing technicalQuestions, behavioralQuestions, skillGaps, preparationPlan, resumeHtml
      }),
    };
    assert.throws(
      () => parseAndValidateResponse(mockResponse, interviewReportSchema),
      /AI response does not match the required schema/,
    );
  });

  runTest("Should detect invalid field types (e.g. string matchScore)", () => {
    const mockResponse = {
      candidates: [{ finishReason: "STOP" }],
      text: JSON.stringify({
        matchScore: "ninety",
        title: "Engineer",
        technicalQuestions: [],
        behavioralQuestions: [],
        skillGaps: [],
        preparationPlan: [],
        resumeHtml: "<p>Resume</p>",
      }),
    };
    assert.throws(
      () => parseAndValidateResponse(mockResponse, interviewReportSchema),
      /AI response does not match the required schema/,
    );
  });

  // ----------------------------------------------------
  // Scenario 6: Valid Parsing & Markdown Fence Stripping
  // ----------------------------------------------------
  console.log("\n--- Test Category: Valid Parsing & Code Fences ---");
  runTest("Should successfully parse and validate complete report with markdown code fences", () => {
    const validReport = {
      matchScore: 88,
      title: "Senior Full Stack Engineer",
      technicalQuestions: [
        {
          question: "Explain the Node.js event loop.",
          intention: "Assess async I/O understanding.",
          answer: "Discuss libuv, microtasks, macrotasks, and timers.",
        },
      ],
      behavioralQuestions: [
        {
          question: "Tell me about a difficult bug you solved.",
          intention: "Assess troubleshooting and persistence.",
          answer: "Use STAR framework to describe context, action, and resolution.",
        },
      ],
      skillGaps: [
        {
          skill: "Kubernetes orchestration",
          severity: "medium",
        },
      ],
      preparationPlan: [
        {
          day: 1,
          focus: "Core JavaScript and Async architecture",
          tasks: ["Review promises and microtask queue", "Solve 3 LeetCode problems"],
        },
      ],
      resumeHtml: '<div class="resume"><h1>John Doe</h1><p>Full Stack Engineer</p></div>',
    };

    const mockResponse = {
      candidates: [{ finishReason: "STOP" }],
      text: `\`\`\`json\n${JSON.stringify(validReport)}\n\`\`\``,
    };

    const result = parseAndValidateResponse(mockResponse, interviewReportSchema);
    assert.strictEqual(result.matchScore, 88);
    assert.strictEqual(result.title, "Senior Full Stack Engineer");
    assert.strictEqual(result.technicalQuestions.length, 1);
    assert.strictEqual(result.skillGaps[0].severity, "medium");
  });

  // ----------------------------------------------------
  // Scenario 7: Quota & Transient Error Classification
  // ----------------------------------------------------
  console.log("\n--- Test Category: Error Classification Helpers ---");
  runTest("isQuotaError correctly identifies 429 and RESOURCE_EXHAUSTED", () => {
    assert.strictEqual(isQuotaError({ status: 429 }), true);
    assert.strictEqual(isQuotaError({ message: "RESOURCE_EXHAUSTED" }), true);
    assert.strictEqual(isQuotaError({ message: "quota exceeded for quota metric" }), true);
    assert.strictEqual(isQuotaError({ status: 500 }), false);
    assert.strictEqual(isQuotaError({ status: 400 }), false);
  });

  runTest("isTransientError correctly identifies 503, 500, UNAVAILABLE, and network timeouts", () => {
    assert.strictEqual(isTransientError({ status: 503 }), true);
    assert.strictEqual(isTransientError({ status: 500 }), true);
    assert.strictEqual(isTransientError({ message: "model is UNAVAILABLE" }), true);
    assert.strictEqual(isTransientError({ message: "fetch failed" }), true);
    assert.strictEqual(isTransientError({ status: 429 }), false);
    assert.strictEqual(isTransientError({ status: 400 }), false);
  });

  // ----------------------------------------------------
  // Scenario 8: compressResume Content Retention
  // ----------------------------------------------------
  console.log("\n--- Test Category: Resume Content Retention ---");
  runTest("compressResume preserves relevant skills and experience without logging", () => {
    const resume = `
John Doe
Work Experience:
Senior Software Engineer at ABC Corp
Skills:
React, Node.js, TypeScript, PostgreSQL, Docker
Projects:
High-scale payment gateway processing millions in transactions
Education:
B.S. in Computer Science
`;
    const compressed = compressResume(resume);
    assert(compressed.includes("Senior Software Engineer"));
    assert(compressed.includes("React"));
    assert(compressed.length > 50);
  });

  // ----------------------------------------------------
  // Scenario 9: Live Gemini API Normal Report Generation
  // ----------------------------------------------------
  console.log("\n--- Test Category: Live Gemini Generation (Normal Report) ---");
  await runAsyncTest("generateInterviewReport completes normally with valid schema and budget", async () => {
    const report = await generateInterviewReport({
      resume: `Experienced Full Stack Engineer. Proficient in Node.js, Express, React, MongoDB, PostgreSQL, REST APIs, and Docker. 4 years of experience building web applications.`,
      selfDescription: `Passionate backend and full stack engineer focused on scalable microservices.`,
      jobDescription: `Senior Full Stack Developer at TechFlow Inc. Required: Node.js, React, database design, API security, and system architecture.`,
    });

    assert(typeof report.matchScore === "number", "matchScore must be a number");
    assert(report.matchScore >= 0 && report.matchScore <= 100, "matchScore between 0 and 100");
    assert(typeof report.title === "string" && report.title.length > 0, "title must be non-empty string");
    assert(Array.isArray(report.technicalQuestions) && report.technicalQuestions.length > 0, "technicalQuestions must be non-empty array");
    assert(Array.isArray(report.behavioralQuestions) && report.behavioralQuestions.length > 0, "behavioralQuestions must be non-empty array");
    assert(Array.isArray(report.skillGaps), "skillGaps must be array");
    assert(Array.isArray(report.preparationPlan) && report.preparationPlan.length > 0, "preparationPlan must be non-empty array");
    assert(typeof report.resumeHtml === "string" && report.resumeHtml.length > 50, "resumeHtml must be valid HTML string");
    console.log(`    Generated Report: "${report.title}" (Score: ${report.matchScore})`);
    console.log(`    Technical Questions: ${report.technicalQuestions.length}, Behavioral Questions: ${report.behavioralQuestions.length}`);
    console.log(`    Prep Plan Days: ${report.preparationPlan.length}, Resume HTML chars: ${report.resumeHtml.length}`);
  });

  // ----------------------------------------------------
  // Scenario 10: Live Gemini API Large Candidate Report
  // ----------------------------------------------------
  console.log("\n--- Test Category: Live Gemini Generation (Large Profile) ---");
  await runAsyncTest("generateInterviewReport handles large candidate profile without token exhaustion", async () => {
    const largeResume = `
Summary: Principal Software Architect with 12+ years of experience leading cross-functional engineering teams in fintech, cloud infrastructure, and distributed systems.
Technical Skills: Go, Rust, Node.js, React, Kubernetes, Kafka, Redis, AWS, GCP, Distributed Consensus, Event-Driven Architecture, Microservices, CI/CD, Terraform.
Experience:
- Lead Architect at CloudScale: Spearheaded migration of monolithic banking system to 45 microservices on Kubernetes. Reduced latency by 60% and supported 500k req/sec.
- Senior Backend Lead at FinPay: Designed zero-loss transaction engine processing $2B in monthly volume with multi-region failover.
- Software Engineer at DataStream: Built real-time analytics pipeline with Apache Kafka and ClickHouse.
Education: M.S. in Computer Science, Stanford University.
`;
    const largeJobDescription = `
Principal Distributed Systems Architect at NextGen Global Infrastructure.
We are building a planet-scale financial settlement platform.
Responsibilities:
- Architect ultra-low latency, highly available distributed transaction systems.
- Lead system reliability, chaos engineering, and automated incident recovery.
- Collaborate with executive leadership on technical strategy and platform roadmaps.
Requirements:
- 10+ years in distributed systems, financial software, or high-throughput platforms.
- Deep expertise in consensus algorithms (Raft, Paxos), eventual consistency, and event streaming.
- Fluency in modern cloud native stacks (Kubernetes, AWS/GCP, Kafka, Go/Node).
`;
    const largeReport = await generateInterviewReport({
      resume: largeResume,
      selfDescription: "Veteran software architect with a focus on high throughput, fault tolerance, and developer velocity.",
      jobDescription: largeJobDescription,
    });

    assert(typeof largeReport.matchScore === "number");
    assert(largeReport.technicalQuestions.length >= 3);
    assert(largeReport.behavioralQuestions.length >= 3);
    assert(largeReport.preparationPlan.length >= 3);
    assert(largeReport.resumeHtml.includes("<") && largeReport.resumeHtml.includes(">"));
    console.log(`    Large Report Title: "${largeReport.title}" (Score: ${largeReport.matchScore})`);
    console.log(`    HTML length: ${largeReport.resumeHtml.length} characters`);
  });

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Unhandled test suite error:", err);
  process.exit(1);
});
