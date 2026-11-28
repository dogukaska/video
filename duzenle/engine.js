import { createFF, mountVideo } from "../lib/ff.js?v=4";

const infoPath = "/edit-info.json";
const outputPath = "/edited.mp4";

export async function openVideo(file, signal, onStatus) {
  const ff = await createFF(onStatus, undefined, signal);
  signal.throwIfAborted();
  onStatus("Video bilgileri okunuyor…");
  const { path } = await mountVideo(ff, file);
  const info = await readInfo(ff, path);
  const video = videoTrack(info);
  if (!video) throw new Error("Dosyada düzenlenebilir bir video bulunamadı.");
  const duration = positive(info.format?.duration) || positive(video.duration);
  if (!duration) throw new Error("Videonun süresi belirlenemedi.");
  return {
    duration, ff, path,
    hasAudio: info.streams.some(stream => stream.codec_type === "audio"),
  };
}

function videoTrack(info) {
  return info.streams?.find(stream => stream.codec_type === "video" && !stream.disposition?.attached_pic);
}

async function readInfo(ff, path) {
  try {
    await ff.ffprobe(["-v", "error", "-show_streams", "-show_format", "-of", "json", "-o", infoPath, path]);
    // Bu WebAssembly derlemesi rapor üretse de -1 dönebilir.
    return JSON.parse(await ff.readFile(infoPath, "utf8"));
  } catch {
    throw new Error("Video bilgileri okunamadı. Geçerli bir video dosyası seç.");
  } finally {
    await ff.deleteFile(infoPath).catch(() => {});
  }
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export async function exportMP4(source, { start, end, mute }, onProgress) {
  const { ff, path } = source;
  const length = end - start;
  const progress = ({ time }) => {
    if (Number.isFinite(time)) onProgress(Math.min(99, Math.max(0, Math.floor(time / 10000 / length))));
  };
  ff.on("progress", progress);
  try {
    const result = await ff.exec([
      "-hide_banner", "-ss", start.toFixed(6), "-i", path, "-t", length.toFixed(6),
      "-map", "0:V:0",
      ...(mute ? ["-an"] : ["-map", "0:a:0?", "-c:a", "aac", "-b:a", "160k"]),
      "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-crf", "22", "-threads", "1",
      "-movflags", "+faststart", outputPath,
    ]);
    if (result !== 0) throw new Error("Video işlenemedi. Geçerli bir video veya daha kısa bir bölüm dene.");
    const outputVideo = videoTrack(await readInfo(ff, outputPath));
    if (!outputVideo || outputVideo.nb_frames === "0") throw new Error("Seçilen aralıkta video karesi bulunamadı.");
    const bytes = await ff.readFile(outputPath);
    return new Blob([bytes], { type: "video/mp4" });
  } finally {
    ff.off("progress", progress);
    await ff.deleteFile(outputPath).catch(() => {});
  }
}
