import { env, pipeline } from "../vendor/transformers/transformers.min.js";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = new URL("./", import.meta.url).href;
env.backends.onnx.wasm.wasmPaths = new URL("../vendor/transformers/", import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1;

let transcriber;
self.onmessage = async ({ data: { id, samples } }) => {
  if (!transcriber) {
    postMessage({ id, type: "model" });
    try {
      transcriber = await pipeline("automatic-speech-recognition", "model", { device: "wasm", dtype: "q8" });
    } catch (error) {
      console.error(error);
      postMessage({ id, type: "error", message: "Ses modeli yüklenemedi. Bağlantını kontrol edip yeniden dene." });
      return;
    }
  }
  postMessage({ id, type: "transcribing" });
  try {
    const result = await transcriber(samples, {
      language: "turkish",
      task: "transcribe",
      chunk_length_s: 25,
      stride_length_s: 4,
    });
    postMessage({ id, type: "done", text: result.text.trim() });
  } catch (error) {
    console.error(error);
    postMessage({ id, type: "error", message: "Ses yazıya çevrilemedi. Daha kısa bir kayıtla yeniden dene." });
  }
};
