import {decodeAudio,toMp3,toWav} from "../lib/audio.js?v=3";
const $ = (id) => document.getElementById(id);
const audio = $("audio");
let buffer, name, playbackUrl, limit, token = 0;
function range() {
  const from = Number($("start").value), to = Number($("end").value);
  if (!$("start").value || !$("end").value || from < 0 || to <= from || !buffer || from >= buffer.duration || to > buffer.duration + .001) {
    throw Error("Başlangıç ve bitişi dosyanın süresi içinde seç.");
  }
  return [from,Math.min(to,buffer.duration)];
}
function setBusy(busy) {
  for (const id of ["file","start","end","listen","wav","mp3"]) $(id).disabled = busy;
}
$("file").addEventListener("change",async () => {
  const file = $("file").files[0];
  const id = ++token;
  audio.pause();
  if (playbackUrl) URL.revokeObjectURL(playbackUrl);
  audio.removeAttribute("src");
  audio.load();
  limit = null; buffer = null; $("editor").hidden = true;
  if (!file) return;
  $("status").textContent = "Ses dosyası açılıyor…";
  try {
    if (!file.size || file.size > 100 * 1024 * 1024) throw Error("100 MB’tan küçük bir ses dosyası seç.");
    const decoded = await decodeAudio(file);
    if (id !== token) return;
    buffer = decoded;
    name = file.name.replace(/\.[^.]+$/,"") || "ses";
    playbackUrl = URL.createObjectURL(file);
    audio.src = playbackUrl;
    $("start").value = 0;
    $("end").value = Number(decoded.duration.toFixed(3));
    $("end").step = $("start").step = "0.001";
    $("start").max = $("end").max = $("end").value;
    $("editor").hidden = false;
    $("status").textContent = "Süre: "+decoded.duration.toLocaleString("tr",{maximumFractionDigits:2})+" sn";
  } catch(e) { if (id === token) $("status").textContent = e.message || "Ses açılamadı."; }
});
audio.addEventListener("timeupdate",() => {
  if (limit !== null && audio.currentTime >= limit) { audio.pause(); limit=null; }
});
audio.addEventListener("pause",() => { limit = null; });
$("listen").addEventListener("click",async () => {
  try {
    const [from,to] = range();
    audio.currentTime = from;
    limit = to;
    await audio.play();
  } catch(e) { $("status").textContent = e.message || "Ses önizlenemedi."; }
});
for (const extension of ["wav","mp3"]) $(extension).addEventListener("click",async () => {
  try {
    const [from,to] = range();
    setBusy(true);
    $("status").textContent = "Ses hazırlanıyor…";
    const start = Math.floor(from*buffer.sampleRate);
    const end = Math.max(start+1,Math.round(to*buffer.sampleRate));
    const count = Math.min(2,buffer.numberOfChannels);
    const channels = Array.from({length:count},(_,i) => buffer.getChannelData(i).subarray(start,end));
    const clip = {sampleRate:buffer.sampleRate,length:channels[0].length,numberOfChannels:count,getChannelData:i=>channels[i]};
    await new Promise(resolve=>setTimeout(resolve,0));
    const blob = extension === "wav" ? toWav(clip) : await toMp3(clip,192,frac => {
      $("status").textContent = "MP3 hazırlanıyor… %"+Math.round(frac*100);
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = name+"-kesit."+extension; link.href = url; link.click();
    setTimeout(() => URL.revokeObjectURL(url),4000);
    $("status").textContent = "Kesit hazır.";
  } catch(e) { $("status").textContent = e.message || "Kesit çıkarılamadı."; }
  finally { setBusy(false); }
});
