import { decodeAudio, toMp3, toWav } from "./lib/audio.js?v=2";
import { makeGif } from "./lib/gif.js?v=3";
import { run as ffRun, probe as ffProbe } from "./lib/ff.js?v=3";

const $ = (id) => document.getElementById(id);

// ---------- ortak
const tabs = [...document.querySelectorAll(".tab")];
tabs.forEach((t) => t.addEventListener("click", () => {
  for (const button of tabs) {
    const selected = button === t;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", selected);
    button.tabIndex = selected ? 0 : -1;
  }
  $("tab-audio").classList.toggle("hidden", t.dataset.tab !== "audio");
  $("tab-gif").classList.toggle("hidden", t.dataset.tab !== "gif");
}));
tabs[0].parentElement.addEventListener("keydown", (event) => {
  const index = tabs.indexOf(event.target);
  if (index < 0) return;
  let next;
  if (event.key === "Home") next = tabs[0];
  else if (event.key === "End") next = tabs.at(-1);
  else if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
  else if (event.key === "ArrowLeft") next = tabs[(index + tabs.length - 1) % tabs.length];
  else return;
  event.preventDefault();
  next.focus();
  next.click();
});


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
const A = { file: null, fmt: "mp3", out: null, url: null, busy: false };

dropZone($("a-drop"), $("a-file"), aOpen);

function aOpen(file) {
  if (A.busy) return;
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
  v.onloadedmetadata = () => { if (A.file === file && isFinite(v.duration)) $("a-info").textContent = `${fmtTime(v.duration)} · ${fmtSize(file.size)}`; URL.revokeObjectURL(v.src); };
  v.onerror = () => URL.revokeObjectURL(v.src);
}

$("a-x").addEventListener("click", () => {
  A.file = A.out = null;
  if (A.url) URL.revokeObjectURL(A.url);
  A.url = null;
  $("a-card").classList.add("hidden");
  $("a-drop").classList.remove("hidden");
  $("a-player").removeAttribute("src");
  $("a-player").load();
});

segment($("a-fmt"), (d) => {
  A.fmt = d.f;
  $("a-q-row").classList.toggle("hidden", A.fmt !== "mp3");
  $("a-note").textContent = A.fmt === "mp3" ? "MP3 her yerde çalar." : "WAV kayıpsızdır ama dosyası çok büyüktür.";
  $("a-result").classList.add("hidden");
});
$("a-q").addEventListener("change", () => $("a-result").classList.add("hidden"));

