// Videonun bir parçasından GIF yapar.
import { GIFEncoder, quantize, applyPalette } from "../vendor/gifenc.js";

function seek(video, t) {
  return new Promise((res) => {
    const done = () => { video.removeEventListener("seeked", done); res(); };
    video.addEventListener("seeked", done);
    video.currentTime = t;
  });
}

/** video: yüklenmiş <video>, start/dur saniye, width piksel, fps */
export async function makeGif(video, { start, dur, width, fps }, onProgress) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const w = Math.min(width, vw);
  const h = Math.round((vh / vw) * w / 2) * 2;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const cx = c.getContext("2d", { willReadFrequently: true });
  cx.imageSmoothingQuality = "high";
  const n = Math.max(1, Math.round(dur * fps));
  const delay = Math.round(1000 / fps);
  const gif = GIFEncoder();
  const wasPaused = video.paused;
  video.pause();
  const keep = video.currentTime;

  // ilk karelerden ortak renk paleti (titreşmesin diye)
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = Math.min(video.duration - 0.001, start + i / fps);
    await seek(video, t);
    cx.drawImage(video, 0, 0, w, h);
    frames.push(cx.getImageData(0, 0, w, h).data);
    onProgress?.(0.8 * (i + 1) / n);
  }
  // palet: karelerden örnek al
  const step = Math.max(1, Math.floor(frames.length / 6));
  const sample = [];
  for (let i = 0; i < frames.length; i += step) sample.push(frames[i]);
  const merged = new Uint8ClampedArray(sample.reduce((s, f) => s + f.length, 0));
  let o = 0;
  for (const f of sample) { merged.set(f, o); o += f.length; }
  const palette = quantize(merged, 256);

  for (let i = 0; i < frames.length; i++) {
    const idx = applyPalette(frames[i], palette);
    gif.writeFrame(idx, w, h, { palette: i === 0 ? palette : undefined, delay });
    frames[i] = null;
    onProgress?.(0.8 + 0.2 * (i + 1) / n);
    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  gif.finish();
  await seek(video, keep);
  if (!wasPaused) video.play();
  return new Blob([gif.bytes()], { type: "image/gif" });
}
