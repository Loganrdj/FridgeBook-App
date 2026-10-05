// Paid web search through OpenAI's Responses API ($10 per 1,000 searches plus
// tokens). Used only as a fallback, and capped by lib/webBudget.js.
const OpenAI = require("openai");

let client;
function getClient() {
  if (!process.env.OPENAI_API_KEY) throw Object.assign(new Error("OpenAI is not configured"), { status: 503 });
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/**
 * Runs a web search and returns { text, citations: [{ url, title }] }.
 * Only these citation URLs should ever be shown as sources.
 */
async function webSearch(prompt) {
  const response = await getClient().responses.create({
    model: process.env.OPENAI_SEARCH_MODEL || "gpt-4o-mini",
    tools: [{ type: "web_search" }],
    input: prompt
  });
  const citations = [];
  for (const item of response.output || []) {
    for (const part of item.content || []) {
      for (const note of part.annotations || []) {
        if (note.type === "url_citation" && note.url && !citations.some((c) => c.url === note.url)) {
          citations.push({ url: note.url, title: note.title || "" });
        }
      }
    }
  }
  return { text: response.output_text || "", citations };
}

module.exports = { webSearch };
