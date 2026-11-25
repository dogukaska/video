// Videodan sesi çıkarır: tarayıcı sesi çözer, MP3 ya da WAV olarak kaydeder.

export async function decodeAudio(file) {
  const buf = await file.arrayBuffer();
  // 44.1 kHz'e çevirerek çöz (MP3 için standart)
  const ctx = new OfflineAudioContext(2, 1, 44100);
  try {
    return await ctx.decodeAudioData(buf);
  } catch (e) {
    throw new Error("Bu dosyanın sesi okunamadı. Videoda ses olmayabilir ya da biçimi desteklenmiyor olabilir.");
  }
}

function isMono(ab) {
  if (ab.numberOfChannels < 2) return true;
  const a = ab.getChannelData(0), b = ab.getChannelData(1);
  for (let i = 0; i < a.length; i += 997) if (Math.abs(a[i] - b[i]) > 1e-4) return false;
  return true;
}

export function toMp3(ab, kbps, onProgress) {
  return new Promise((res, rej) => {
    const w = new Worker(new URL("./mp3-worker.js", import.meta.url), { type: "module" });
    const mono = isMono(ab);
    const left = ab.getChannelData(0).slice();
    const right = mono ? null : ab.getChannelData(1).slice();
    w.onmessage = (e) => {
      if (e.data.type === "progress") onProgress?.(e.data.frac);
      else { w.terminate(); res(e.data.blob); }
    };
    w.onerror = (e) => { w.terminate(); rej(new Error("MP3 oluşturulamadı")); };
    w.postMessage({ left, right, sampleRate: ab.sampleRate, kbps }, right ? [left.buffer, right.buffer] : [left.buffer]);
  });
}

export function toWav(ab) {
  const ch = isMono(ab) ? 1 : Math.min(2, ab.numberOfChannels);
  const n = ab.length, rate = ab.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); out.setUint32(4, 36 + n * ch * 2, true); str(8, "WAVE");
  str(12, "fmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  str(36, "data"); out.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch).keys()].map((c) => ab.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, data[c][i]));
    out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return new Blob([out], { type: "audio/wav" });
}
