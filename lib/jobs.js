// Small in-memory jobs for slow checks (a restaurant or menu can take longer
// than the proxy in front of the API waits for one request). The browser starts
// a job, then asks for its result every few seconds. Jobs belong to the user who
// started them and are forgotten after a while; a server restart loses them, and
// the page just asks the user to try again.
const crypto = require("crypto");

const KEEP_MS = 15 * 60 * 1000;
const MAX_JOBS = 500;
const jobs = new Map();

function sweep() {
  const now = Date.now();
  for (const [id, job] of jobs) if (now - job.started > KEEP_MS) jobs.delete(id);
  while (jobs.size > MAX_JOBS) jobs.delete(jobs.keys().next().value);
}

/**
 * Runs work() in the background. work returns { status, body } (an HTTP status
 * and JSON body), or throws. Returns the job id.
 */
function start(userId, work) {
  sweep();
  const id = crypto.randomUUID();
  const job = { userId, started: Date.now(), state: "running", status: null, body: null };
  jobs.set(id, job);
  job.promise = Promise.resolve()
    .then(work)
    .then(({ status, body }) => Object.assign(job, { state: "done", status, body }))
    .catch((err) => {
      console.error("Job failed:", err.message);
      Object.assign(job, { state: "done", status: 503, body: { error: "That check didn't work right now. Please try again in a minute." } });
    });
  return id;
}

function get(userId, id) {
  const job = jobs.get(id);
  return job && job.userId === userId ? job : null;
}

// Lets tests wait for a job to finish
async function settle(id) {
  const job = jobs.get(id);
  if (job) await job.promise;
}

module.exports = { start, get, settle, clear: () => jobs.clear() };
