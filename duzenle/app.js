import { exportMP4, openVideo } from "./engine.js?v=1";

const $ = id => document.getElementById(id);
const picker = $("file");
const preview = $("preview");
const form = $("edit");
const start = $("start");
const end = $("end");
const mute = $("mute");
const download = $("download");
const progress = $("progress");
const format = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });
const limit = 100 * 1024 * 1024;
let session;
let controller;
let engine;
let previewURL;
let downloadURL;

const report = text => { $("status").textContent = text; };

function releaseEngine() {
  controller?.abort();
  controller = undefined;
  engine = undefined;
}

function clearDownload() {
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  downloadURL = undefined;
  download.removeAttribute("href");
  download.hidden = true;
  $("actions").hidden = $("cancel").hidden;
}

function clearPreview() {
  if (previewURL) URL.revokeObjectURL(previewURL);
  previewURL = undefined;
  preview.removeAttribute("src");
  preview.hidden = true;
  $("preview-area").hidden = true;
  $("preview-note").hidden = true;
}

function setBusy(busy, processing = false) {
  $("fields").disabled = busy;
  $("cancel").hidden = !busy;
  progress.hidden = !processing;
  $("actions").hidden = !busy && download.hidden;
}

function showPreview(file) {
  previewURL = URL.createObjectURL(file);
  $("preview-area").hidden = false;
  preview.src = previewURL;
  preview.hidden = false;
}

preview.addEventListener("error", () => {
  if (!previewURL || preview.src !== previewURL || !preview.error) return;
  preview.hidden = true;
  $("preview-note").hidden = false;
});
preview.addEventListener("loadedmetadata", () => {
  if (preview.src !== previewURL) return;
  preview.hidden = false;
  $("preview-note").hidden = true;
});

function seconds(value) {
  const text = value.trim();
  if (!/^\d+(?:[.,]\d{1,6})?$/.test(text)) throw new Error("Süreleri saniye olarak gir. Örnek 2,5.");
  return Number(text.replace(",", "."));
}

function readOptions(duration) {
  const from = seconds(start.value);
  const requested = end.value.trim() ? seconds(end.value) : duration;
  if (requested > duration && requested - duration > 0.0005) throw new Error("Bitiş, video süresini geçemez.");
  const to = Math.min(requested, duration);
  if (from >= to) throw new Error("Bitiş, başlangıçtan sonra olmalı.");
  return { start: from, end: to, mute: mute.checked };
}

async function readVideo(current, job) {
  const source = await openVideo(current.file, job.signal, detail => {
    if (controller === job) report(detail);
  });
  if (controller === job) engine = source;
  return source;
}

function finishError(error, job) {
  if (controller !== job) return;
  releaseEngine();
  setBusy(false);
  report(error.message || "Video işlenemedi.");
}

picker.addEventListener("change", async () => {
  releaseEngine();
  clearDownload();
  clearPreview();
  session = undefined;
  form.hidden = true;
  setBusy(false);
  report("");
  const file = picker.files[0];
  if (!file) return;
  if (!file.size || file.size > limit) {
    picker.value = "";
    report("100 MiB’a kadar geçerli bir video dosyası seç.");
    return;
  }
  const current = { file };
  session = current;
  const job = new AbortController();
  controller = job;
  setBusy(true);
  showPreview(file);
  try {
    const source = await readVideo(current, job);
    if (controller !== job) return;
    current.duration = source.duration;
    form.reset();
    mute.disabled = !source.hasAudio;
    $("duration").textContent = "Toplam süre " + format.format(source.duration) + " sn";
    form.hidden = false;
    setBusy(false);
    report("");
  } catch (error) {
    if (controller === job) {
      session = undefined;
      picker.value = "";
      clearPreview();
    }
    finishError(error, job);
  }
});

form.addEventListener("input", () => {
  clearDownload();
  report("");
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const current = session;
  if (!current?.duration || $("fields").disabled) return;
  clearDownload();
  let options;
  try {
    options = readOptions(current.duration);
  } catch (error) {
    report(error.message);
    return;
  }
  const job = controller ?? new AbortController();
  controller = job;
  progress.removeAttribute("value");
  setBusy(true, true);
  try {
    const source = engine ?? await readVideo(current, job);
    if (controller !== job) return;
    report("MP4 hazırlanıyor…");
    const result = await exportMP4(source, options, percent => {
      if (controller === job) progress.value = percent;
    });
    if (controller !== job) return;
    releaseEngine();
    downloadURL = URL.createObjectURL(result);
    download.href = downloadURL;
    download.download = (current.file.name.replace(/\.[^.]+$/, "") || "video") + "-duzenlendi.mp4";
    download.hidden = false;
    setBusy(false);
    report("MP4 hazır.");
  } catch (error) {
    finishError(error, job);
  }
});

$("cancel").addEventListener("click", () => {
  releaseEngine();
  if (!session?.duration) {
    session = undefined;
    picker.value = "";
    clearPreview();
  }
  setBusy(false);
  report("İşlem iptal edildi.");
  (form.hidden ? picker : $("render")).focus();
});

window.addEventListener("pagehide", () => {
  releaseEngine();
  setBusy(false);
});
