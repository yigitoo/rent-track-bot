# Vedat Gayrimenkul

Vedat Gayrimenkul paneli, mevcut Telegram kira takip botunu Next.js tabanlı, responsive bir web paneli ve kurulabilir PWA ile aynı veri akışında buluşturur.

## Panelde neler var?

**Özet** · Dönemin tahsilat oranı, açık bakiye ve net gelir; sözleşme bitişi ve
kira yıldönümü gündemi; son ödemeler şeridi.

**Takvim** · Ay ve ajanda görünümü. Gün kutusuna gelince beliren `+` ile o güne
ödeme, gider ya da **her ay tekrar eden** bir kalem eklenir; bir kiracının
tahsilat günü doğrudan takvimden değiştirilebilir. Kira, gider ve henüz
gerçekleşmemiş düzenli kalemler aynı gün kutusunda toplanır.

**Ödemeler** · İki görünüm. *Yıl tablosu*: her kiracı için Ocak'tan Aralık'a
12 kutucuk. Bir aya dokunmak o dönemin kirasını ödendi olarak işaretler ve
tutarı kendisi yazar (kira 15.000 TL ise 15.000 TL düşer); eksik kalmış bir
döneme dokunmak kalanı tamamlar, tam ödenmiş bir döneme dokunmak işareti
kaldırır. Kutucuklar telefonda ve tablette parmakla vurulacak boyda kalır
(12 → 6 → 4 → 3 sütun). İşaret anında takvime, özete ve raporlara yansır.
*Dönem defteri*: eski aylık liste, durum filtreleri, tek tuşla tahsilat ve
erteleme. İkisi de CSV olarak dışa aktarılır.

**Aidat** · Apartman ve site aidatının 12 aylık takibi. Her aidat kalemi için
Ocak'tan Aralık'a bir kutucuk; işaretlediğiniz ay o dönemin gider kaydına
dönüşür ve **ödendi** olur. İşareti kaldırınca kayıt silinmez, yalnız ödenmedi
duruma döner — borç kaybolmaz. Kalemler kiracıya bağlanabilir, duraklatılabilir,
tutarı sonradan düzenlenebilir. Aidat girdiğiniz an giderler, takvim, net gelir
ve raporlar birlikte güncellenir.

**Giderler** · Tamir, vergi, sigorta, komisyon, fatura kırılımı; net gelir
hesabı; her ayın belirli gününde otomatik oluşan **düzenli giderler**
(duraklatılabilir). Düzenli bir kalem günü geldiğinde yükümlülük olarak düşer;
ödendiği işaretlenene kadar listede "ödenmedi" görünür.

**Kiracılar** · Sözleşme tarihleri, depozito, yıllık artış oranı, telefon,
e-posta ve not. Kiracı dosyasında ödeme geçmişi (silinebilir), kira geçmişi ve
oran ya da tutar üzerinden **kira artışı** uygulama. Arama ve arşiv.

**Raporlar** · Üç mod. *Dönem*: 6/12/24 aylık tahsilat–gider–net serisi,
kiracı bazında performans, gider kategorileri, sözleşme ve zam gündemi.
*Yıllık*: kiracı × ay tablosu — her kiracının portföye **dahil olduğu ay**
işaretlenir (◆), öncesi "kiracı değil" olarak boş kalır; ay ay ödendi / eksik /
ödenmedi durumu görünür. İkisi de CSV ve **logolu, markalı PDF** olarak
indirilir (Inter gömülü, vektör logo, A4). *Aylık*: tek bir ayın defteri —
kiracı durumu, tahsilat hareketleri ve giderler; Telegram botundan da
istenebilir. Aylık raporda **aidat takibi** tablosu, yıllık raporda **aidat ×
ay** matrisi yer alır.

**Ayarlar** · Bildirimlerin kime gideceği: çoklu e-posta alıcısı ve çoklu
Telegram hedefi. Boş bırakılan liste Vercel'deki `EMAIL_TO` / `OWNER_CHAT_ID`
değerine döner. Günlük/aylık özet ve testler elle çalıştırılabilir.

**Teknik** · Tek şifreyle giriş ve 30 gün süren imzalı oturum; Inter
tipografisi, açık/koyu tema, cam yüzeyler (liquid glass yaklaşımı); iPhone'da
ana ekrana eklenebilen PWA; idempotent bildirim günlüğü; Vercel cron.

## Telegram botu

Bot buton odaklıdır: `/menu` (ya da `/start`) her şeyin başladığı ekrandır,
gündelik kullanımda komut yazmak gerekmez.

- **🧾 Ödeme tablosu** — Yıl seç, kiracı seç, 12 ay düğmesinden birine dokun.
  Panelde işaretlediğin ay burada da işaretlidir; ikisi aynı kayda yazar.
