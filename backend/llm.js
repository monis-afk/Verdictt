/**
 * llm.js - Groq API Client
 * 
 * Provides an OpenAI-compatible interface to Groq's fast inference API
 * supporting both text reasoning (GPT-OSS-120B) and multimodal vision
 * (Qwen-3.8-27B) for deepfake inspection and image claim extraction.
 */

/**
 * Sends a text chat completion request to the Groq API.
 * 
 * @param {Array<{role: string, content: string}>} messages - The conversation messages.
 * @param {Object} [options] - Options for the request.
 * @param {boolean} [options.json=false] - If true, enforces JSON output mode.
 * @returns {Promise<string>} The assistant's text response.
 */
export async function callLLM(messages, { json = false } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing from environment variables.");
  }

  const body = {
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    messages,
    temperature: 0.1 // Low temperature for deterministic, factual outputs
  };

  if (json) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Sends a multimodal vision request to Groq using Qwen-3.8-27B.
 * 
 * @param {Array<{role: string, content: any}>} messages - Messages containing image_url payload.
 * @param {Object} [options] - Request options.
 * @param {boolean} [options.json=false] - If true, enforces JSON output mode.
 * @returns {Promise<string>} Model response text.
 */
export async function callVisionLLM(messages, { json = false } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing from environment variables.");
  }

  const body = {
    model: process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b",
    messages,
    temperature: 0.1
  };

  if (json) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq Vision API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
