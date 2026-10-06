// Thin wrapper around the Gemini API that returns parsed JSON. Tests replace
// generateJson, so nothing here runs (or spends quota) during `npm test`.
const { GoogleGenAI } = require("@google/genai");

const clients = new Map();
function clientFor(apiKey) {
  if (!clients.has(apiKey)) clients.set(apiKey, new GoogleGenAI({ apiKey }));
  return clients.get(apiKey);
}

// Overloaded, rate limited or a server error: worth trying the next model
function isRetryable(err) {
  return [429, 500, 503].includes(err && err.status);
}

/**
 * Asks each model in turn until one answers, and returns { data, model }.
 * schema is a JSON Schema the response must follow. media is an optional list
 * of { mimeType, data: Buffer } (a photo, a PDF or a voice clip) sent along
 * with the prompt; it's only held in memory for the request.
 */
async function generateJson({ apiKey, models, system, prompt, schema, temperature = 0.7, media = [] }) {
  if (!apiKey) throw Object.assign(new Error("Gemini API key is not configured"), { status: 503 });
  const ai = clientFor(apiKey);
  const contents = media.length
    ? [{
      role: "user",
      parts: [
        ...media.map((m) => ({ inlineData: { mimeType: m.mimeType, data: Buffer.from(m.data).toString("base64") } })),
        { text: prompt }
      ]
    }]
    : prompt;
  let lastError;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          temperature
        }
      });
      return { data: JSON.parse(response.text), model };
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) && !(err instanceof SyntaxError)) break;
    }
  }
  throw lastError;
}

module.exports = { generateJson };
