/**
 * pipeline.js - Evidence-Grounded Verification Pipeline
 * 
 * Implements claim extraction, web evidence retrieval via Tavily,
 * strictly grounded verification reasoning via Groq LLM, and
 * multimodal image forensics / deepfake detection via Groq Qwen Vision.
 */

import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { callLLM, callVisionLLM } from "./llm.js";

/**
 * 1. Extract 1-3 atomic, checkable factual claims from the input text.
 * 
 * @param {string} text - The input statement or passage to analyze.
 * @returns {Promise<string[]>} Array of factual claims extracted.
 */
export async function extractClaims(text) {
  const messages = [
    {
      role: "system",
      content:
        'You are an analytical claim extractor. Split the user input into 1-3 atomic, checkable factual claims. Return a JSON object in this exact format: {"claims": ["...", "..."]}. Ignore subjective opinions, future predictions, emotional statements, and vague commentary. Extract at most 3 claims.'
    },
    {
      role: "user",
      content: text
    }
  ];

  const rawJson = await callLLM(messages, { json: true });
  const parsed = JSON.parse(rawJson);
  return Array.isArray(parsed.claims) ? parsed.claims : [];
}

/**
 * 2. Search web evidence for a specific claim using the Tavily Search API.
 * 
 * @param {string} claim - The claim query to search evidence for.
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>} List of retrieved source snippets.
 */
export async function searchEvidence(claim) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is missing from environment variables.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      query: claim,
      max_results: 6,
      search_depth: "basic"
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const results = data.results || [];

  return results.map((r) => ({
    title: r.title || "Untitled",
    url: r.url || "",
    snippet: (r.content || "").slice(0, 500)
  }));
}

/**
 * 3. Judge the claim strictly using retrieved evidence.
 * 
 * @param {string} claim - The claim being verified.
 * @param {Array<{title: string, url: string, snippet: string}>} sources - The evidence sources.
 * @returns {Promise<{verdict: string, confidence: number, reasoning: string, source_indexes: number[]}>}
 */
export async function judge(claim, sources) {
  const evidenceList = sources.map((s, index) => {
    return `[${index + 1}] Title: ${s.title}\nURL: ${s.url}\nSnippet: ${s.snippet}`;
  }).join("\n\n");

  const messages = [
    {
      role: "system",
      content:
        'You are a fact-checker. Judge the claim ONLY using the evidence provided. Never use outside knowledge. If evidence is insufficient or contradictory, say UNVERIFIABLE. Return a JSON object with this exact schema:\n' +
        '{\n' +
        '  "verdict": "TRUE" | "FALSE" | "MISLEADING" | "UNVERIFIABLE",\n' +
        '  "confidence": 0.0 to 1.0,\n' +
        '  "reasoning": "2-3 sentences citing [1], [2] etc.",\n' +
        '  "source_indexes": [1, 3]\n' +
        '}'
    },
    {
      role: "user",
      content: `Claim: ${claim}\n\nEvidence:\n${evidenceList || "No evidence sources available."}`
    }
  ];

  const rawJson = await callLLM(messages, { json: true });
  return JSON.parse(rawJson);
}

/**
 * 4. Main text verification function.
 * 
 * @param {string} text - User text to verify.
 * @returns {Promise<Object>} Full verification report.
 */
export async function verify(text) {
  const claims = await extractClaims(text);
  const claim = claims.length > 0 ? claims[0] : text;
  const sources = await searchEvidence(claim);
  const result = await judge(claim, sources);

  const citedSources = (result.source_indexes || [])
    .map((index) => sources[index - 1])
    .filter(Boolean);

  return {
    claim,
    ...result,
    sources: citedSources
  };
}

/**
 * Helper: Converts an image URL or buffer to a base64 data URL.
 * Safely fetches with user-agent to bypass anti-hotlinking blocks.
 * 
 * @param {string} input - An http/https URL or an existing data:image URL.
 * @returns {Promise<string>} Base64 data URL.
 */
