// ============================================================================
// MOTOR DE PERSISTENCIA TRIPLE CON VALIDACIÓN UNIFORME Y PRIVACIDAD (db.js)
// ============================================================================
const STORAGE_KEY = "totus_tuus_state_v2";
const IDB_NAME = "TotusTuusDB";
const IDB_STORE = "pilgrim_state";
const CACHE_NAME_STATE = "totus-tuus-state-cache-v2";
const CACHE_STATE_URL = "/__totus_tuus_saved_state__.json";

const VALID_FEAST_IDS = [
  "purificacion", "lourdes", "anunciacion", "dolores_v", "fatima",
  "auxiliadora", "realeza", "corazon_inmaculado", "visitacion", "carmen",
  "asuncion", "natividad", "sant_nombre", "dolores_sept", "merced",
  "rosario", "maternidad", "pilar", "presentacion", "medalla",
  "inmaculada", "guadalupe"
];

function stripUnsafeText(val, maxLen) {
  if (typeof val !== "string") return "";
  return val
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

function isValidPngDataUrl(val) {
  if (typeof val !== "string" || val.length === 0) return false;
  if (val.length > 260000) return false;
  return /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(val);
}

function sanitizeSigStrokes(strokes) {
  if (!Array.isArray(strokes)) return [];
  const safeStrokes = [];
  const maxStrokes = Math.min(strokes.length, 60);
  for (let i = 0; i < maxStrokes; i++) {
    const st = strokes[i];
    if (!Array.isArray(st)) continue;
    const safePts = [];
    const maxPts = Math.min(st.length, 400);
    for (let j = 0; j < maxPts; j++) {
      const pt = st[j];
      if (!pt || typeof pt !== "object") continue;
      const x = Number(pt.x);
      const y = Number(pt.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        safePts.push({
          x: Math.max(0, Math.min(600, Math.round(x))),
          y: Math.max(0, Math.min(320, Math.round(y)))
        });
      }
    }
    if (safePts.length > 1) safeStrokes.push(safePts);
  }
  return safeStrokes;
}

function sanitizeCompletedDays(rawDays) {
  const clean = {};
  if (!rawDays || typeof rawDays !== "object") return clean;
  for (let d = 1; d <= 34; d++) {
    if (rawDays[d] === true || rawDays[String(d)] === true) {
      clean[d] = true;
    }
  }
  return clean;
}

function countValidCompletedDays(completedDays) {
  if (!completedDays || typeof completedDays !== "object") return 0;
  let count = 0;
  for (let d = 1; d <= 34; d++) {
    if (completedDays[d] === true || completedDays[String(d)] === true) {
      count++;
    }
  }
  return count;
}

function buildSafeSignatureSvgFromStrokes(strokes, width = 600, height = 160) {
  const safeStrokes = sanitizeSigStrokes(strokes);
  if (safeStrokes.length === 0) return "";
  const w = Math.max(100, Math.min(1200, Math.round(Number(width) || 600)));
  const h = Math.max(60, Math.min(600, Math.round(Number(height) || 160)));
  const paths = safeStrokes.map((stroke) => {
    const d = stroke
      .map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
      .join(" ");
    return `<path d="${d}" fill="none" stroke="#22170C" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${paths.join("")}</svg>`;
}

const TotusStorage = {
  sanitizeState(raw) {
    if (!raw || typeof raw !== "object") return null;
    const yearNum = parseInt(raw.selectedYear, 10);
    const selectedYear = Number.isFinite(yearNum) && yearNum >= 2025 && yearNum <= 2035 ? yearNum : 2026;
    const selectedFeastId = typeof raw.selectedFeastId === "string" && VALID_FEAST_IDS.includes(raw.selectedFeastId)
      ? raw.selectedFeastId
      : "anunciacion";
    const completedDays = sanitizeCompletedDays(raw.completedDays);
    const doneCount = countValidCompletedDays(completedDays);
    const userName = stripUnsafeText(raw.userName || "", 120);
    const userPlace = stripUnsafeText(raw.userPlace || "", 120);
    const userTribute = stripUnsafeText(raw.userTribute || "Ayuno, limosna y cadenita bendecida", 180);
    const reminderEnabled = Boolean(raw.reminderEnabled);
    const reminderTime = typeof raw.reminderTime === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw.reminderTime)
      ? raw.reminderTime
      : "20:00";
    const lastApostoladoShownAt = Number.isFinite(Number(raw.lastApostoladoShownAt)) && Number(raw.lastApostoladoShownAt) >= 0
      ? Math.round(Number(raw.lastApostoladoShownAt))
      : 0;
    const sigStrokes = sanitizeSigStrokes(raw.sigStrokes);
    const signatureDataUrl = isValidPngDataUrl(raw.signatureDataUrl) ? raw.signatureDataUrl : "";
    const signatureSvg = buildSafeSignatureSvgFromStrokes(sigStrokes);
    const advSortOrder = raw.advSortOrder === "desc" ? "desc" : "asc";
    const scaleNum = Number(raw.fontSizeScale);
    const fontSizeScale = Number.isFinite(scaleNum)
      ? Math.min(1.45, Math.max(0.90, Number(scaleNum.toFixed(2))))
      : 1.05;
    const uiLang = ["es", "la", "en"].includes(raw.uiLang) ? raw.uiLang : "es";

    return {
      selectedYear,
      selectedFeastId,
      completedDays,
      userName,
      userPlace,
      userTribute,
      reminderEnabled,
      reminderTime,
      lastApostoladoShownAt,
      cristoReyUnlocked: doneCount >= 34,
      sigStrokes,
      signatureDataUrl,
      signatureSvg,
      advSortOrder,
      fontSizeScale,
      uiLang,
      updatedAt: Date.now()
    };
  },

  countValidCompletedDays,
  buildSafeSignatureSvgFromStrokes,
  isValidPngDataUrl,
  sanitizeSigStrokes,
  stripUnsafeText,

  openIDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new Error("No IDB"));
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async save(stateData) {
    const payload = this.sanitizeState(stateData);
    if (!payload) return;
    const jsonStr = JSON.stringify(payload);

    // 1. Guardar en localStorage
    try {
      localStorage.setItem(STORAGE_KEY, jsonStr);
      localStorage.setItem("totusTuusConsecrated", payload.cristoReyUnlocked ? "true" : "false");
    } catch (e) {}

    // 2. Guardar en IndexedDB
    try {
      const db = await this.openIDB();
      await new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(payload, "current");
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) {}

    // 3. Guardar respaldo en CacheStorage propio de Totus Tuus
    try {
      if (typeof caches !== "undefined") {
        const cache = await caches.open(CACHE_NAME_STATE);
        await cache.put(
          CACHE_STATE_URL,
          new Response(jsonStr, { headers: { "Content-Type": "application/json" } })
        );
      }
    } catch (e) {}
  },

  async load() {
    // 1. Intentar desde localStorage con validación uniforme
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && raw.length <= 524288) {
        const parsed = this.sanitizeState(JSON.parse(raw));
        if (parsed) return parsed;
      }
    } catch (e) {}

    // 2. Intentar desde IndexedDB con validación uniforme
    try {
      const db = await this.openIDB();
      const fromIdb = await new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get("current");
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => rej(req.error);
      });
      if (fromIdb) {
        const parsed = this.sanitizeState(fromIdb);
        if (parsed) return parsed;
      }
    } catch (e) {}

    // 3. Intentar desde CacheStorage con validación uniforme
    try {
      if (typeof caches !== "undefined") {
        const cache = await caches.open(CACHE_NAME_STATE);
        const resp = await cache.match(CACHE_STATE_URL);
        if (resp) {
          const json = await resp.json();
          const parsed = this.sanitizeState(json);
          if (parsed) return parsed;
        }
      }
    } catch (e) {}

    return null;
  },

  async clearPersonalData(currentState) {
    currentState.userName = "";
    currentState.userPlace = "";
    currentState.sigStrokes = [];
    currentState.signatureDataUrl = "";
    currentState.signatureSvg = "";
    await this.save(currentState);
  }
};

window.TotusStorage = TotusStorage;
