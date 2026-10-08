/**
 * server.js - Express API Server for Verdict
 * 
 * Exposes /api/health, /api/verify (text claims), and
 * /api/verify-image (multimodal deepfake & meme/screenshot fact-checking).
 * Includes CORS support to allow requests from the Chrome Extension.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { verify, verifyImage } from "./pipeline.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all incoming requests (required by Chrome Extension and web UI)
app.use(cors());

// Parse incoming JSON request bodies (supports up to 20MB for base64 screenshots/images)
app.use(express.json({ limit: "20mb" }));

/**
 * Health check endpoint for monitoring and deployment verification.
 * GET /api/health
 */
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/**
 * Main text verification endpoint.
 * POST /api/verify
 * Body: { text: "Claim to verify" }
 */
app.post("/api/verify", async (req, res) => {
  const { text } = req.body || {};

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "No text provided" });
  }

  try {
    const result = await verify(text.trim());
    return res.json(result);
  } catch (error) {
    console.error("Verification error in /api/verify:", error);
    return res.status(500).json({ error: "Verification failed" });
  }
});

/**
 * Multimodal image & deepfake verification endpoint.
 * POST /api/verify-image
 * Body: { image: "https://... or data:image/png;base64,..." }
 */
app.post("/api/verify-image", async (req, res) => {
  const { image } = req.body || {};

  if (!image || typeof image !== "string" || image.trim().length === 0) {
    return res.status(400).json({ error: "No image provided" });
  }

  try {
    const result = await verifyImage(image.trim());
    return res.json(result);
  } catch (error) {
    console.error("Verification error in /api/verify-image:", error);
    return res.status(500).json({ error: "Image verification failed: " + error.message });
  }
});

// Start listening if executed directly (and export app for Vercel/serverless support)
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Verdict backend running on http://localhost:${PORT}`);
  });
}

export default app;
