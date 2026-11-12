// ============================================================================
// MOTOR DE PERSISTENCIA TRIPLE: localStorage + IndexedDB + CacheStorage
// ============================================================================
const STORAGE_KEY = "totus_tuus_state_v2";
const IDB_NAME = "TotusTuusDB";
const IDB_STORE = "pilgrim_state";
const CACHE_STATE_URL = "/__totus_tuus_saved_state__.json";

const TotusStorage = {
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
    const payload = {
      selectedYear: stateData.selectedYear,
      selectedFeastId: stateData.selectedFeastId,
      completedDays: stateData.completedDays || {},
      userName: stateData.userName || "",
      userPlace: stateData.userPlace || "",
      userTribute: stateData.userTribute || "",
      reminderEnabled: !!stateData.reminderEnabled,
      reminderTime: stateData.reminderTime || "20:00",
      lastApostoladoShownAt: stateData.lastApostoladoShownAt || 0,
      signatureDataUrl: stateData.signatureDataUrl || "",
      signatureSvg: stateData.signatureSvg || "",
      advSortOrder: stateData.advSortOrder || "asc",
      fontSizeScale: stateData.fontSizeScale || 1.05,
      uiLang: stateData.uiLang || "es",
      updatedAt: Date.now()
    };
    const jsonStr = JSON.stringify(payload);

    // 1. Guardar en localStorage (lectura instantánea síncrona)
    try {
      localStorage.setItem(STORAGE_KEY, jsonStr);
    } catch (e) {}

    // 2. Guardar en IndexedDB (persistencia robusta asíncrona)
    try {
      const db = await this.openIDB();
      await new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(payload, "current");
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) {}

    // 3. Guardar respaldo en CacheStorage (disponible para el Service Worker offline)
    try {
      if (typeof caches !== "undefined") {
        const cache = await caches.open("totus-tuus-state-cache-v2");
        await cache.put(
          CACHE_STATE_URL,
          new Response(jsonStr, { headers: { "Content-Type": "application/json" } })
        );
      }
    } catch (e) {}
  },

  async load() {
    // 1. Intentar desde localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}

    // 2. Intentar desde IndexedDB
    try {
      const db = await this.openIDB();
      const fromIdb = await new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get("current");
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => rej(req.error);
      });
      if (fromIdb) return fromIdb;
    } catch (e) {}

    // 3. Intentar desde CacheStorage
    try {
      if (typeof caches !== "undefined") {
        const cache = await caches.open("totus-tuus-state-cache-v2");
        const resp = await cache.match(CACHE_STATE_URL);
        if (resp) return await resp.json();
      }
    } catch (e) {}

    return null;
  }
};

window.TotusStorage = TotusStorage;
