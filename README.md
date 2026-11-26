# Video Araçları

Videonun sesini MP3/WAV olarak çıkarır, bir parçasını GIF yapar. Her şey tarayıcıda; dosya hiçbir yere yüklenmez.

[Sesi Yazıya Çevir](https://dogukaska.github.io/video/ses-yaziya/) ses dosyaları ile MP4, MOV, WebM ve diğer video dosyalarındaki Türkçe konuşmayı metne çevirir. Dosya sınırı 100 MB ve 30 dakikadır.

Türkçe ses tanıma doğruluğunu ölçmek için [tarayıcı testini](tests/asr/) çalıştırabilirsin.

Adres: https://dogukaska.github.io/video/

Tarayıcının açamadığı videolar (ör. iPhone HEVC .mov) için yedek çözücü: [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) (çekirdek GPL-2.0+).

Kütüphaneler: [lamejs](https://github.com/zhuker/lamejs) (LGPL-3.0, MP3), [gifenc](https://github.com/mattdesl/gifenc) (MIT, GIF).

Video dosyalarındaki konuşmayı yazıya çevirme desteği ve Türkçe konuşma tanıma testleri OpenAI Codex desteğiyle geliştirildi.