async function toBase64DataUrl(input) {
  if (typeof input !== "string") {
    throw new Error("Invalid image input");
  }

  if (input.startsWith("data:image/")) {
    return input;
  }

  const response = await fetch(input, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download image (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

/**
 * 5. Forensic analysis of an image: extracts text/claims and checks for AI/deepfake artifacts.
 * 
 * @param {string} imageUrlOrBase64 - Image URL or base64 data URL.
 * @returns {Promise<{claims: string[], is_ai_generated: string, ai_confidence: number, visual_analysis: string}>}
 */
export async function analyzeImage(imageUrlOrBase64) {
  const base64Url = await toBase64DataUrl(imageUrlOrBase64);

  const messages = [
    {
      role: "system",
      content:
        'You are an expert digital forensics and image misinformation analyst. Inspect the provided image carefully to:\n' +
        '1. Extract any checkable factual claims, news headlines, quotes, captions, or memes shown in the image.\n' +
        '2. Inspect for visual indicators of synthetic AI generation or deepfakes (e.g. malformed hands/teeth, unnatural skin texture, distorted background architecture or lettering, impossible lighting/shadows, synthetic diffusion artifacts).\n' +
        'Return a JSON object in this exact format:\n' +
        '{\n' +
        '  "claims": ["extracted claim 1", ...],\n' +
        '  "is_ai_generated": "LIKELY" | "UNLIKELY" | "UNCERTAIN",\n' +
        '  "ai_confidence": 0.0 to 1.0,\n' +
        '  "visual_analysis": "2-3 sentences summarizing image contents, extracted claims, and detected deepfake/synthetic artifacts or authentic camera markers."\n' +
        '}'
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Analyze this image for misinformation claims and deepfake/synthetic generation." },
        { type: "image_url", image_url: { url: base64Url } }
      ]
    }
  ];

  const rawJson = await callVisionLLM(messages, { json: true });
  return JSON.parse(rawJson);
}

/**
 * 6. Full multimodal verification pipeline:
 * Analyzes image for deepfake traces, extracts claims, and grounds truth via live search.
 * 
 * @param {string} imageUrlOrBase64 - Target image URL or base64.
 * @returns {Promise<Object>} Verification report with visual forensics and cited sources.
 */
export async function verifyImage(imageUrlOrBase64) {
  // Step 1: Run image forensics & claim extraction
  const imageAnalysis = await analyzeImage(imageUrlOrBase64);

  // Step 2: If claims were found in the image, verify the top claim with web evidence
  if (imageAnalysis.claims && imageAnalysis.claims.length > 0) {
    const claim = imageAnalysis.claims[0];
    const sources = await searchEvidence(claim);
    const factCheck = await judge(claim, sources);

    const citedSources = (factCheck.source_indexes || [])
      .map((index) => sources[index - 1])
      .filter(Boolean);

    return {
      image: true,
      claim,
      verdict: factCheck.verdict,
      confidence: factCheck.confidence,
      reasoning: `${factCheck.reasoning} [Visual Forensics: ${imageAnalysis.visual_analysis}]`,
      sources: citedSources,
      image_analysis: {
        is_ai_generated: imageAnalysis.is_ai_generated,
        ai_confidence: imageAnalysis.ai_confidence,
        visual_analysis: imageAnalysis.visual_analysis,
        extracted_claims: imageAnalysis.claims
      }
    };
  }

  // Step 3: If no explicit text claim, evaluate the authenticity of the visual content itself
  const isAi = imageAnalysis.is_ai_generated === "LIKELY";
  return {
    image: true,
    claim: "Visual Scene Authenticity & Deepfake Assessment",
    verdict: isAi ? "MISLEADING" : (imageAnalysis.is_ai_generated === "UNLIKELY" ? "TRUE" : "UNVERIFIABLE"),
    confidence: imageAnalysis.ai_confidence || 0.6,
    reasoning: imageAnalysis.visual_analysis,
    sources: [],
    image_analysis: {
      is_ai_generated: imageAnalysis.is_ai_generated,
      ai_confidence: imageAnalysis.ai_confidence,
      visual_analysis: imageAnalysis.visual_analysis,
      extracted_claims: []
    }
  };
}

// Runnable test block for Phase 1 verification
const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  try {
    const output = await verify("Drinking hot water kills the coronavirus.");
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error("Verification failed:", error);
    process.exitCode = 1;
  }
}
