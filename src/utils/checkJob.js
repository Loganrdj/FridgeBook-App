import axios from 'axios';

export const POLL_MS = 2500;
const GIVE_UP_MS = 4 * 60 * 1000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The friendliest error message in a failed request
export function errorMessage(err, fallback) {
  const data = err && err.response && err.response.data;
  return (data && (data.error || (data.errors && data.errors.join(' ')))) || fallback;
}

/**
 * Starts a slow check (the server answers 202 { job }) and waits for its
 * result. isCancelled() lets a page stop waiting when it closes.
 */
export async function runCheck(start, isCancelled = () => false, pollMs = POLL_MS) {
  const response = await start();
  if (response.status !== 202 || !response.data || !response.data.job) return response.data;
  const began = Date.now();
  while (Date.now() - began < GIVE_UP_MS) {
    await wait(pollMs);
    if (isCancelled()) return null;
    const poll = await axios.get(`/api/gluten/jobs/${response.data.job}`);
    if (!poll.data || poll.data.state !== 'running') return poll.data;
  }
  throw new Error('That check is taking too long. Please try again.');
}
