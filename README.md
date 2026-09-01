# Seoul Central Mosque — Digital Display

Modern, minimal prayer display and information site for **Seoul Central Mosque (서울중앙성원)**  
39 Usadan-ro 10-gil, Yongsan-gu, Seoul, South Korea (Itaewon / Hannam-dong).

Built as an upgrade of the original design: same visual identity (60/30/10 palette, Inter + Playfair Display, glass cards, layout language) with professional features added.

## Features

- **Prayer countdown** with real state engine: NEXT → ADZAN → IQAMAH → PRAYER IN PROGRESS → NEXT
- **Asia/Seoul** timezone (not the visitor’s browser timezone)
- Configurable iqamah per prayer, adjustments, calculation method
- **TV / LED mode**: `display.html` (fullscreen, no navbar, auto-hide cursor)
- Daily reminder quotes (verified Qur’an & Hadith only)
- Verse of the day & Hadith of the day
- Agenda / kajian cards
- Photo gallery (local assets + credits)
- Separate YouTube video cards (no autoplay)
- History timeline
- Directions + Google Maps link
- Weather (Open-Meteo)
- Donation / QRIS slot (official image only — admin upload)
- **Admin panel** (`admin.html`) with localStorage + JSON import/export
- GitHub Pages ready (static HTML/CSS/JS/JSON)

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. Settings → Pages → Deploy from branch (root or `/docs`).
3. Open the generated URL.

No backend required for the basic version.

## Admin & data

- Settings: `data/settings.json` + browser `localStorage` (key `scm_settings`)
- Content: `data/quotes.json`, `quran.json`, `hadith.json`, `agenda.json`, `announcements.json`, `gallery.json`, `videos.json`, etc.
- Admin can export/import JSON. For multi-device shared data, connect Firebase/Supabase later.
- **Do not invent** Imam/Khatib names, QRIS, or Islamic texts. Empty fields show “Not configured”.

## Prayer times

Uses AlAdhan API with Seoul coordinates and `Asia/Seoul`.  
Mosque administrators should verify calculation method and local iqamah offsets.

## Photos

Place real, correctly licensed photos of **Seoul Central Mosque** in `assets/images/`.  
Update `data/gallery.json` and `data/image-credits.json`.  
Historical 1976 ceremony photos on Wikimedia Commons are generally public domain in South Korea; modern building photos may be restricted by FoP rules — check each file license.

## Structure

```
index.html          Main website
display.html        TV / LED full-screen mode
admin.html          Configuration panel
style.css           Design system (original + extensions)
app.js              Main logic
js/prayer-engine.js State machine
data/*.json         Content & settings
assets/images/      Local photos
assets/audio/       Adhan (authorized only)
```

## License / content

Mosque information is for community use. Verify all historical and operational details with the Korean Muslim Federation / Seoul Central Mosque before official publication.
