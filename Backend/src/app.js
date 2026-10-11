const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const app = express()

app.use(express.json())
app.use(cookieParser())

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server or tools with no origin header
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    if (process.env.ALLOWED_ORIGINS) {
      const originsList = process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim());
      if (originsList.includes(origin)) return callback(null, true);
    }

    // Automatically allow Vercel previews and production deploys
    if (origin.endsWith(".vercel.app") || origin.endsWith(".onrender.com")) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
}));
app.set('trust proxy', 1);

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")

/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

/* Global error handling middleware */
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);

    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({
            message: "Invalid JSON payload provided.",
        });
    }

    if (err.name === "MulterError") {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                message: "File size exceeds the 5MB limit.",
            });
        }
        return res.status(400).json({
            message: err.message,
        });
    }

    if (err.message === "Only PDF files are allowed.") {
        return res.status(400).json({
            message: err.message,
        });
    }

    const statusCode = err.status || err.statusCode || 500;
    return res.status(statusCode).json({
        message: statusCode < 500 ? err.message : "An unexpected server error occurred. Please try again.",
    });
});

module.exports = app