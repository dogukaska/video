import { probe, run } from "../lib/ff.js?v=3";

const rate = 16000;
const maxSeconds = 30 * 60;
const output = "konusma.pcm";
const onStatus = message => postMessage({ type: "status", message });

self.onmessage = async ({ data: file }) => {
  try {
    const info = await probe(file, onStatus);
    if (!info.hasAudio) {
      throw new Error(info.hasVideo ? "Bu videoda ses parçası yok." : "Video açılamadı. Geçerli bir MP4 veya MOV dosyası dene.");
    }
    if (info.duration > maxSeconds) throw new Error("En fazla 30 dakikalık bir video seç.");

    onStatus("Videonun sesi çıkarılıyor…");
    const audio = await run(file, input => [
      "-i", input, "-map", "0:a:0", "-vn", "-sn", "-dn",
      "-t", String(maxSeconds + 1), "-ac", "1", "-ar", String(rate), "-c:a", "pcm_f32le", "-f", "f32le", output,
    ], output, "application/octet-stream");
    const samples = new Float32Array(await audio.arrayBuffer());
    if (samples.length > maxSeconds * rate) throw new Error("En fazla 30 dakikalık bir video seç.");
    postMessage({ type: "done", samples }, [samples.buffer]);
  } catch (error) {
    postMessage({ type: "error", message: error.message || "Videonun sesi çıkarılamadı." });
  }
};
