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
 * schema is a JSON Schema the response must follow.
 */
async function generateJson({ apiKey, models, system, prompt, schema, temperature = 0.7 }) {
  if (!apiKey) throw Object.assign(new Error("Gemini API key is not configured"), { status: 503 });
  const ai = clientFor(apiKey);
  let lastError;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
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
