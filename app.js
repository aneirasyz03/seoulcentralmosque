/**
 * Seoul Central Mosque — main application
 * Preserves original design language; adds prayer state engine, content, gallery, etc.
 */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* Theme toggle */
function applyTheme(dark) {
  document.body.classList.toggle("dark", !!dark);
  try { localStorage.setItem("scm_theme", dark ? "dark" : "light"); } catch (e) {}
}
function initTheme() {
  let dark = false;
  try { dark = localStorage.getItem("scm_theme") === "dark"; } catch (e) {}
  applyTheme(dark);
  const btn = document.getElementById("themeBtn");
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = "1";
    btn.addEventListener("click", function () {
      applyTheme(!document.body.classList.contains("dark"));
    });
  }
}


const PRAYER_NAMES = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const PRAYER_ICONS = { Fajr: "🌙", Dhuhr: "☀️", Asr: "🌤️", Maghrib: "🌇", Isha: "🌙" };

let settings = {};
let engine = null;
let galleryIndex = 0;
let galleryItems = [];

async function loadJSON(path, fallback = null) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch (e) {
    console.warn("Failed to load", path, e && e.message);
    return fallback;
  }
}

function getStoredSettings() {
  try {
    const raw = localStorage.getItem("scm_settings");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function seoulNow() {
  return typeof getSeoulNow === "function" ? getSeoulNow() : new Date();
}

/* ---------- Clock ---------- */
function tickClock() {
  const now = seoulNow();
  const t = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
  const d = now.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });
  const g = now.toLocaleDateString("en-GB", { weekday: "short", year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Seoul" });
  if ($("#clock")) $("#clock").textContent = t;
  if ($("#date")) $("#date").textContent = d;
  if ($("#gregDate")) $("#gregDate").textContent = g;
}

/* ---------- Prayer times via AlAdhan (Seoul coords + Asia/Seoul) ---------- */
async function fetchPrayerTimes() {
  const lat = (settings.prayer && settings.prayer.latitude) || 37.5333;
  const lng = (settings.prayer && settings.prayer.longitude) || 126.9975;
  const method = (settings.prayer && settings.prayer.method) || 3;
  const now = seoulNow();
  const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
  const url = `https://api.aladhan.com/v1/timings/${date}?latitude=${lat}&longitude=${lng}&method=${method}&timezonestring=Asia/Seoul`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const t = json.data.timings;
    const schedule = {
      Fajr: t.Fajr.slice(0, 5),
      Dhuhr: t.Dhuhr.slice(0, 5),
      Asr: t.Asr.slice(0, 5),
      Maghrib: t.Maghrib.slice(0, 5),
      Isha: t.Isha.slice(0, 5)
    };
    // apply adjustments
    const adj = (settings.prayer && settings.prayer.adjustments) || {};
    for (const k of Object.keys(schedule)) {
      if (adj[k]) {
        const [h, m] = schedule[k].split(":").map(Number);
        const d = new Date(2000, 0, 1, h, m + Number(adj[k]), 0);
        schedule[k] = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }
    if ($("#hijriDate") && json.data.date && json.data.date.hijri) {
      const h = json.data.date.hijri;
      $("#hijriDate").textContent = `${h.day} ${h.month.en} ${h.year} AH`;
    }
    return schedule;
  } catch (e) {
    console.warn("Prayer API failed, using fallback", e);
    return { Fajr: "04:38", Dhuhr: "12:03", Asr: "15:42", Maghrib: "18:07", Isha: "19:18" };
  }
}

function renderPrayerCards(schedule, activeName) {
  const grid = $("#prayerGrid");
  if (!grid) return;
  grid.innerHTML = "";
  PRAYER_NAMES.forEach((name) => {
    const card = document.createElement("article");
    card.className = "prayer-card" + (name === activeName ? " active" : "");
    card.id = "card-" + name;
    card.innerHTML = `<span>${PRAYER_ICONS[name] || ""} ${name}</span><time>${schedule[name] || "--:--"}</time>`;
    grid.appendChild(card);
  });
}

function onEngineUpdate(status) {
  if ($("#prayerLabel")) $("#prayerLabel").textContent = status.label;
  if ($("#nextName")) $("#nextName").textContent = status.name;
  if ($("#nextTime")) $("#nextTime").textContent = status.time;
  if ($("#countdown")) $("#countdown").textContent = status.countdown;
  if ($("#countdownLabel")) $("#countdownLabel").textContent = status.sub || "Asia/Seoul · Seoul Central Mosque";
  if ($("#countdownHint")) {
    if (status.state === "ADZAN") $("#countdownHint").textContent = "ADZAN";
    else if (status.state === "IQAMAH") $("#countdownHint").textContent = "IQAMAH IN";
    else if (status.state === "PRAYER_IN_PROGRESS") $("#countdownHint").textContent = "IN PROGRESS";
    else $("#countdownHint").textContent = "STARTS IN";
  }
  renderPrayerCards(status.schedule || {}, status.nextPrayer ? status.nextPrayer.name : status.currentPrayer);
}

/* ---------- Content loaders ---------- */
async function loadQuotes() {
  const list = [
    { text: "Indeed, in the remembrance of Allah do hearts find rest.", source: "Qur'an 13:28" },
    { text: "And We have not sent you, [O Muhammad], except as a mercy to the worlds.", source: "Qur'an 21:107" },
    { text: "Allah does not burden a soul beyond that it can bear.", source: "Qur'an 2:286" },
    { text: "So remember Me; I will remember you. And be grateful to Me and do not deny Me.", source: "Qur'an 2:152" },
    { text: "The best among you are those who have the best manners and character.", source: "Sahih al-Bukhari 3559" },
    { text: "None of you truly believes until he loves for his brother what he loves for himself.", source: "Sahih al-Bukhari 13" },
    { text: "Make things easy and do not make them difficult, give glad tidings and do not repel people.", source: "Sahih al-Bukhari 69" },
    { text: "Whoever believes in Allah and the Last Day, let him speak good or remain silent.", source: "Sahih al-Bukhari 6018" }
  ];
  try {
    const remote = await loadJSON("data/quotes.json", null);
    if (remote && remote.length) {
      // use remote if available
      const idx = Math.floor(Math.random() * remote.length);
      const q = remote[idx];
      if ($("#quoteText")) $("#quoteText").textContent = "\u201C" + q.text + "\u201D";
      if ($("#quoteSource")) $("#quoteSource").textContent = q.source || "";
      return;
    }
  } catch (e) {}
  const idx = Math.floor(Math.random() * list.length);
  const q = list[idx];
  if ($("#quoteText")) $("#quoteText").textContent = "\u201C" + q.text + "\u201D";
  if ($("#quoteSource")) $("#quoteSource").textContent = q.source || "";
}

async function loadQuranHadith() {
  const qList = [
    { arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا", translation: "Indeed, with hardship comes ease.", source: "Qur'an 94:6" },
    { arabic: "فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ", translation: "So remember Me; I will remember you. And be grateful to Me and do not deny Me.", source: "Qur'an 2:152" },
    { arabic: "وَذَكِّرْ فَإِنَّ الذِّكْرَىٰ تَنفَعُ الْمُؤْمِنِينَ", translation: "And remind, for indeed, the reminder benefits the believers.", source: "Qur'an 51:55" }
  ];
  const hList = [
    { text: "The best of you are those who learn the Qur'an and teach it.", source: "Sahih al-Bukhari 5027" },
    { text: "Actions are judged by intentions, and every person will get what he intended.", source: "Sahih al-Bukhari 1" },
    { text: "A Muslim is the one from whose tongue and hands the Muslims are safe.", source: "Sahih al-Bukhari 10" }
  ];
  const q = qList[Math.floor(Math.random() * qList.length)];
  const h = hList[Math.floor(Math.random() * hList.length)];
  if ($("#quranArabic")) $("#quranArabic").textContent = q.arabic || "";
  if ($("#quranTranslation")) $("#quranTranslation").textContent = q.translation || "";
  if ($("#quranSource")) $("#quranSource").textContent = q.source || "";
  if ($("#hadithText")) $("#hadithText").textContent = h.text || "";
  if ($("#hadithSource")) $("#hadithSource").textContent = h.source || "";
}

async function loadAgenda() {
  const list = await loadJSON("data/agenda.json", []);
  const grid = $("#agendaGrid");
  if (!grid) return;
  grid.innerHTML = "";
  list.filter((a) => a.enabled !== false).forEach((a) => {
    const d = new Date(a.date + "T12:00:00");
    const day = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    const el = document.createElement("article");
    el.className = "agenda-card";
    el.innerHTML = `<div class="date-badge">${day}</div><h3>${a.title}</h3><div class="time">${a.time}${a.location ? " · " + a.location : ""}</div>`;
    grid.appendChild(el);
  });
  if (!list.length) grid.innerHTML = "<p class='muted'>No agenda configured.</p>";
}

async function loadVideos() {
  const list = [
    {
      title: "Seoul Central Mosque",
      thumbnail: "https://img.youtube.com/vi/LVNIaQ6ybuo/hqdefault.jpg",
      url: "https://www.youtube.com/watch?v=LVNIaQ6ybuo"
    },
    {
      title: "Seoul Mosque Experience",
      thumbnail: "https://img.youtube.com/vi/w-hV7xMKMQw/hqdefault.jpg",
      url: "https://www.youtube.com/watch?v=w-hV7xMKMQw"
    },
    {
      title: "Seoul Central Mosque tour",
      thumbnail: "https://img.youtube.com/vi/VCI3SEUBKVI/hqdefault.jpg",
      url: "https://www.youtube.com/watch?v=VCI3SEUBKVI"
    },
    {
      title: "Seoul Mosque visit",
      thumbnail: "https://img.youtube.com/vi/GHQ9FS1_et8/hqdefault.jpg",
      url: "https://www.youtube.com/watch?v=GHQ9FS1_et8"
    },
    {
      title: "Inside Seoul Central Mosque",
      thumbnail: "https://img.youtube.com/vi/meg6qM5703M/hqdefault.jpg",
      url: "https://www.youtube.com/watch?v=meg6qM5703M"
    }
  ];
  const grid = document.querySelector("#videoGrid");
  if (!grid) return;
  if (grid.dataset.loaded === "1") return; // prevent double render
  grid.dataset.loaded = "1";
  grid.innerHTML = "";
  list.forEach(function (v) {
    const el = document.createElement("article");
    el.className = "video-card";
    el.innerHTML =
      '<a href="' + v.url + '" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;display:block">' +
      '<div class="thumb-wrap">' +
      '<img src="' + v.thumbnail + '" alt="' + v.title + '" loading="lazy" referrerpolicy="no-referrer" ' +
      "onerror=\"this.style.display='none'\">" +
      '<div class="play-badge">▶</div></div>' +
      '<div class="body"><h3>' + v.title + '</h3>' +
      '<span style="font-size:12px;font-weight:800;color:var(--blue);letter-spacing:.06em">WATCH VIDEO →</span>' +
      '</div></a>';
    grid.appendChild(el);
  });
}

async function loadGallery() { /* gallery removed */ }

function showGallery() { /* gallery removed */ }

async function loadDonation() {
  const msg = (settings.donation && settings.donation.message) || "";
  const bank = (settings.donation && settings.donation.bankInfo) || "";
  const qris = (settings.donation && settings.donation.qrisImage) || "";
  if ($("#donationMessage")) $("#donationMessage").textContent = msg;
  if ($("#bankInfo")) $("#bankInfo").textContent = bank;
  const area = $("#qrisArea");
  if (area && qris) {
    area.className = "";
    area.innerHTML = `<img class="qris" src="${qris}" alt="Official QRIS">`;
  }
}

/* ---------- Weather (Open-Meteo, no key) ---------- */
async function loadWeather() {
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=37.5333&longitude=126.9975&current=temperature_2m,apparent_temperature,weather_code&timezone=Asia%2FSeoul";
    const res = await fetch(url);
    const j = await res.json();
    const c = j.current;
    const pill = $("#weatherPill");
    if (pill && c) {
      pill.style.display = "inline-flex";
      pill.textContent = `SEOUL · ${Math.round(c.temperature_2m)}°C · Feels ${Math.round(c.apparent_temperature)}°C`;
    }
  } catch (e) {
    /* silent */
  }
}

/* ---------- Init ---------- */
async function init() {
  const fileSettings = await loadJSON("data/settings.json", {});
  const stored = getStoredSettings();
  settings = Object.assign({}, fileSettings, stored || {});

  engine = new PrayerEngine(settings);
  engine.onUpdate(onEngineUpdate);

  const schedule = await fetchPrayerTimes();
  engine.setSchedule(schedule);
  engine.start();

  tickClock();
  setInterval(tickClock, 1000);

  loadQuotes();
  loadQuranHadith();
  loadAgenda();
  loadDonation();
  loadWeather();

  // theme handled by initTheme()

  // refresh prayer times at midnight Seoul
  setInterval(async () => {
    const s = await fetchPrayerTimes();
    engine.setSchedule(s);
  }, 60 * 60 * 1000);
}

document.addEventListener("DOMContentLoaded", function () {
  try { initTheme(); } catch (e) { console.warn(e); }
  // Content first so UI is never empty even if prayer API fails
  try { loadQuotes(); } catch (e) { console.warn(e); }
  try { loadQuranHadith(); } catch (e) { console.warn(e); }
  try { loadVideos(); } catch (e) { console.warn(e); }
    try { loadAgenda(); } catch (e) { console.warn(e); }
  try { loadDonation(); } catch (e) { console.warn(e); }
  try { loadWeather(); } catch (e) { console.warn(e); }
  try { init(); } catch (e) { console.warn("init error", e); }
  // clock always
  try {
    tickClock();
    setInterval(tickClock, 1000);
  } catch (e) {}
  try { initTheme(); } catch (e) {}
});

try { if (document.readyState !== 'loading') initTheme(); } catch (e) {}
