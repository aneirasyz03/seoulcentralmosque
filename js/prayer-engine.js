/**
 * Seoul Central Mosque — Prayer State Engine
 * Uses Asia/Seoul timezone exclusively for mosque display.
 * States: NEXT_PRAYER → ADZAN → IQAMAH → PRAYER_IN_PROGRESS → NEXT_PRAYER
 */
(function (global) {
  const PRAYER_ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const STATE = {
    NEXT: "NEXT_PRAYER",
    ADZAN: "ADZAN",
    IQAMAH: "IQAMAH",
    IN_PROGRESS: "PRAYER_IN_PROGRESS"
  };

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function getSeoulNow() {
    // Force Asia/Seoul
    const now = new Date();
    const seoulStr = now.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
    return new Date(seoulStr);
  }

  function parseTimeToDate(timeStr, baseDate) {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date(baseDate);
    d.setHours(h, m, 0, 0);
    return d;
  }

  function formatCountdown(ms) {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    return `${pad(hh)} : ${pad(mm)} : ${pad(ss)}`;
  }

  class PrayerEngine {
    constructor(settings) {
      this.settings = settings || {};
      this.schedule = {}; // { Fajr: "04:38", ... }
      this.state = STATE.NEXT;
      this.currentPrayer = null;
      this.nextPrayer = null;
      this.iqamahEnd = null;
      this.adzanEnd = null;
      this.inProgressEnd = null;
      this.listeners = [];
      this._tickTimer = null;
    }

    onUpdate(fn) {
      this.listeners.push(fn);
    }

    emit() {
      const payload = this.getStatus();
      this.listeners.forEach((fn) => fn(payload));
    }

    setSchedule(schedule) {
      this.schedule = schedule || {};
      this.recalculate();
    }

    getIqamahMinutes(name) {
      const iq = (this.settings.prayer && this.settings.prayer.iqamah) || {};
      return iq[name] != null ? Number(iq[name]) : 10;
    }

    getAdhanSeconds() {
      return (this.settings.prayer && this.settings.prayer.adhanDurationSeconds) || 180;
    }

    getInProgressMinutes() {
      return (this.settings.prayer && this.settings.prayer.prayerInProgressDurationMinutes) || 15;
    }

    recalculate() {
      const now = getSeoulNow();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      let next = null;
      for (const name of PRAYER_ORDER) {
        if (!this.schedule[name]) continue;
        const t = parseTimeToDate(this.schedule[name], today);
        if (t > now) {
          next = { name, time: this.schedule[name], target: t };
          break;
        }
      }
      if (!next && this.schedule.Fajr) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        next = {
          name: "Fajr",
          time: this.schedule.Fajr,
          target: parseTimeToDate(this.schedule.Fajr, tomorrow)
        };
      }
      this.nextPrayer = next;
      // Keep state machine running; do not force reset state here unless needed
      this.emit();
    }

    getStatus() {
      const now = getSeoulNow();
      let label = "NEXT PRAYER";
      let name = this.nextPrayer ? this.nextPrayer.name : "—";
      let time = this.nextPrayer ? this.nextPrayer.time : "--:--";
      let countdown = "-- : -- : --";
      let sub = "";

      if (this.state === STATE.ADZAN && this.currentPrayer) {
        label = "NOW — " + this.currentPrayer;
        name = "ADZAN";
        time = this.schedule[this.currentPrayer] || "";
        const remaining = this.adzanEnd - now;
        countdown = formatCountdown(remaining);
        sub = "Adhan in progress";
      } else if (this.state === STATE.IQAMAH && this.currentPrayer) {
        label = "IQAMAH IN";
        name = this.currentPrayer;
        time = this.schedule[this.currentPrayer] || "";
        const remaining = this.iqamahEnd - now;
        countdown = formatCountdown(remaining);
        sub = "Prepare for prayer";
      } else if (this.state === STATE.IN_PROGRESS && this.currentPrayer) {
        label = "PRAYER IN PROGRESS";
        name = this.currentPrayer;
        time = this.schedule[this.currentPrayer] || "";
        const remaining = this.inProgressEnd - now;
        countdown = formatCountdown(remaining);
        sub = "Please maintain silence";
      } else if (this.nextPrayer) {
        label = "NEXT PRAYER";
        name = this.nextPrayer.name;
        time = this.nextPrayer.time;
        countdown = formatCountdown(this.nextPrayer.target - now);
        sub = "Seoul · Asia/Seoul";
      }

      return {
        state: this.state,
        label,
        name,
        time,
        countdown,
        sub,
        schedule: this.schedule,
        nextPrayer: this.nextPrayer,
        currentPrayer: this.currentPrayer
      };
    }

    tick() {
      const now = getSeoulNow();

      // State transitions
      if (this.state === STATE.NEXT && this.nextPrayer) {
        if (now >= this.nextPrayer.target) {
          // Prayer time arrived → ADZAN
          this.currentPrayer = this.nextPrayer.name;
          this.state = STATE.ADZAN;
          this.adzanEnd = new Date(now.getTime() + this.getAdhanSeconds() * 1000);
          this.emit();
          // Optional: trigger adhan audio here via callback
          if (typeof this.onAdhanStart === "function") this.onAdhanStart(this.currentPrayer);
        }
      } else if (this.state === STATE.ADZAN) {
        if (now >= this.adzanEnd) {
          this.state = STATE.IQAMAH;
          const mins = this.getIqamahMinutes(this.currentPrayer);
          this.iqamahEnd = new Date(now.getTime() + mins * 60 * 1000);
          this.emit();
        }
      } else if (this.state === STATE.IQAMAH) {
        if (now >= this.iqamahEnd) {
          this.state = STATE.IN_PROGRESS;
          const mins = this.getInProgressMinutes();
          this.inProgressEnd = new Date(now.getTime() + mins * 60 * 1000);
          this.emit();
        }
      } else if (this.state === STATE.IN_PROGRESS) {
        if (now >= this.inProgressEnd) {
          this.state = STATE.NEXT;
          this.currentPrayer = null;
          this.recalculate();
          this.emit();
        }
      }

      // Always refresh countdown display
      this.emit();
    }

    start() {
      if (this._tickTimer) clearInterval(this._tickTimer);
      this.recalculate();
      this.tick();
      this._tickTimer = setInterval(() => this.tick(), 1000);
    }

    stop() {
      if (this._tickTimer) clearInterval(this._tickTimer);
    }
  }

  global.PrayerEngine = PrayerEngine;
  global.PRAYER_STATE = STATE;
  global.getSeoulNow = getSeoulNow;
})(typeof window !== "undefined" ? window : global);
