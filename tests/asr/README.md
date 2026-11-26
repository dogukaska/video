# Türkçe ses tanıma testi

Bu test, uygulamanın **Sesi Yazıya Çevir** ekranından altı Türkçe kaydı açar ve depodaki modelle Chromium’da çalışır. Model ve WebAssembly dosyaları yerel sunucudan yüklenir. Uygulama tarafından dış ağ istekleri engellenir ve kayıtlar dışarı gönderilmez.

```sh
cd tests/asr
npm ci
npx playwright install chromium
npm test
npm run benchmark
```

Sistemde kurulu Chromium’u kullanmak için `ASR_CHROMIUM_PATH=/usr/bin/chromium npm run benchmark` çalıştır. Eşiği uygulamadan sonucu görmek için `npm run benchmark -- --report-only` kullan.

Her kaydın referansını, model metnini, kelime hata oranını (WER) ve karakter hata oranını (CER) gösterir. Karşılaştırma Unicode normalleştirmesi ve Türkçe küçük harfe çevirme uygular, kesme işaretlerini siler ve diğer noktalamayı boşluk sayar. Türkçe harfleri korur. CER boşlukları hariç tutar. Toplam oranlar ekleme, silme ve değiştirme sayılarının tüm referans kelime ve karakter sayısına bölünmesiyle hesaplanır. `baseline.json` ilk ölçümü ve izin verilen sapmayı saklar. Yeni bir model veya normalleştirme değişikliği ölçümü etkilediğinde, bu dosyanın güncellemesini yeni sonuçla birlikte gözden geçir.

GitHub Actions’ta kullanılan Playwright Chromium 151 sürümündeki başlangıç ölçümü %40,00 WER ve %12,12 CER. Otomatik test sırasıyla 3 ve 1,5 yüzde puanı artışa izin verir. Sistem Chromium 156 ile yapılan iki kontrol %38,95 WER ve %11,48 CER verdi.

## Kayıtların kaynağı

Kayıtlar Google FLEURS’un `tr_tr` test bölümünden. Altı klip için özgün WAV adları ve eşleşen resmi metinler `dataset.json` dosyasında. WAV dosyaları FFmpeg ile 16 kb/sn mono Ogg/Opus biçimine dönüştürüldü, içerik kesilmedi. Veri seti CC BY 4.0 lisanslıdır. [Google FLEURS](https://huggingface.co/datasets/google/fleurs) · [Sabit kaynak sürümü](https://huggingface.co/datasets/google/fleurs/tree/e8902c08388808c03401f633b045795dfca3bfa4/data/tr_tr) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

Veri seti atfı: Alexis Conneau ve diğerleri, *FLEURS: Few-shot Learning Evaluation of Universal Representations of Speech*, 2022. [Makale](https://arxiv.org/abs/2205.12446)

Bu küçük örneklem, yüksek sesle okunan Türkçe kısa metinlere odaklanır. Bu Türkçe test bölümünde kayıtların cinsiyet etiketi `MALE` olarak yer alır. Doğal sohbet, telefon mikrofonu veya gürültülü ortam doğruluğu için ayrı kayıtlarla ölçüm gerekir.