- **🏢 Aidat takibi** — Aynı 12 kutucuk mantığı aidat kalemleri için.
- **📄 Rapor / PDF** — Aylık (bir senenin tek ayı), yıllık ya da son 6/12/24 ay.
  PDF dosya olarak sohbete düşer; kira ve aidat aynı raporda.
- **📊 Bu ayın durumu**, **🗓 Takvim**, **👥 Kiracılar**, **📉 Giderler**,
  **🔔 Bildirimler**, **⚙️ Ayarlar**.

### Otomatik uyarılar

- Ödeme gününden **1 gün önce**: "… ödemesi yarın yapılmalı" (tutar ve tarihle).
- Vadeden **3 gün sonra** hâlâ ödenmediyse: "… ödemesini atmadı"; eksik
  yatırıldıysa "… eksik attı" ve ne kadar eksik olduğu.
- Aynı iki uyarı aidat kalemleri için de çalışır.
- Her uyarı dönem başına bir kez gider; erteleme yapılmışsa yeni tarihe göre
  hesaplanır. Süreler `DUE_REMINDER_DAYS` ve `LATE_REMINDER_DAYS` ile değişir.

### Komutlar (isteğe bağlı)

- /menu — Ana menü
- /odemetablosu — 12 aylık ödeme tablosu
- /aidat — 12 aylık aidat takibi
- /raporlar — PDF rapor merkezi
- /durum — İçinde bulunulan ayın ödeme durumu
- /takvim AA/YYYY — Durum işaretli Telegram takvimi
- /kiracilar — Kiracı listesi
- /kiraciekle · /kiraciduzenle · /kiracisil
- /odemeekle — Tutarı elle girerek ödeme kaydet
- /odemeler — Ödeme geçmişi
- /kiraertele — Bir dönemin son ödeme tarihini değiştir
- /ozet AA/YYYY — Dönem özeti
- /giderler AA/YYYY — Dönem giderleri
- /rapor 12 — Son N ayın metin özeti
- /bildirimler — Son bildirim kayıtları
- /hatirlatma — Günlük kontrolü elle çalıştır
- /webpanel — Web paneli adresi ve giriş şifresi

## Ortam değişkenleri

.env.example dosyasını temel alın:

    TELEGRAM_BOT_TOKEN=
    TELEGRAM_WEBHOOK_SECRET=
    OWNER_CHAT_ID=
    MONGODB_URI=
    PANEL_PASSWORD=
    SESSION_SECRET=
    PUBLIC_APP_URL=
    CRON_SECRET=
    TIMEZONE=Europe/Istanbul
    DUE_REMINDER_DAYS=1
    LATE_REMINDER_DAYS=3
    EMAIL_USER=
    EMAIL_PASS=
    EMAIL_TO=

### Panel girişi

Panel tek bir şifreyle açılır. `PANEL_PASSWORD` tanımlı değilse varsayılan
şifre `vedat0934` geçerlidir. Doğru şifre `POST /api/session` ile HMAC imzalı
bir oturum jetonuna çevrilir; jeton hem `HttpOnly` çerezte hem de tarayıcının
`localStorage`'ında **30 gün** durur, bu sürede tekrar giriş istenmez.

Jetonun imzası `SESSION_SECRET`ten türer. Bu değeri değiştirmek açık tüm
oturumları anında geçersiz kılar; tanımlı değilse imza şifreden türetilir, yani
şifreyi değiştirmek de tüm oturumları kapatır.

Adres ve şifre için Telegram botunda `/webpanel` yazın.

## Çalıştırma

    npm install
    npm run dev

Telegram botunu uzun yaşayan bir süreç olarak ayrıca çalıştırmak için:

    npm run bot

Webhook kurulumu:

    curl -X POST https://your-domain.vercel.app/api/set-webhook \
      -H "x-app-token: $PANEL_PASSWORD"

## Vercel

Vercel projesine şu production değişkenlerini ekleyin:

- TELEGRAM_BOT_TOKEN
- TELEGRAM_WEBHOOK_SECRET
- OWNER_CHAT_ID
- MONGODB_URI
- PANEL_PASSWORD
- SESSION_SECRET
- CRON_SECRET
- PUBLIC_APP_URL
- İsteğe bağlı: TIMEZONE, DUE_REMINDER_DAYS, LATE_REMINDER_DAYS, EMAIL_USER, EMAIL_PASS, EMAIL_TO

/api/cron Vercel cron tarafından günde bir kez çağrılır. CRON_SECRET ile
korunur. Sırasıyla düzenli giderleri işler, kiracı bazlı ödeme uyarılarını
(yaklaşan / gecikmiş) gönderir, sonra günlük ve aylık özetleri çalıştırır.
