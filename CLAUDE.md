# Tasarım kuralları (dogukaska uygulamaları)

Bu hesaptaki bütün uygulamalar (ana menü dogukaska.github.io dahil) aynı görünümde olmalı:

- **Yalnızca antrasit ve kırık beyaz** (tam siyah #000 ve tam beyaz #fff değil; gözü yormasın). Renkli vurgu, renkli düğme, renkli simge yok. Gri tonları serbest. Antrasit `#2e3033`, kırık beyaz `#faf9f6`, zemin `#efede8`, koyu mod zemini `#1f2022`.
- **Sade ve minimal**, ama göze hoş gelen: bol boşluk, ince çizgiler, yumuşak köşeler.
- **Cam görünüm:** kartlar yarı saydam beyaz (koyu modda yarı saydam siyah), `backdrop-filter: blur`, ince açık kenar, yumuşak gölge. Arka plan hafif gri tonlu ışık geçişi.
- **Simgeler:** emoji yok. İnce çizgili SVG (stroke 1.5, `currentColor`).
- **Ana düğme:** dolu antrasit (koyu modda dolu kırık beyaz), hap şeklinde. Diğer düğmeler cam/çerçeveli.
- **Ana ekran simgesi:** antrasit kare zemin üzerinde kırık beyaz ince çizgili simge (apple-touch-icon 180 px, gerekirse manifest simgeleri).
- Açık ve koyu mod ikisi de desteklenir. Sağ üstte güneş/ay düğmesi (`theme.js`, bütün uygulamalarda aynı dosya). Seçim `localStorage` "tema" anahtarında, tüm uygulamalarda ortak; seçim yoksa cihaz ayarı. CSS: koyu değişkenler hem `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` hem `:root[data-theme="dark"]` içinde.
- Renk değişkenleri `dogukaska.github.io/style.css` içindekiyle aynı: `--bg --ink --mute --glass --glass-edge --shadow --solid --solid-ink`.
- Arayüz dili Türkçe. Kullanıcı İngilizce bilmiyor; metinler kısa ve sade.
- Her uygulamanın üstünde ana menüye dönen "Uygulamalar" bağlantısı (`href="/"`) olur.
- Yeni uygulama yapılınca `dogukaska.github.io/apps.js` listesine eklenir (simgesi `icons.js` içine).
- Her şey tarayıcıda çalışır, dosyalar hiçbir sunucuya yüklenmez. Kütüphaneler `vendor/` içinde tutulur.
- **Önbellek:** `index.html` içindeki `style.css`, `theme.js`, `app.js` bağlantılarında `?v=…` sürüm numarası var. Bu dosyalardan biri değişince sürüm numarasını artır; yoksa telefonlar eski dosyayı kullanır.
