import { decodeAudio, toMp3, toWav } from "./lib/audio.js?v=1";
import { makeGif } from "./lib/gif.js?v=1";

const $ = (id) => document.getElementById(id);

// ---------- ortak
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
  $("tab-audio").classList.toggle("hidden", t.dataset.tab !== "audio");
  $("tab-gif").classList.toggle("hidden", t.dataset.tab !== "gif");
}));

function segment(el, onChange) {
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    el.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    onChange(b.dataset);
  });
}

function dropZone(el, input, onFile) {
  input.addEventListener("change", () => { if (input.files[0]) onFile(input.files[0]); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.remove("over"); }));
  el.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) onFile(f); });
}

const baseName = (n) => n.replace(/\.[^.]+$/, "") || "video";
const fmtSize = (b) => b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`;
const fmtTime = (s) => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

function progress(prefix, on, frac, text) {
  $(`${prefix}-prog`).classList.toggle("hidden", !on);
  if (frac != null) $(`${prefix}-bar`).style.width = `${Math.round(frac * 100)}%`;
  if (text != null) $(`${prefix}-status`).textContent = text;
}

// =====================================================================
// SESİ ÇIKAR
// =====================================================================
const A = { file: null, fmt: "mp3", out: null, url: null };

dropZone($("a-drop"), $("a-file"), aOpen);

function aOpen(file) {
  A.file = file;
  A.out = null;
  $("a-drop").classList.add("hidden");
  $("a-card").classList.remove("hidden");
  $("a-result").classList.add("hidden");
  progress("a", false);
  $("a-name").textContent = file.name;
  $("a-info").textContent = fmtSize(file.size);
  // süreyi öğren
  const v = document.createElement("video");
  v.preload = "metadata";
  v.src = URL.createObjectURL(file);
  v.onloadedmetadata = () => { if (isFinite(v.duration)) $("a-info").textContent = `${fmtTime(v.duration)} · ${fmtSize(file.size)}`; URL.revokeObjectURL(v.src); };
  v.onerror = () => URL.revokeObjectURL(v.src);
}

$("a-x").addEventListener("click", () => {
  $("a-card").classList.add("hidden");
  $("a-drop").classList.remove("hidden");
  $("a-player").removeAttribute("src");
});

segment($("a-fmt"), (d) => {
  A.fmt = d.f;
  $("a-q-row").classList.toggle("hidden", A.fmt !== "mp3");
  $("a-note").textContent = A.fmt === "mp3" ? "MP3 her yerde çalar." : "WAV kayıpsızdır ama dosyası çok büyüktür.";
  $("a-result").classList.add("hidden");
});
$("a-q").addEventListener("change", () => $("a-result").classList.add("hidden"));

$("a-go").addEventListener("click", async () => {
  const go = $("a-go");
  go.disabled = true;
  $("a-result").classList.add("hidden");
  try {
    progress("a", true, 0.05, "Ses okunuyor…");
    const ab = await decodeAudio(A.file);
    let blob;
    if (A.fmt === "mp3") {
      progress("a", true, 0.15, "MP3 hazırlanıyor…");
      blob = await toMp3(ab, parseInt($("a-q").value, 10), (f) => progress("a", true, 0.15 + f * 0.85, `MP3 hazırlanıyor… %${Math.round(f * 100)}`));
    } else {
      progress("a", true, 0.5, "WAV hazırlanıyor…");
      await new Promise((r) => setTimeout(r, 30));
      blob = toWav(ab);
    }
    A.out = { blob, name: `${baseName(A.file.name)}.${A.fmt}` };
    if (A.url) URL.revokeObjectURL(A.url);
    A.url = URL.createObjectURL(blob);
    $("a-player").src = A.url;
    $("a-dl-label").textContent = `İndir (${fmtSize(blob.size)})`;
    progress("a", false);
    $("a-result").classList.remove("hidden");
  } catch (e) {
    console.error(e);
    progress("a", true, 0, e.message || String(e));
  } finally { go.disabled = false; }
});

$("a-dl").addEventListener("click", () => A.out && download(A.out.blob, A.out.name));

// =====================================================================
// GIF YAP
// =====================================================================
const G = { file: null, dur: 3, width: 480, fps: 15, out: null, url: null, vurl: null };
const video = $("g-video");

dropZone($("g-drop"), $("g-file"), gOpen);

function gOpen(file) {
  G.file = file;
  if (G.vurl) URL.revokeObjectURL(G.vurl);
  G.vurl = URL.createObjectURL(file);
  video.src = G.vurl;
  $("g-start").value = 0;
  $("g-drop").classList.add("hidden");
  $("g-card").classList.remove("hidden");
  $("g-result").classList.add("hidden");
  progress("g", false);
}
video.addEventListener("error", () => progress("g", true, 0, "Bu video bu tarayıcıda açılamadı. Başka bir video ya da tarayıcı dene."));
video.addEventListener("loadedmetadata", () => { $("g-start").max = Math.max(0, video.duration - 0.5).toFixed(1); });

$("g-x").addEventListener("click", () => {
  video.pause();
  video.removeAttribute("src");
  video.load();
  $("g-card").classList.add("hidden");
  $("g-drop").classList.remove("hidden");
});
$("g-here").addEventListener("click", () => { $("g-start").value = video.currentTime.toFixed(1); });
segment($("g-dur"), (d) => { G.dur = parseFloat(d.d); });
segment($("g-w"), (d) => { G.width = parseInt(d.w, 10); });
segment($("g-fps"), (d) => { G.fps = parseInt(d.f, 10); });

$("g-go").addEventListener("click", async () => {
  if (!video.videoWidth) return progress("g", true, 0, "Video henüz yüklenmedi, biraz bekle.");
  const go = $("g-go");
  go.disabled = true;
  $("g-result").classList.add("hidden");
  try {
    let start = Math.max(0, parseFloat($("g-start").value) || 0);
    if (start >= video.duration) start = Math.max(0, video.duration - G.dur);
    const dur = Math.min(G.dur, video.duration - start);
    progress("g", true, 0, "Kareler alınıyor…");
    const blob = await makeGif(video, { start, dur, width: G.width, fps: G.fps },
      (f) => progress("g", true, f, f < 0.8 ? `Kareler alınıyor… %${Math.round(f / 0.8 * 100)}` : "GIF hazırlanıyor…"));
    G.out = { blob, name: `${baseName(G.file.name)}.gif` };
    if (G.url) URL.revokeObjectURL(G.url);
    G.url = URL.createObjectURL(blob);
    $("g-img").src = G.url;
    $("g-dl-label").textContent = `İndir (${fmtSize(blob.size)})`;
    progress("g", false);
    $("g-result").classList.remove("hidden");
  } catch (e) {
    console.error(e);
    progress("g", true, 0, "GIF yapılamadı: " + (e.message || e));
  } finally { go.disabled = false; }
});

$("g-dl").addEventListener("click", () => G.out && download(G.out.blob, G.out.name));