$("a-go").addEventListener("click", async () => {
  if (!A.file || A.busy) return;
  const controls = [$("a-go"), $("a-x"), $("a-file"), $("a-q"), ...$("a-fmt").querySelectorAll("button")];
  A.busy = true;
  controls.forEach(control => { control.disabled = true; });
  $("a-result").classList.add("hidden");
  try {
    progress("a", true, 0.05, "Ses okunuyor…");
    let ab = null, blob;
    try { ab = await decodeAudio(A.file); } catch (e) { ab = null; }
    if (!ab) {
      // tarayıcı açamadı (ör. iPhone .mov): FFmpeg ile dene
      const info = await ffProbe(A.file, (t) => progress("a", true, 0.05, t));
      if (!info.hasAudio) throw new Error("Bu videoda ses yok.");
      const kbps = $("a-q").value;
      const out = A.fmt === "mp3" ? "out.mp3" : "out.wav";
      blob = await ffRun(A.file,
        (inp) => ["-i", inp, "-vn", "-map", "0:a:0", "-ar", "44100",
          ...(A.fmt === "mp3" ? ["-c:a", "libmp3lame", "-b:a", kbps + "k"] : ["-c:a", "pcm_s16le"]), out],
        out, A.fmt === "mp3" ? "audio/mpeg" : "audio/wav",
        { total: info.duration, onProgress: (f) => progress("a", true, 0.1 + f * 0.9, `Ses çıkarılıyor… %${Math.round(f * 100)}`), onStatus: (t) => progress("a", true, 0.05, t) });
    } else if (A.fmt === "mp3") {
      progress("a", true, 0.15, "MP3 hazırlanıyor…");
      blob = await toMp3(ab, parseInt($("a-q").value, 10), (f) => progress("a", true, 0.15 + f * 0.85, `MP3 hazırlanıyor… %${Math.round(f * 100)}`));
    } else if (!blob) {
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
  } finally {
    A.busy = false;
    controls.forEach(control => { control.disabled = false; });
  }
});

$("a-dl").addEventListener("click", () => A.out && download(A.out.blob, A.out.name));

// =====================================================================
// GIF YAP
// =====================================================================
const G = { file: null, dur: 3, width: 480, fps: 15, out: null, url: null, vurl: null, ff: false, duration: 0, frameTimer: null, frameUrl: null };
const video = $("g-video");

dropZone($("g-drop"), $("g-file"), gOpen);

function setDuration(d) {
  G.duration = d;
  $("g-range").max = Math.max(0, d - 0.5).toFixed(1);
  $("g-start").max = Math.max(0, d - 0.5).toFixed(1);
}

let fallbackTimer = null;
function gOpen(file) {
  if (G.busy) return;
  clearTimeout(G.frameTimer);
  G.file = file;
  G.ff = false;
  G.duration = 0;
  $("g-video").classList.remove("hidden");
  $("g-frame-box").classList.add("hidden");
  $("g-here").classList.remove("hidden");
  $("g-range").value = 0;
  clearTimeout(fallbackTimer);
  // birkaç saniyede görüntü gelmezse yedek çözücüye geç
  fallbackTimer = setTimeout(() => { if (!video.videoWidth) gFallback(); }, 4000);
  if (G.vurl) URL.revokeObjectURL(G.vurl);
  G.vurl = URL.createObjectURL(file);
  video.src = G.vurl;
  $("g-start").value = 0;
  $("g-drop").classList.add("hidden");
  $("g-card").classList.remove("hidden");
  $("g-result").classList.add("hidden");
  progress("g", false);
}
video.addEventListener("error", () => { if (G.file && !G.ff) gFallback(); });
video.addEventListener("loadedmetadata", () => {
  if (!video.videoWidth) return gFallback();
  clearTimeout(fallbackTimer);
  setDuration(video.duration);
});

async function gFallback() {
  if (G.ff || !G.file) return;
  const file = G.file;
  G.ff = true;
  clearTimeout(fallbackTimer);
  video.pause();
  video.removeAttribute("src");
  video.load();
  $("g-video").classList.add("hidden");
  $("g-here").classList.add("hidden");
  $("g-frame-box").classList.remove("hidden");
  $("g-frame-note").textContent = "Bu video tarayıcıda oynatılamıyor, kendi çözücümüzle açılıyor…";
  try {
    const info = await ffProbe(file, (t) => { if (G.file === file) $("g-frame-note").textContent = t; });
    if (G.file !== file) return;
    if (!info.hasVideo) throw new Error("Bu dosyada görüntü yok.");
    setDuration(info.duration);
    showFrame(0);
  } catch (e) {
    if (G.file === file) $("g-frame-note").textContent = e.message || String(e);
  }
}

// yedek modda seçilen anın karesini göster
function showFrame(t) {
  clearTimeout(G.frameTimer);
  const file = G.file;
  G.frameTimer = setTimeout(async () => {
    $("g-frame-note").textContent = "Kare hazırlanıyor…";
    try {
      const blob = await ffRun(file, (inp) => ["-ss", String(t), "-i", inp, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", "kare.jpg"], "kare.jpg", "image/jpeg");
      if (G.file !== file) return;
      if (G.frameUrl) URL.revokeObjectURL(G.frameUrl);
      G.frameUrl = URL.createObjectURL(blob);
      $("g-frame").src = G.frameUrl;
      $("g-frame-note").textContent = "";
    } catch (e) { if (G.file === file) $("g-frame-note").textContent = "Kare gösterilemedi"; }
  }, 350);
}

function setStart(t, from) {
  t = Math.max(0, Math.min(G.duration || 0, t));
  if (from !== "num") $("g-start").value = t.toFixed(1);
  if (from !== "range") $("g-range").value = t;
  if (G.ff) showFrame(t);
  else if (from !== "video" && video.readyState >= 1) video.currentTime = t;
}
$("g-range").addEventListener("input", () => setStart(parseFloat($("g-range").value), "range"));
$("g-start").addEventListener("change", () => setStart(parseFloat($("g-start").value) || 0, "num"));
video.addEventListener("seeked", () => { if (!G.busy) setStart(video.currentTime, "video"); });

$("g-x").addEventListener("click", () => {
  clearTimeout(fallbackTimer);
  clearTimeout(G.frameTimer);
  G.file = null;
  G.out = null;
  for (const key of ["vurl", "frameUrl", "url"]) {
    if (G[key]) URL.revokeObjectURL(G[key]);
    G[key] = null;
  }
  $("g-frame").removeAttribute("src");
  $("g-img").removeAttribute("src");
  video.pause();
  video.removeAttribute("src");
  video.load();
  $("g-card").classList.add("hidden");
  $("g-drop").classList.remove("hidden");
});
$("g-here").addEventListener("click", () => setStart(video.currentTime, "video"));
segment($("g-dur"), (d) => { G.dur = parseFloat(d.d); });
segment($("g-w"), (d) => { G.width = parseInt(d.w, 10); });
segment($("g-fps"), (d) => { G.fps = parseInt(d.f, 10); });

$("g-go").addEventListener("click", async () => {
  if (!G.file || G.busy) return;
  if (!G.ff && !video.videoWidth) return progress("g", true, 0, "Video henüz yüklenmedi, biraz bekle.");
  if (G.ff && !G.duration) return progress("g", true, 0, "Video henüz hazır değil, biraz bekle.");
  const controls = ["g-go", "g-x", "g-file", "g-range", "g-start", "g-here"].map($);
  controls.push(...document.querySelectorAll("#g-dur button, #g-w button, #g-fps button"));
  G.busy = true;
  controls.forEach(control => { control.disabled = true; });
  const hadVideoControls = video.controls;
  video.controls = false;
  $("g-result").classList.add("hidden");
  try {
    const D = G.ff ? G.duration : video.duration;
    let start = Math.max(0, parseFloat($("g-start").value) || 0);
    if (start >= D) start = Math.max(0, D - G.dur);
    const dur = Math.min(G.dur, D - start);
    let blob;
    if (G.ff) {
      progress("g", true, 0, "GIF hazırlanıyor…");
      const vf = `fps=${G.fps},scale=${G.width}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`;
      blob = await ffRun(G.file, (inp) => ["-ss", String(start), "-t", String(dur), "-i", inp, "-vf", vf, "-loop", "0", "out.gif"], "out.gif", "image/gif",
        { total: dur, onProgress: (f) => progress("g", true, f, `GIF hazırlanıyor… %${Math.round(f * 100)}`) });
    } else {
      progress("g", true, 0, "Kareler alınıyor…");
      blob = await makeGif(video, { start, dur, width: G.width, fps: G.fps },
        (f) => progress("g", true, f, `GIF hazırlanıyor… %${Math.round(f * 100)}`));
    }
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
  } finally {
    video.controls = hadVideoControls;
    G.busy = false;
    controls.forEach(control => { control.disabled = false; });
  }
});

$("g-dl").addEventListener("click", () => G.out && download(G.out.blob, G.out.name));
