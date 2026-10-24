import { encodeWav, isPhone } from './media';
import { runCheck, errorMessage } from './checkJob';
import axios from 'axios';

jest.mock('axios', () => ({ get: jest.fn() }));

function readBlob(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(blob);
  });
}

it('encodes a 16-bit mono WAV the server can measure', async () => {
  const blob = encodeWav(new Float32Array([0, 1, -1, 0.5]), 16000);
  expect(blob.type).toBe('audio/wav');
  const view = new DataView(await readBlob(blob));
  const text = (o) => String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(o + i)));
  expect([text(0), text(8), text(12), text(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
  expect(view.getUint16(22, true)).toBe(1); // mono
  expect(view.getUint32(24, true)).toBe(16000);
  expect(view.getUint32(28, true)).toBe(32000); // bytes per second
  expect(view.getUint32(40, true)).toBe(8);
  expect([view.getInt16(46, true), view.getInt16(48, true)]).toEqual([32767, -32768]);
});

it('treats a browser without media queries as a computer', () => {
  const original = window.matchMedia;
  delete window.matchMedia;
  expect(isPhone()).toBe(false);
  window.matchMedia = () => ({ matches: true });
  expect(isPhone()).toBe(true);
  window.matchMedia = original;
});

describe('slow checks', () => {
  beforeEach(() => jest.resetAllMocks());

  it('waits for a job to finish', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { state: 'running' } })
      .mockResolvedValueOnce({ data: { score: 1 } });
    const data = await runCheck(() => Promise.resolve({ status: 202, data: { job: 'abc' } }), () => false, 0);
    expect(data).toEqual({ score: 1 });
    expect(axios.get).toHaveBeenCalledWith('/api/gluten/jobs/abc');
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('returns straight away when there is no job', async () => {
    expect(await runCheck(() => Promise.resolve({ status: 200, data: { ok: true } }))).toEqual({ ok: true });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('stops when the page closes', async () => {
    expect(await runCheck(() => Promise.resolve({ status: 202, data: { job: 'abc' } }), () => true, 0)).toBeNull();
  });

  it('a failed job surfaces its error', async () => {
    axios.get.mockRejectedValue({ response: { status: 422, data: { error: 'Too blurry.' } } });
    const err = await runCheck(() => Promise.resolve({ status: 202, data: { job: 'abc' } }), () => false, 0).catch((e) => e);
    expect(errorMessage(err, 'fallback')).toBe('Too blurry.');
    expect(errorMessage({}, 'fallback')).toBe('fallback');
  });
});
