const $ = id => document.getElementById(id);
const fileInput = $("file");
const transcript = $("transcript");
const status = text => { $("status").textContent = text; };
let worker, busy = false, request = 0;

function setBusy(value) {
  busy = value;
  fileInput.disabled = value;
  $("run").disabled = value || !fileInput.files.length;
  $("cancel").hidden = !value;
}

function clearWorker() {
  worker?.terminate();
  worker = null;
}

function finishError(text) {
  clearWorker();
  setBusy(false);
  status(text);
}

function createWorker() {
  const instance = new Worker(new URL("./transcribe-worker.js?v=1", import.meta.url), { type: "module" });
  instance.onmessage = ({ data }) => {
    if (instance !== worker || !busy || data.id !== request) return;
    if (data.type === "model") status("Türkçe ses modeli hazırlanıyor… İlk kullanım biraz sürebilir.");
    if (data.type === "transcribing") status("Ses yazıya çevriliyor…");
    if (data.type === "error") {
      finishError(data.message);
      return;
    }
    if (data.type !== "done") return;
    setBusy(false);
    if (!data.text) {
      status("Kayıtta anlaşılır konuşma bulunamadı.");
      return;
    }
    transcript.value = data.text;
    updateOutput();
    $("output").hidden = false;
    status("Metin hazır. Düzeltebilir, kopyalayabilir veya indirebilirsin.");
  };
  instance.onerror = () => {
    if (instance === worker) finishError("Ses modeli başlatılamadı. Tarayıcıyı güncelleyip yeniden dene.");
  };
  return instance;
}

function updateOutput() {
  $("copy").disabled = $("download").disabled = !transcript.value.trim();
}

async function decode(file) {
  if (!file.size || file.size > 100 * 1024 * 1024) throw new Error("100 MB’tan küçük, geçerli bir ses dosyası seç.");
  const context = new OfflineAudioContext(1, 1, 16000);
  let audio;
  try { audio = await context.decodeAudioData(await file.arrayBuffer()); }
  catch { throw new Error("Ses dosyası açılamadı. M4A, MP3 veya WAV biçimini dene."); }
  if (audio.duration > 30 * 60) throw new Error("30 dakikadan kısa bir ses kaydı seç.");
  let samples = audio.getChannelData(0);
  if (audio.numberOfChannels > 1) {
    samples = samples.slice();
    for (let channel = 1; channel < audio.numberOfChannels; channel++) {
      const other = audio.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) samples[i] += other[i];
    }
    for (let i = 0; i < samples.length; i++) samples[i] /= audio.numberOfChannels;
  }
  if (!samples.some(sample => Math.abs(sample) >= 0.0001)) throw new Error("Kayıtta ses bulunamadı.");
  return samples;
}

fileInput.addEventListener("change", () => {
  $("output").hidden = true;
  transcript.value = "";
  status("");
  setBusy(false);
});

$("run").addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file || busy) return;
  const id = ++request;
  setBusy(true);
  $("output").hidden = true;
  transcript.value = "";
  status("Ses dosyası okunuyor…");
  try {
    const samples = await decode(file);
    if (id !== request) return;
    worker ??= createWorker();
    worker.postMessage({ id, samples }, [samples.buffer]);
  } catch (error) {
    if (id !== request) return;
    setBusy(false);
    status(error.message || "Ses dosyası işlenemedi.");
  }
});

$("cancel").addEventListener("click", () => {
  request++;
  clearWorker();
  setBusy(false);
  status("İşlem iptal edildi.");
  $("run").focus();
});

transcript.addEventListener("input", updateOutput);
$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(transcript.value);
    status("Metin kopyalandı.");
  } catch {
    transcript.focus();
    transcript.select();
    status("Metin seçildi. Kopyalama komutunu kullan.");
  }
});

$("download").addEventListener("click", () => {
  const name = fileInput.files[0]?.name.replace(/\.[^.]+$/, "") || "ses-kaydi";
  const url = URL.createObjectURL(new Blob([transcript.value], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name + ".txt";
  document.body.append(link);
  link.click();
  setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 4000);
});
