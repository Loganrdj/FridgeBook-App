// Fetches a public web page (a restaurant's menu) for the server, refusing
// anything that resolves to a private or local address so a pasted link can't
// reach internal services. The address check happens at connect time, so a
// hostname can't switch to a private address after being checked.
const http = require("http");
const https = require("https");
const dns = require("dns");
const net = require("net");

const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const lower = address.toLowerCase();
  if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
  return lower === "::" || lower === "::1" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith("ff");
}

function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family || 4 }];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      return callback(Object.assign(new Error("That address isn't allowed"), { code: "BLOCKED" }));
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

function parseUrl(value) {
  let url;
  try { url = new URL(String(value || "").trim()); } catch (e) { return null; }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  if (url.port && !["80", "443"].includes(url.port)) return null;
  if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ""))) return null;
  return url;
}

function getOnce(url) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.get(url, {
      lookup: safeLookup,
      timeout: TIMEOUT_MS,
      headers: { "User-Agent": "FridgeBook/1.0 (+https://fridge-book.com)", Accept: "text/html,application/pdf,image/*;q=0.8,*/*;q=0.5" }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve({ redirect: new URL(res.headers.location, url) });
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(Object.assign(new Error(`Page returned ${res.statusCode}`), { code: "HTTP" }));
      }
      const chunks = [];
      let size = 0;
      res.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          req.destroy(Object.assign(new Error("That page is too big"), { code: "TOO_BIG" }));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ body: Buffer.concat(chunks), type: String(res.headers["content-type"] || "").split(";")[0].trim().toLowerCase(), url }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(Object.assign(new Error("That page took too long"), { code: "TIMEOUT" })));
    req.on("error", reject);
  });
}

/**
 * Fetches a public URL. Returns { body: Buffer, type, url }.
 */
async function safeFetch(value) {
  let url = parseUrl(value);
  if (!url) throw Object.assign(new Error("That isn't a link we can open"), { code: "BAD_URL" });
  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const result = await getOnce(url);
    if (!result.redirect) return result;
    url = parseUrl(result.redirect.href);
    if (!url) throw Object.assign(new Error("That link redirects somewhere we can't open"), { code: "BAD_URL" });
  }
  throw Object.assign(new Error("Too many redirects"), { code: "REDIRECTS" });
}

// Readable text from an HTML page: no scripts, styles or tags
function htmlToText(html) {
  return String(html || "")
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

module.exports = { safeFetch, parseUrl, isPrivateAddress, htmlToText };
