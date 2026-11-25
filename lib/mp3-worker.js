// MP3 kodlama ayrı işçide yapılır, sayfa donmaz.
import { Mp3Encoder } from "../vendor/lamejs.js";

self.onmessage = (e) => {
  const { left, right, sampleRate, kbps } = e.data;
  const ch = right ? 2 : 1;
  const enc = new Mp3Encoder(ch, sampleRate, kbps);
  const toI16 = (f) => {
    const o = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); o[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
    return o;
  };
  const L = toI16(left), R = right ? toI16(right) : null;
  const chunks = [];
  const block = 1152 * 64;
  for (let i = 0; i < L.length; i += block) {
    const l = L.subarray(i, i + block);
    const buf = R ? enc.encodeBuffer(l, R.subarray(i, i + block)) : enc.encodeBuffer(l);
    if (buf.length) chunks.push(new Uint8Array(buf));
    if ((i / block) % 8 === 0) postMessage({ type: "progress", frac: i / L.length });
  }
  const end = enc.flush();
  if (end.length) chunks.push(new Uint8Array(end));
  const blob = new Blob(chunks, { type: "audio/mpeg" });
  postMessage({ type: "done", blob });
};
