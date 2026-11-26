// Videonun bir parçasından GIF yapar.
import { GIFEncoder, quantize, applyPalette } from "../vendor/gifenc.js";

function seek(video, time) {
  if (!video.seeking && video.readyState >= 2 && video.currentTime === time) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onReady);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
      video.removeEventListener("emptied", onError);
      if (error) reject(error);
      else resolve();
    };
    const onReady = () => { if (!video.seeking && video.readyState >= 2) finish(); };
    const onError = () => finish(new Error("Video karesi okunamadı."));
    const timer = setTimeout(onError, 5000);
    video.addEventListener("seeked", onReady);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);
    video.addEventListener("emptied", onError);
    try {
      if (video.currentTime !== time) video.currentTime = time;
      onReady();
    } catch { onError(); }
  });
}

/** video: yüklenmiş <video>, start/dur saniye, width piksel, fps */
export async function makeGif(video, { start, dur, width, fps }, onProgress) {
  const scale = Math.min(1, width / video.videoWidth, 4096 / video.videoHeight);
  const w = Math.max(1, Math.round(video.videoWidth * scale));
  const h = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  const n = Math.max(1, Math.round(dur * fps));
  const delay = Math.round(1000 / fps);
  const timeAt = i => Math.max(0, Math.min(video.duration - 0.001, start + i / fps));
  const gif = GIFEncoder();
  const wasPaused = video.paused;
  const keep = video.currentTime;

  const sampleCanvas = document.createElement("canvas");
  const sampleScale = Math.min(1, 96 / Math.max(w, h));
  sampleCanvas.width = Math.max(1, Math.round(w * sampleScale));
  sampleCanvas.height = Math.max(1, Math.round(h * sampleScale));
  const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  const sampleCount = Math.min(n, 6);
  const sampleSize = sampleCanvas.width * sampleCanvas.height * 4;
  const samples = new Uint8ClampedArray(sampleCount * sampleSize);

  video.pause();
  try {
    // Ortak renk paleti için yalnızca küçük örnek kareleri bellekte tut.
    for (let i = 0; i < sampleCount; i++) {
      const frame = Math.round(i * (n - 1) / Math.max(1, sampleCount - 1));
      await seek(video, timeAt(frame));
      sampleCtx.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
      samples.set(sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data, i * sampleSize);
      onProgress?.(0.1 * (i + 1) / sampleCount);
    }
    const palette = quantize(samples, 256);
    for (let i = 0; i < n; i++) {
      await seek(video, timeAt(i));
      ctx.drawImage(video, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h).data;
      gif.writeFrame(applyPalette(pixels, palette), w, h, { palette: i === 0 ? palette : undefined, delay });
      onProgress?.(0.1 + 0.9 * (i + 1) / n);
      if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    gif.finish();
    return new Blob([gif.bytes()], { type: "image/gif" });
  } finally {
    canvas.width = canvas.height = sampleCanvas.width = sampleCanvas.height = 0;
    if (!video.error && video.readyState >= 1) {
      await seek(video, keep).catch(() => {});
      if (!wasPaused) video.play().catch(() => {});
    }
  }
}
