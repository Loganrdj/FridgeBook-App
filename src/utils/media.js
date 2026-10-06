// Helpers for the menu photo and waiter voice checks.

// Phones get the camera and microphone tools; computers get the restaurant check only
export function isPhone() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse) and (max-width: 900px)').matches;
}

const MAX_SIDE = 1600;

// Shrinks a phone photo to a JPEG small enough to upload quickly
export function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext && canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx || !canvas.toBlob) return resolve(file);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file isn’t a photo we can read.')); };
    img.src = url;
  });
}

// 16-bit mono PCM WAV from audio samples (-1..1)
export function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset, s) => { for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i)); };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

const SPEECH_RATE = 16000;

// Turns whatever the browser recorded (webm, mp4…) into a small 16 kHz mono WAV
export async function toWav(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Ctx || !Offline) throw new Error('This browser can’t process recordings.');
  const data = await blob.arrayBuffer();
  const ctx = new Ctx();
  let decoded;
  try {
    decoded = await new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject));
  } finally {
    if (ctx.close) ctx.close();
  }
  const offline = new Offline(1, Math.max(1, Math.ceil(decoded.duration * SPEECH_RATE)), SPEECH_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return encodeWav(rendered.getChannelData(0), SPEECH_RATE);
}
