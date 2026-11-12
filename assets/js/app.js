// ============================================================================
// CONTROLADOR PRINCIPAL DE LA PWA «TOTUS TUUS» (app.js)
// ============================================================================

const DAYS_WEEK_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const ROMAN_NUMS = ["I", "II", "III", "IV", "V"];
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const state = {
  screen: "home", // 'home' | 'consagracion' | 'dogmas' | 'advocaciones'
  deviceType: "Escritorio / PC",
  uiLang: "es", // 'es' | 'la' | 'en'
  fontSizeScale: 1.05, // Escala de lectura sin deformar cabeceras (0.90 a 1.45)

  // Consagración
  selectedYear: 2026,
  selectedFeastId: "anunciacion",
  consecStep: "select", // 'select' | 'calendar' | 'day'
  consecStageTab: 1, // 1..5
  stageSubPage: 0, // Paginación de 6 en 6 en la Etapa I
  selectedDay: 1, // 1..34
  daySubTab: "meditacion", // 'meditacion' | 'oraciones' | 'formula'
  activePrayerKey: "veniCreator",
  prayerLang: "es", // 'es' | 'la'
  completedDays: {},

  // Recordatorios Diarios y Aviso Semanal del Apostolado
  reminderEnabled: false,
  reminderTime: "20:00",
  lastApostoladoShownAt: 0,

  // Dogmas
  dogmaSubView: "list", // 'list' | 'detail'
  selectedDogmaId: "maternidad",
  dogmaTab: "declaracion",

  // Advocaciones (orden cronológico por defecto)
  advSubView: "list", // 'list' | 'detail'
  advSortOrder: "asc", // 'asc' (Más antigua -> Más reciente) | 'desc' (Más reciente -> Más antigua)
  advPage: 0,
  advSearch: "",
  selectedAdvNum: 1,
  advTab: "historia",

  // Datos del Consagrado y Firma Digital (Base64 + SVG)
  userName: "",
  userPlace: "Veracruz, México",
  userTribute: "Ayuno, limosna y cadenita bendecida",
  signatureDataUrl: "",
  signatureSvg: "",
  sigStrokes: [],
  sigExpanded: false
};

// Normalizador de acentos y diacríticos para búsqueda inteligente
function normalizeText(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Autodetección silenciosa de dispositivo
function detectDevice() {
  const w = window.innerWidth;
  if (w < 640) state.deviceType = "Móvil";
  else if (w < 1024) state.deviceType = "Tablet";
  else state.deviceType = "Escritorio / PC";
  const badge = document.getElementById("device-detect-badge");
  if (badge) badge.textContent = state.deviceType;
}

// Cálculo exacto de fecha (soporta años bisiestos automáticamente)
function computeExactDateForDay(feastObj, year, dayNumber) {
  const targetDate = new Date(year, feastObj.month - 1, feastObj.day);
  const offsetDays = 34 - dayNumber;
  const d = new Date(targetDate.getTime());
  d.setDate(d.getDate() - offsetDays);
  return {
    weekday: DAYS_WEEK_ES[d.getDay()],
    day: d.getDate(),
    monthName: MONTHS_ES[d.getMonth()],
    year: d.getFullYear(),
    shortLabel: `${DAYS_WEEK_ES[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS_ES[d.getMonth()].slice(0, 3)}`,
    fullLabel: `${DAYS_WEEK_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`
  };
}

function persistState() {
  if (window.TotusStorage) {
    window.TotusStorage.save(state);
  }
}

function showToast(msg) {
  const toast = document.getElementById("gentle-toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove("hidden", "opacity-0");
  toast.classList.add("opacity-100");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.add("opacity-0");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 2200);
}

// Control de la pestaña semanal del Apostolado con colapso en 0.25ms
function openApostoladoTab() {
  const tab = document.getElementById("apostolado-weekly-tab");
  if (!tab) return;
  tab.classList.remove("hidden", "apostolado-tab-collapsed");
}

function closeApostoladoTabInstant() {
  const tab = document.getElementById("apostolado-weekly-tab");
  if (!tab) return;
  tab.classList.add("apostolado-tab-collapsed");
  state.lastApostoladoShownAt = Date.now();
  persistState();
  setTimeout(() => {
    tab.classList.add("hidden");
  }, 1);
}

function checkWeeklyApostoladoDisplay() {
  const now = Date.now();
  if (!state.lastApostoladoShownAt || now - state.lastApostoladoShownAt >= ONE_WEEK_MS) {
    openApostoladoTab();
  }
}

// Actualiza el indicador global de progreso (ej. "12 / 34 días")
function updateGlobalProgressBadge() {
  const count = Object.keys(state.completedDays).filter((k) => state.completedDays[k]).length;
  const pct = Math.round((count / 34) * 100);
  document.querySelectorAll(".global-progress-text").forEach((el) => {
    el.textContent = `${count} / 34 días (${pct}%)`;
  });
  const bar = document.getElementById("global-progress-bar");
  if (bar) bar.style.width = `${Math.max(3, pct)}%`;
}

// Escalado de lectura indeformable (solo escala .reading-scalable y .btn-title-scalable, jamás la cabecera)
function applyFontScaleAndLang() {
  document.documentElement.style.setProperty("--reading-scale", String(state.fontSizeScale));
  const pctEl = document.getElementById("settings-font-pct");
  if (pctEl) {
    pctEl.textContent = `${Math.round(state.fontSizeScale * 100)}%`;
  }
  const dict = window.UI_I18N[state.uiLang] || window.UI_I18N.es;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });
}

// Sincroniza el Nombre y Ciudad del Consagrado en TODAS las vistas y fórmulas en tiempo real
function syncUserNameAndPlaceEverywhere() {
  const nameVal = state.userName || "";
  const placeVal = state.userPlace || "";

  const in1 = document.getElementById("input-cert-name");
  if (in1 && in1.value !== nameVal) in1.value = nameVal;

  const in2 = document.getElementById("input-cert-name-modal");
  if (in2 && in2.value !== nameVal) in2.value = nameVal;

  const pl1 = document.getElementById("input-cert-place");
  if (pl1 && pl1.value !== placeVal) pl1.value = placeVal;

  const pl2 = document.getElementById("input-cert-place-modal");
  if (pl2 && pl2.value !== placeVal) pl2.value = placeVal;

  const displayName = nameVal.trim() || "[Escribe arriba tu nombre y apellidos]";
  const liveRef = document.getElementById("name-live-reflection");
  if (liveRef) {
    liveRef.innerHTML = `En tu Consagración dirá: «Yo, <strong class="text-[#7A5612] underline decoration-[#C8A96A]">${displayName}</strong>, pecador infiel, renuevo y ratifico hoy en vuestras manos los votos de mi Bautismo...»`;
  }

  const dayFormulaEl = document.getElementById("day-formula-dynamic-text");
  if (dayFormulaEl) {
    const dayName = nameVal.trim() || "________________________________";
    dayFormulaEl.innerHTML = `«Yo, <strong class="text-[#7A5612] underline">${dayName}</strong>, pecador infiel, renuevo y ratifico hoy en vuestras manos los votos de mi Bautismo; renuncio para siempre a Satanás, a sus pompas y a sus obras, y me entrego enteramente a Jesucristo, la Sabiduría encarnada, para llevar mi cruz tras Él todos los días de mi vida. Os entrego y consagro, en calidad de esclavo, mi cuerpo y mi alma, mis bienes interiores y exteriores, y aun el valor de mis buenas acciones pasadas, presentes y futuras...»`;
  }

  renderCertificatePreview();
}

function switchScreen(target) {
  state.screen = target;
  ["home", "consagracion", "dogmas", "advocaciones"].forEach((s) => {
    const el = document.getElementById(`screen-${s}`);
    if (el) el.classList.toggle("hidden", s !== target);
  });
  updateGlobalProgressBadge();
}

// ============================================================================
// RECORDATORIOS DIARIOS DE ORACIÓN (EN PASO A Y EN MENÚ HAMBURGUESA)
// ============================================================================
function renderReminderControls() {
  ["input-reminder-time", "settings-reminder-time"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = state.reminderTime || "20:00";
  });

  ["btn-toggle-reminder", "settings-btn-toggle-reminder"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(state.reminderEnabled));
    if (state.reminderEnabled) {
      btn.textContent = `🔔 Recordatorio Activo (${state.reminderTime})`;
      btn.className = "day-completed-btn px-3 py-1.5 rounded-xl font-cinzel text-xs font-bold shadow";
    } else {
      btn.textContent = "🔕 Activar Recordatorio Diario";
      btn.className = "fine-gold-btn px-3 py-1.5 rounded-xl font-cinzel text-xs font-bold";
    }
  });
}

function setupDailyReminderScheduler() {
  clearInterval(window.__reminderInterval);
  window.__reminderInterval = setInterval(() => {
    if (!state.reminderEnabled) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const currentHm = `${hh}:${mm}`;
    const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${currentHm}`;
    if (currentHm === state.reminderTime && window.__lastNotifiedKey !== todayKey) {
      window.__lastNotifiedKey = todayKey;
      showToast("✠ Hora de tu meditación y oración de Consagración a Jesús por María");
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("✠ Totus Tuus — Consagración a Jesús por María", {
            body: `Es la hora (${state.reminderTime}) de rezar tu día de preparación con la Santísima Virgen.`,
            icon: "assets/img/icon-192.png"
          });
        } catch (e) {}
      }
    }
  }, 25000);
}

// ============================================================================
// 1. RENDERIZADO DE CONSAGRACIÓN
// ============================================================================
function renderYearAndFeastSelectors() {
  const years = [2026, 2027, 2028, 2029, 2030];
  const pillsEl = document.getElementById("year-selector-pills");
  pillsEl.innerHTML = years.map((y) => `
    <button type="button" data-year="${y}" aria-pressed="${y === state.selectedYear}" class="year-pill px-2.5 py-1 rounded-lg font-cinzel text-xs font-bold transition-all ${y === state.selectedYear ? "fine-gold-active" : "fine-gold-btn"}">
      ${y}
    </button>
  `).join("");

  pillsEl.querySelectorAll(".year-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedYear = parseInt(btn.getAttribute("data-year"), 10);
      persistState();
      renderYearAndFeastSelectors();
      renderCertificatePreview();
    });
  });

  const selectEl = document.getElementById("select-liturgical-feast");
  selectEl.innerHTML = window.LITURGICAL_CONSECRATION_FEASTS.map((f) =>
    `<option value="${f.id}" ${f.id === state.selectedFeastId ? "selected" : ""}>${f.title}</option>`
  ).join("");

  const feast = window.LITURGICAL_CONSECRATION_FEASTS.find((f) => f.id === state.selectedFeastId) || window.LITURGICAL_CONSECRATION_FEASTS[0];
  const day1Info = computeExactDateForDay(feast, state.selectedYear, 1);
  const day34Info = computeExactDateForDay(feast, state.selectedYear, 34);

  document.getElementById("preview-start-date").textContent = day1Info.fullLabel;
  document.getElementById("preview-end-date").textContent = day34Info.fullLabel;
  document.getElementById("preview-feast-meaning").textContent = feast.meaning;

  syncUserNameAndPlaceEverywhere();
  renderReminderControls();
  updateGlobalProgressBadge();
}

function renderConsecrationCalendar() {
  const feast = window.LITURGICAL_CONSECRATION_FEASTS.find((f) => f.id === state.selectedFeastId) || window.LITURGICAL_CONSECRATION_FEASTS[0];
  const day34Info = computeExactDateForDay(feast, state.selectedYear, 34);
  const shortFeastTitle = (feast.title.split("—")[1]?.trim() || feast.title).replace(/\s*\(.*?\)\s*/g, "");
  document.getElementById("calendar-feast-header").textContent =
    `${shortFeastTitle} · ${day34Info.fullLabel}`;

  document.querySelectorAll(".stage-tab").forEach((btn) => {
    const st = parseInt(btn.getAttribute("data-stage-tab"), 10);
    const active = st === state.consecStageTab;
    btn.setAttribute("aria-selected", String(active));
    btn.className = `stage-tab py-1.5 px-1 rounded-xl text-center transition-all ${active ? "fine-gold-active" : "fine-gold-btn"}`;
  });

  const stSummary = window.STAGE_SUMMARIES[state.consecStageTab] || window.STAGE_SUMMARIES[1];
  const daysInStage = window.DAYS_DATA.filter((d) => d.stage === state.consecStageTab);
  const doneInStage = daysInStage.filter((d) => !!state.completedDays[d.day]).length;

  const pageSize = 6;
  const totalStagePages = Math.max(1, Math.ceil(daysInStage.length / pageSize));
  if (state.stageSubPage >= totalStagePages) state.stageSubPage = 0;
  const visibleDays = daysInStage.slice(state.stageSubPage * pageSize, (state.stageSubPage + 1) * pageSize);

  const stagePagerWrap = document.getElementById("stage-subpager-wrap");
  if (stagePagerWrap) {
    stagePagerWrap.classList.toggle("hidden", totalStagePages <= 1);
    const labelEl = document.getElementById("stage-subpager-label");
    if (labelEl) {
      labelEl.textContent = state.stageSubPage === 0 ? "Días 1–6" : "Días 7–12";
    }
  }

  document.getElementById("stage-pedagogy-title").textContent = `${stSummary.title} · ${doneInStage}/${daysInStage.length} rezados`;
  document.getElementById("stage-pedagogy-desc").textContent = `${stSummary.goal} (${stSummary.ref})`;

  const grid = document.getElementById("stage-days-grid");
  grid.innerHTML = visibleDays.map((d) => {
    const dateInfo = computeExactDateForDay(feast, state.selectedYear, d.day);
    const done = !!state.completedDays[d.day];
    return `
      <div class="fine-gold-btn rounded-xl p-2.5 flex flex-col justify-between relative ${done ? "ring-2 ring-[#275625]" : ""}">
        <div class="flex items-center justify-between gap-1">
          <button type="button" data-open-day="${d.day}" class="open-day-trigger text-left font-cinzel font-bold text-xs text-[#7A5612] hover:underline">
            ${d.day === 34 ? "✠ Día 34 · Consagración" : `Día ${d.day} · ${dateInfo.shortLabel}`}
          </button>
          <button type="button" data-quick-check="${d.day}" aria-label="Marcar Día ${d.day} como rezado" title="Marcar o desmarcar este día directamente" class="quick-check-btn w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all ${done ? "bg-[#275625] text-white" : "bg-[#FFFDF9] text-[#5C4422] border border-[#B8913E] hover:bg-[#8E6A1F] hover:text-white"}">
            ${done ? "✓" : "☐"}
          </button>
        </div>
        <button type="button" data-open-day="${d.day}" class="open-day-trigger text-left mt-1">
          <p class="font-garamond font-semibold text-base text-[#22170C] leading-snug line-clamp-2">
            ${d.title}
          </p>
        </button>
      </div>
    `;
  }).join("");

  grid.querySelectorAll(".open-day-trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedDay = parseInt(btn.getAttribute("data-open-day"), 10);
      const dObj = window.DAYS_DATA.find((x) => x.day === state.selectedDay) || window.DAYS_DATA[0];
      state.activePrayerKey = dObj.prayers[0];
      state.daySubTab = dObj.day === 34 ? "formula" : "meditacion";
      renderConsecrationDayView();
      showConsecStep("day");
    });
  });

  grid.querySelectorAll(".quick-check-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dayNum = parseInt(btn.getAttribute("data-quick-check"), 10);
      state.completedDays[dayNum] = !state.completedDays[dayNum];
      persistState();
      renderConsecrationCalendar();
      updateGlobalProgressBadge();
      showToast(state.completedDays[dayNum] ? `✓ Día ${dayNum} marcado como rezado` : `Día ${dayNum} desmarcado`);
    });
  });

  updateGlobalProgressBadge();
}

function renderConsecrationDayView() {
  const feast = window.LITURGICAL_CONSECRATION_FEASTS.find((f) => f.id === state.selectedFeastId) || window.LITURGICAL_CONSECRATION_FEASTS[0];
  const d = window.DAYS_DATA.find((x) => x.day === state.selectedDay) || window.DAYS_DATA[0];
  const dateInfo = computeExactDateForDay(feast, state.selectedYear, d.day);
  const stSummary = window.STAGE_SUMMARIES[d.stage] || window.STAGE_SUMMARIES[1];

  const stageBanner = document.getElementById("day-stage-summary-banner");
  if (stageBanner) {
    stageBanner.innerHTML = `<span class="font-cinzel text-[10px] font-bold uppercase tracking-wider text-[#7A5612]">${stSummary.title} (${stSummary.ref}):</span> <span class="italic">${stSummary.goal}</span>`;
  }

  document.getElementById("day-view-date-badge").textContent =
    d.day === 34 ? `✠ DÍA 34 · ${dateInfo.shortLabel}` : `DÍA ${d.day} DE 33 · ${dateInfo.shortLabel}`;
  document.getElementById("day-view-title").textContent = d.title;
  document.getElementById("day-view-source").textContent = d.source;
  document.getElementById("day-view-reading").innerHTML = d.text;
  document.getElementById("day-view-practice").textContent = `Práctica espiritual: ${d.practice}`;
  document.getElementById("day-view-jaculatoria").textContent = d.jaculatoria;
  document.getElementById("consec-left-caption").textContent = d.jaculatoria;

  syncUserNameAndPlaceEverywhere();

  const day34Callout = document.getElementById("day-34-prominent-cta");
  if (day34Callout) {
    day34Callout.classList.toggle("hidden", d.day !== 34);
  }

  const isDone = !!state.completedDays[d.day];
  const doneBtn = document.getElementById("btn-toggle-day-done");
  doneBtn.textContent = isDone ? "✓ Día Rezado" : "☐ Marcar Rezado";
  doneBtn.setAttribute("aria-pressed", String(isDone));
  doneBtn.className = isDone
    ? "day-completed-btn px-3 py-1.5 rounded-full font-cinzel text-xs font-bold shrink-0 shadow"
    : "fine-gold-btn px-3 py-1.5 rounded-full font-cinzel text-xs font-bold shrink-0";

  ["meditacion", "oraciones", "formula"].forEach((k) => {
    document.getElementById(`day-subview-${k}`).classList.toggle("hidden", state.daySubTab !== k);
  });
  document.querySelectorAll(".day-subtab-btn").forEach((btn) => {
    const k = btn.getAttribute("data-day-subtab");
    const active = k === state.daySubTab;
    btn.setAttribute("aria-selected", String(active));
    btn.className = `day-subtab-btn py-1.5 px-2 rounded-xl font-cinzel text-xs font-semibold transition-all ${active ? "fine-gold-active" : "fine-gold-btn"}`;
  });

  if (!d.prayers.includes(state.activePrayerKey)) {
    state.activePrayerKey = d.prayers[0];
  }
  const pTabs = document.getElementById("prayer-selector-tabs");
  pTabs.innerHTML = d.prayers.map((pKey) => {
    const p = window.PRAYERS[pKey];
    return `
      <button type="button" data-prayer-key="${pKey}" class="prayer-key-btn px-2.5 py-1 rounded-lg font-cinzel text-xs font-bold transition-all ${pKey === state.activePrayerKey ? "fine-gold-active" : "fine-gold-btn"}">
        ${p.shortName}
      </button>
    `;
  }).join("");

  pTabs.querySelectorAll(".prayer-key-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activePrayerKey = btn.getAttribute("data-prayer-key");
      renderConsecrationDayView();
    });
  });

  const activePrayer = window.PRAYERS[state.activePrayerKey] || window.PRAYERS.aveMarisStella;
  document.getElementById("active-prayer-title").textContent = activePrayer.title;
  document.getElementById("active-prayer-body").textContent =
    state.prayerLang === "la" ? activePrayer.la : activePrayer.es;

  document.getElementById("lang-pill-es").className =
    state.prayerLang === "es"
      ? "px-2.5 py-0.5 rounded text-xs font-cinzel font-bold bg-[#7A5612] text-white"
      : "px-2.5 py-0.5 rounded text-xs font-cinzel font-bold text-[#5C4422]";
  document.getElementById("lang-pill-la").className =
    state.prayerLang === "la"
      ? "px-2.5 py-0.5 rounded text-xs font-cinzel font-bold bg-[#7A5612] text-white"
      : "px-2.5 py-0.5 rounded text-xs font-cinzel font-bold text-[#5C4422]";

  updateGlobalProgressBadge();
}

function showConsecStep(stepName) {
  state.consecStep = stepName;
  ["select", "calendar", "day"].forEach((s) => {
    document.getElementById(`consec-step-${s}`).classList.toggle("hidden", s !== stepName);
  });
}

// ============================================================================
// 2. RENDERIZADO DE DOGMAS (RECTÁNGULOS GRANDES Y LEGIBLES)
// ============================================================================
function renderDogmasScreen() {
  const isList = state.dogmaSubView === "list";
  document.getElementById("dogmas-view-list").classList.toggle("hidden", !isList);
  document.getElementById("dogmas-view-detail").classList.toggle("hidden", isList);

  const listEl = document.getElementById("dogmas-gold-buttons");
  listEl.innerHTML = window.MARIAN_DOGMAS.map((d, idx) => `
    <button type="button" data-dogma-id="${d.id}" class="dogma-item-btn fine-gold-btn flex-1 w-full py-3 px-4 rounded-2xl text-left flex items-center justify-between gap-3">
      <div class="flex items-center gap-3.5 min-w-0">
        <span class="gold-medallion-badge w-10 h-10 rounded-full font-cinzel font-bold text-sm flex items-center justify-center shrink-0">
          ${ROMAN_NUMS[idx] || idx + 1}
        </span>
        <div class="min-w-0">
          <span class="btn-title-scalable font-cinzel font-bold text-[#22170C] block">
            ${d.title}
          </span>
        </div>
      </div>
      <span class="font-cinzel text-xl font-bold text-[#7A5612] shrink-0">›</span>
    </button>
  `).join("");

  listEl.querySelectorAll(".dogma-item-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedDogmaId = btn.getAttribute("data-dogma-id");
      state.dogmaTab = "declaracion";
      state.dogmaSubView = "detail";
      renderDogmasScreen();
    });
  });

  const d = window.MARIAN_DOGMAS.find((x) => x.id === state.selectedDogmaId) || window.MARIAN_DOGMAS[0];
  document.getElementById("dogma-badge").textContent = d.badge;
  document.getElementById("dogma-title").textContent = d.title;
  document.getElementById("dogma-declarer-text").textContent = d.declarer;
  document.getElementById("dogma-formula-text").textContent = d.formula;
  document.getElementById("dogma-latin-text").textContent = d.latin;
  document.getElementById("dogma-theology-text").innerHTML = d.theology;
  document.getElementById("dogma-feast-pill").textContent = d.feast;
  document.getElementById("dogma-prayer-text").textContent = d.prayer;

  ["declaracion", "teologia", "oracion"].forEach((k) => {
    document.getElementById(`dogma-panel-${k}`).classList.toggle("hidden", state.dogmaTab !== k);
  });
  document.querySelectorAll(".dogma-tab-btn").forEach((btn) => {
    const k = btn.getAttribute("data-dogma-tab");
    const active = k === state.dogmaTab;
    btn.setAttribute("aria-selected", String(active));
    btn.className = `dogma-tab-btn py-1.5 px-2 rounded-xl font-cinzel text-xs font-semibold transition-all ${active ? "fine-gold-active" : "fine-gold-btn"}`;
  });
}

// ============================================================================
// 3. RENDERIZADO DE LAS 36 ADVOCACIONES (RECTÁNGULOS GRANDES CON SOLO EL NOMBRE)
// ============================================================================
function getSortedAndFilteredAdvocations() {
  const q = normalizeText(state.advSearch.trim());
  const filtered = window.MARIAN_ADVOCATIONS.filter((a) => {
    if (!q) return true;
    const haystack = normalizeText(`${a.name} ${a.place} ${a.yearDisplay} ${a.keywords || ""} ${a.approval}`);
    return haystack.includes(q);
  });

  filtered.sort((a, b) =>
    state.advSortOrder === "asc" ? a.yearNumeric - b.yearNumeric : b.yearNumeric - a.yearNumeric
  );
  return filtered;
}

function resolveAdvImage(adv) {
  if (!adv || !adv.img) return window.makeSacredFallbackSvg("Santa María", "Ora pro nobis");
  if (window.INLINE_ASSET_MAP && window.INLINE_ASSET_MAP[adv.img]) {
    return window.INLINE_ASSET_MAP[adv.img];
  }
  return adv.img;
}

function renderAdvocacionesScreen() {
  const isList = state.advSubView === "list";
  document.getElementById("adv-view-list").classList.toggle("hidden", !isList);
  document.getElementById("adv-view-detail").classList.toggle("hidden", isList);

  const sortBtn = document.getElementById("btn-adv-sort-order");
  if (sortBtn) {
    sortBtn.textContent = state.advSortOrder === "asc"
      ? "✦ Orden: Antiguas → Recientes"
      : "✦ Orden: Recientes → Antiguas";
  }

  const filtered = getSortedAndFilteredAdvocations();
  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (state.advPage >= totalPages) state.advPage = 0;

  const slice = filtered.slice(state.advPage * pageSize, (state.advPage + 1) * pageSize);
  const gridEl = document.getElementById("adv-gold-buttons-page");

  if (slice.length === 0) {
    gridEl.innerHTML = `<div class="col-span-2 p-6 text-center font-garamond italic text-lg text-[#5C4422] marian-reliquary-card rounded-2xl">No se encontraron advocaciones con esa palabra clave.</div>`;
  } else {
    gridEl.innerHTML = slice.map((a) => `
      <button type="button" data-adv-num="${a.num}" class="adv-item-btn fine-gold-btn min-h-[3.5rem] sm:min-h-[4.25rem] py-3 px-4 rounded-2xl text-left flex items-center justify-between gap-3">
        <span class="btn-title-scalable font-cinzel font-bold text-[#22170C]">
          ${a.name}
        </span>
        <span class="font-cinzel font-bold text-xl text-[#7A5612] shrink-0">›</span>
      </button>
    `).join("");
  }

  document.getElementById("adv-page-indicator").textContent = `${state.advPage + 1} / ${totalPages}`;

  gridEl.querySelectorAll(".adv-item-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedAdvNum = parseInt(btn.getAttribute("data-adv-num"), 10);
      state.advTab = "historia";
      state.advSubView = "detail";
      renderAdvocacionesScreen();
    });
  });

  const a = window.MARIAN_ADVOCATIONS.find((x) => x.num === state.selectedAdvNum) || window.MARIAN_ADVOCATIONS[0];
  const leftImg = document.getElementById("adv-left-showcase-img");
  const mobileThumb = document.getElementById("adv-mobile-thumb");
  const fallbackSvg = window.makeSacredFallbackSvg(a.name, a.yearDisplay);

  if (isList) {
    const defaultAdvoImg = (window.INLINE_ASSET_MAP && window.INLINE_ASSET_MAP["assets/img/advocaciones.webp"]) || "assets/img/advocaciones.webp";
    leftImg.src = defaultAdvoImg;
    document.getElementById("adv-left-showcase-caption").textContent = "36 Advocaciones Tradicionales de María Santísima ordenadas cronológicamente (40 d.C. – 1942)";
  } else {
    const srcUrl = resolveAdvImage(a);
    leftImg.onerror = function() { this.onerror = null; this.src = fallbackSvg; };
    mobileThumb.onerror = function() { this.onerror = null; this.src = fallbackSvg; };
    leftImg.src = srcUrl;
    mobileThumb.src = srcUrl;
    document.getElementById("adv-left-showcase-caption").textContent = `${a.name} (${a.yearDisplay}) — Pulsa la imagen para ampliar`;
  }

  document.getElementById("adv-detail-place-badge").textContent = `${a.yearDisplay} · ${a.place}`;
  document.getElementById("adv-detail-name").textContent = a.name;
  document.getElementById("adv-approval-line").textContent = a.approval;
  document.getElementById("adv-history-body").innerHTML = a.history;
  document.getElementById("adv-miracles-body").textContent = a.miracles;
  document.getElementById("adv-prayer-body").textContent = a.prayer;

  ["historia", "milagros", "oracion"].forEach((k) => {
    document.getElementById(`adv-panel-${k}`).classList.toggle("hidden", state.advTab !== k);
  });
  document.querySelectorAll(".adv-tab-btn").forEach((btn) => {
    const k = btn.getAttribute("data-adv-tab");
    const active = k === state.advTab;
    btn.setAttribute("aria-selected", String(active));
    btn.className = `adv-tab-btn py-1.5 px-2 rounded-xl font-cinzel text-xs font-semibold transition-all ${active ? "fine-gold-active" : "fine-gold-btn"}`;
  });
}

// Lightbox de contemplación de imagen
function openImageLightbox() {
  const a = window.MARIAN_ADVOCATIONS.find((x) => x.num === state.selectedAdvNum) || window.MARIAN_ADVOCATIONS[0];
  const modal = document.getElementById("modal-lightbox");
  const img = document.getElementById("lightbox-img");
  const cap = document.getElementById("lightbox-caption");
  const fallbackSvg = window.makeSacredFallbackSvg(a.name, a.yearDisplay);
  img.onerror = function() { this.onerror = null; this.src = fallbackSvg; };
  img.src = resolveAdvImage(a);
  cap.textContent = `${a.name} — ${a.place} (${a.approval})`;
  modal.classList.remove("hidden");
}

// ============================================================================
// 4. LIENZO (<canvas>) DE FIRMA DIGITAL CON AMPLIAR, REINTENTAR Y DESHACER
// ============================================================================
function redrawCanvasStrokes() {
  const canvas = document.getElementById("signature-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#22170C";

  state.sigStrokes.forEach((stroke) => {
    if (!stroke.length) return;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x, stroke[i].y);
    }
    ctx.stroke();
  });
}

function initSignaturePad() {
  const canvas = document.getElementById("signature-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let drawing = false;
  let currentPath = [];

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.round(((clientX - rect.left) / rect.width) * canvas.width),
      y: Math.round(((clientY - rect.top) / rect.height) * canvas.height)
    };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    const p = getPos(e);
    currentPath = [p];
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function moveDraw(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    currentPath.push(p);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#22170C";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function endDraw() {
    if (!drawing) return;
    drawing = false;
    if (currentPath.length > 1) {
      state.sigStrokes.push(currentPath);
    }
    exportSignatureToBase64AndSvg();
  }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", moveDraw);
  window.addEventListener("mouseup", endDraw);
  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", moveDraw, { passive: false });
  canvas.addEventListener("touchend", endDraw);

  const expandBtn = document.getElementById("btn-expand-signature");
  if (expandBtn) {
    expandBtn.addEventListener("click", () => {
      state.sigExpanded = !state.sigExpanded;
      canvas.classList.toggle("signature-pad-expanded", state.sigExpanded);
      expandBtn.textContent = state.sigExpanded ? "🗕 Tamaño Normal" : "⛶ Ampliar Cuadro de Firma";
      expandBtn.className = state.sigExpanded
        ? "fine-gold-active px-3 py-1 rounded-lg font-cinzel text-xs font-bold"
        : "fine-gold-btn px-3 py-1 rounded-lg font-cinzel text-xs font-bold";
      redrawCanvasStrokes();
    });
  }

  const undoBtn = document.getElementById("btn-undo-signature");
  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      if (state.sigStrokes.length === 0) return;
      state.sigStrokes.pop();
      redrawCanvasStrokes();
      if (state.sigStrokes.length === 0) {
        state.signatureDataUrl = "";
        state.signatureSvg = "";
        persistState();
        renderCertificatePreview();
      } else {
        exportSignatureToBase64AndSvg();
      }
      showToast("↶ Último trazo deshecho");
    });
  }

  document.getElementById("btn-clear-signature").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.sigStrokes = [];
    state.signatureDataUrl = "";
    state.signatureSvg = "";
    persistState();
    renderCertificatePreview();
    showToast("↺ Cuadro limpio: puedes volver a firmar");
  });

  document.getElementById("btn-download-sig-svg").addEventListener("click", () => {
    if (!state.signatureSvg) {
      showToast("Traza primero tu firma en el recuadro");
      return;
    }
    const blob = new Blob([state.signatureSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "firma_consagracion_totus_tuus.svg";
    a.click();
    URL.revokeObjectURL(url);
  });
}

function exportSignatureToBase64AndSvg() {
  const canvas = document.getElementById("signature-canvas");
  if (!canvas) return;
  state.signatureDataUrl = canvas.toDataURL("image/png");

  const pathStrings = state.sigStrokes.map((stroke) => {
    const d = stroke.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");
    return `<path d="${d}" fill="none" stroke="#22170C" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  state.signatureSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width} ${canvas.height}" width="${canvas.width}" height="${canvas.height}">${pathStrings.join("")}</svg>`;

  persistState();
  renderCertificatePreview();
}

function renderCertificatePreview() {
  const feast = window.LITURGICAL_CONSECRATION_FEASTS.find((f) => f.id === state.selectedFeastId) || window.LITURGICAL_CONSECRATION_FEASTS[0];
  const day34Info = computeExactDateForDay(feast, state.selectedYear, 34);
  const nameTxt = state.userName.trim() || "____________________________________";
  const placeTxt = state.userPlace.trim() || "________________________";
  const sigBlock = state.signatureDataUrl
    ? `<img src="${state.signatureDataUrl}" alt="Firma digital del consagrado" class="h-14 mx-auto object-contain mb-1" />`
    : `<div class="h-12"></div>`;

  const html = `
    <div class="text-center border-b border-[#C49E50] pb-3 mb-3">
      <p class="font-cinzel text-[11px] uppercase tracking-[0.25em] text-[#7A5612]">✠ Totus Tuus · Ad Iesum per Mariam ✠</p>
      <h2 class="font-cinzel font-bold text-base sm:text-lg text-[#22170C] mt-1">
        CONSAGRACIÓN DE SÍ MISMO A JESUCRISTO, LA SABIDURÍA ENCARNADA, POR MEDIO DE MARÍA
      </h2>
      <p class="font-garamond italic text-sm text-[#5C4422]">
        Fórmula oficial de San Luis María Grignion de Montfort (TVD, nn. 227–233) · ${feast.title}
      </p>
    </div>
    <div class="font-garamond text-base leading-relaxed text-justify space-y-2 text-[#22170C]">
      <p>¡Oh Sabiduría eterna y encarnada! ¡Oh amable y adorable Jesús, verdadero Dios y verdadero Hombre, Hijo único del Padre Eterno y de María, siempre Virgen! Os adoro profundamente en el seno y en los esplendores de vuestro Padre, durante la eternidad, y en el seno virginal de María, vuestra dignísima Madre, en el tiempo de vuestra Encarnación.</p>
      <p>Por esto he recurrido a la intercesión de vuestra Santísima Madre, que Vos me habéis dado como Mediadora ante Vos, y por este medio espero obtener de Vos la contrición y el perdón de mis pecados, la adquisición y la conservación de la Sabiduría.</p>
      <p>Yo, <strong class="text-[#7A5612] underline decoration-[#C8A96A]">${nameTxt}</strong>, pecador infiel, renuevo y ratifico hoy en vuestras manos los votos de mi Bautismo. Renuncio para siempre a Satanás, a sus pompas y a sus obras, y me entrego enteramente a Jesucristo, la Sabiduría encarnada, para llevar mi cruz tras Él todos los días de mi vida; y a fin de que le sea más fiel de lo que he sido hasta ahora, os escojo hoy, ¡oh María!, en presencia de toda la corte celestial, por mi Madre y Señora.</p>
      <p>Os entrego y consagro, en calidad de esclavo, mi cuerpo y mi alma, mis bienes interiores y exteriores, y aun el valor de mis buenas acciones pasadas, presentes y futuras, otorgándoos entero y pleno derecho de disponer de mí y de todo lo que me pertenece, sin excepción, a vuestro agrado, a la mayor gloria de Dios, en el tiempo y en la eternidad.</p>
      <p>¡Oh Virgen fiel!, hacedme en todo tan perfecto discípulo, imitador y esclavo de la Sabiduría encarnada, Jesucristo, vuestro Hijo, que por vuestra intercesión y a ejemplo vuestro llegue a la plenitud de su edad sobre la tierra y de su gloria en los cielos. Así sea.</p>
    </div>
    <div class="pt-4 mt-4 border-t border-[#C49E50] grid grid-cols-1 sm:grid-cols-2 items-end gap-4 font-garamond text-sm">
      <div>
        <p><strong>Lugar y Fecha:</strong> ${placeTxt}, ${day34Info.fullLabel}</p>
        <p class="text-xs italic text-[#5C4422]">Tributo anual prometido (TVD, n. 231): ${state.userTribute}</p>
      </div>
      <div class="text-center">
        ${sigBlock}
        <div class="border-t border-[#22170C] pt-1 font-cinzel text-[11px]">Firma de ${state.userName.trim() || "esclavo de amor de Jesús por María"}</div>
      </div>
    </div>
  `;
  document.getElementById("cert-preview-container").innerHTML = html;
  document.getElementById("print-only-sheet").innerHTML = html;
}

// ============================================================================
// 5. INICIALIZACIÓN, AVISO SEMANAL DEL APOSTOLADO Y MENÚ HAMBURGUESA
// ============================================================================
window.addEventListener("DOMContentLoaded", async () => {
  detectDevice();
  window.addEventListener("resize", detectDevice);

  if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  if (window.TotusStorage) {
    const saved = await window.TotusStorage.load();
    if (saved) {
      if (saved.selectedYear) state.selectedYear = saved.selectedYear;
      if (saved.selectedFeastId) state.selectedFeastId = saved.selectedFeastId;
      if (saved.completedDays) state.completedDays = saved.completedDays;
      if (saved.userName) state.userName = saved.userName;
      if (saved.userPlace) state.userPlace = saved.userPlace;
      if (typeof saved.reminderEnabled === "boolean") state.reminderEnabled = saved.reminderEnabled;
      if (saved.reminderTime) state.reminderTime = saved.reminderTime;
      if (saved.lastApostoladoShownAt) state.lastApostoladoShownAt = saved.lastApostoladoShownAt;
      if (saved.signatureDataUrl) state.signatureDataUrl = saved.signatureDataUrl;
      if (saved.signatureSvg) state.signatureSvg = saved.signatureSvg;
      if (saved.advSortOrder) state.advSortOrder = saved.advSortOrder;
      if (saved.fontSizeScale) state.fontSizeScale = saved.fontSizeScale;
      if (saved.uiLang) state.uiLang = saved.uiLang;
    }
  }

  applyFontScaleAndLang();
  syncUserNameAndPlaceEverywhere();
  setupDailyReminderScheduler();
  checkWeeklyApostoladoDisplay();

  // Botón de colapso instantáneo (0.25ms) de la pestaña semanal del Apostolado
  const closeApostoladoBtn = document.getElementById("btn-close-apostolado-tab");
  if (closeApostoladoBtn) {
    closeApostoladoBtn.addEventListener("click", closeApostoladoTabInstant);
  }
  const openApostoladoFromSettingsBtn = document.getElementById("btn-settings-show-apostolado");
  if (openApostoladoFromSettingsBtn) {
    openApostoladoFromSettingsBtn.addEventListener("click", () => {
      document.getElementById("modal-settings-menu").classList.add("hidden");
      openApostoladoTab();
    });
  }

  // Menú Hamburguesa de Configuraciones (esquina superior derecha)
  const settingsModal = document.getElementById("modal-settings-menu");
  document.querySelectorAll(".btn-open-hamburger").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderReminderControls();
      applyFontScaleAndLang();
      settingsModal.classList.remove("hidden");
    });
  });
  document.getElementById("btn-close-settings-menu").addEventListener("click", () => {
    settingsModal.classList.add("hidden");
  });

  const resetFontBtn = document.getElementById("btn-font-reset");
  if (resetFontBtn) {
    resetFontBtn.addEventListener("click", () => {
      state.fontSizeScale = 1.05;
      applyFontScaleAndLang();
      persistState();
      showToast("Tamaño de lectura restablecido (105%)");
    });
  }

  // Botones de la Pantalla de Inicio
  document.getElementById("home-btn-consagracion").addEventListener("click", () => {
    showConsecStep("select");
    renderYearAndFeastSelectors();
    switchScreen("consagracion");
  });
  document.getElementById("home-btn-dogmas").addEventListener("click", () => {
    state.dogmaSubView = "list";
    renderDogmasScreen();
    switchScreen("dogmas");
  });
  document.getElementById("home-btn-advocaciones").addEventListener("click", () => {
    state.advSubView = "list";
    renderAdvocacionesScreen();
    switchScreen("advocaciones");
  });

  document.querySelectorAll("[data-nav='home']").forEach((btn) => {
    btn.addEventListener("click", () => {
      settingsModal.classList.add("hidden");
      switchScreen("home");
    });
  });

  // Controles de tamaño de fuente (A- / A+) dentro del Menú Hamburguesa
  document.querySelectorAll("[data-font-delta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const delta = parseFloat(btn.getAttribute("data-font-delta"));
      state.fontSizeScale = Math.min(1.45, Math.max(0.90, +(state.fontSizeScale + delta).toFixed(2)));
      applyFontScaleAndLang();
      persistState();
      showToast(`Tamaño de lectura: ${Math.round(state.fontSizeScale * 100)}%`);
    });
  });

  const uiLangSelect = document.getElementById("select-ui-lang");
  if (uiLangSelect) {
    uiLangSelect.value = state.uiLang;
    uiLangSelect.addEventListener("change", (e) => {
      state.uiLang = e.target.value;
      applyFontScaleAndLang();
      persistState();
    });
  }

  // Configuración de Recordatorio Diario
  ["input-reminder-time", "settings-reminder-time"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", (e) => {
      state.reminderTime = e.target.value || "20:00";
      persistState();
      renderReminderControls();
      if (state.reminderEnabled) {
        showToast(`✓ Hora de recordatorio actualizada a las ${state.reminderTime}`);
      }
    });
  });

  ["btn-toggle-reminder", "settings-btn-toggle-reminder"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener("click", async () => {
      state.reminderEnabled = !state.reminderEnabled;
      if (state.reminderEnabled && "Notification" in window && Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch (e) {}
      }
      persistState();
      renderReminderControls();
      showToast(
        state.reminderEnabled
          ? `🔔 Recordatorio diario activado para las ${state.reminderTime}`
          : "Recordatorio diario desactivado"
      );
    });
  });

  // Flujo de Consagración
  document.getElementById("select-liturgical-feast").addEventListener("change", (e) => {
    state.selectedFeastId = e.target.value;
    persistState();
    renderYearAndFeastSelectors();
    renderCertificatePreview();
  });
  document.getElementById("btn-enter-33-days").addEventListener("click", () => {
    state.consecStageTab = 1;
    state.stageSubPage = 0;
    renderConsecrationCalendar();
    showConsecStep("calendar");
  });
  document.getElementById("btn-change-feast").addEventListener("click", () => showConsecStep("select"));
  document.getElementById("btn-back-to-feast-select").addEventListener("click", () => showConsecStep("select"));

  document.getElementById("btn-mark-stage-complete").addEventListener("click", () => {
    const daysInStage = window.DAYS_DATA.filter((d) => d.stage === state.consecStageTab);
    const allDone = daysInStage.every((d) => !!state.completedDays[d.day]);
    daysInStage.forEach((d) => {
      state.completedDays[d.day] = !allDone;
    });
    persistState();
    renderConsecrationCalendar();
    showToast(!allDone ? "✓ Etapa marcada como completada" : "Etapa reiniciada");
  });

  document.querySelectorAll(".stage-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.consecStageTab = parseInt(btn.getAttribute("data-stage-tab"), 10);
      state.stageSubPage = 0;
      renderConsecrationCalendar();
    });
  });

  const prevStageSubBtn = document.getElementById("btn-stage-sub-prev");
  const nextStageSubBtn = document.getElementById("btn-stage-sub-next");
  if (prevStageSubBtn && nextStageSubBtn) {
    prevStageSubBtn.addEventListener("click", () => {
      state.stageSubPage = state.stageSubPage === 0 ? 1 : 0;
      renderConsecrationCalendar();
    });
    nextStageSubBtn.addEventListener("click", () => {
      state.stageSubPage = state.stageSubPage === 0 ? 1 : 0;
      renderConsecrationCalendar();
    });
  }

  document.getElementById("btn-back-to-calendar").addEventListener("click", () => {
    renderConsecrationCalendar();
    showConsecStep("calendar");
  });
  document.getElementById("btn-day-prev").addEventListener("click", () => {
    state.selectedDay = state.selectedDay > 1 ? state.selectedDay - 1 : 34;
    renderConsecrationDayView();
  });
  document.getElementById("btn-day-next").addEventListener("click", () => {
    state.selectedDay = state.selectedDay < 34 ? state.selectedDay + 1 : 1;
    renderConsecrationDayView();
  });
  document.getElementById("btn-toggle-day-done").addEventListener("click", () => {
    state.completedDays[state.selectedDay] = !state.completedDays[state.selectedDay];
    persistState();
    renderConsecrationDayView();
    showToast(state.completedDays[state.selectedDay] ? `✓ Día ${state.selectedDay} guardado como rezado` : `Día ${state.selectedDay} desmarcado`);
  });

  document.querySelectorAll(".day-subtab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.daySubTab = btn.getAttribute("data-day-subtab");
      renderConsecrationDayView();
    });
  });

  document.getElementById("lang-pill-es").addEventListener("click", () => {
    state.prayerLang = "es";
    renderConsecrationDayView();
  });
  document.getElementById("lang-pill-la").addEventListener("click", () => {
    state.prayerLang = "la";
    renderConsecrationDayView();
  });

  // Flujo de Dogmas
  document.getElementById("btn-back-to-dogmas-list").addEventListener("click", () => {
    state.dogmaSubView = "list";
    renderDogmasScreen();
  });
  document.querySelectorAll(".dogma-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.dogmaTab = btn.getAttribute("data-dogma-tab");
      renderDogmasScreen();
    });
  });

  // Flujo de Advocaciones
  document.getElementById("input-adv-search").addEventListener("input", (e) => {
    state.advSearch = e.target.value;
    state.advPage = 0;
    renderAdvocacionesScreen();
  });
  document.getElementById("btn-adv-sort-order").addEventListener("click", () => {
    state.advSortOrder = state.advSortOrder === "asc" ? "desc" : "asc";
    state.advPage = 0;
    persistState();
    renderAdvocacionesScreen();
  });
  document.getElementById("btn-adv-prev-page").addEventListener("click", () => {
    const total = Math.max(1, Math.ceil(getSortedAndFilteredAdvocations().length / 6));
    state.advPage = state.advPage > 0 ? state.advPage - 1 : total - 1;
    renderAdvocacionesScreen();
  });
  document.getElementById("btn-adv-next-page").addEventListener("click", () => {
    const total = Math.max(1, Math.ceil(getSortedAndFilteredAdvocations().length / 6));
    state.advPage = state.advPage + 1 < total ? state.advPage + 1 : 0;
    renderAdvocacionesScreen();
  });
  document.getElementById("btn-back-to-adv-list").addEventListener("click", () => {
    state.advSubView = "list";
    renderAdvocacionesScreen();
  });
  document.querySelectorAll(".adv-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.advTab = btn.getAttribute("data-adv-tab");
      renderAdvocacionesScreen();
    });
  });

  // Lightbox Zoom al pulsar la imagen de la Advocación
  document.getElementById("adv-left-showcase-img").addEventListener("click", () => {
    if (state.advSubView === "detail") openImageLightbox();
  });
  document.getElementById("adv-mobile-thumb").addEventListener("click", openImageLightbox);
  document.getElementById("btn-close-lightbox").addEventListener("click", () => {
    document.getElementById("modal-lightbox").classList.add("hidden");
  });

  // Modal de Impresión y Firma Digital
  initSignaturePad();
  const openPrint = () => {
    settingsModal.classList.add("hidden");
    syncUserNameAndPlaceEverywhere();
    document.getElementById("modal-print").classList.remove("hidden");
  };
  document.getElementById("btn-settings-open-print").addEventListener("click", openPrint);
  document.getElementById("btn-open-print-from-day").addEventListener("click", openPrint);
  document.getElementById("btn-day34-open-print").addEventListener("click", openPrint);
  document.getElementById("btn-close-print-modal").addEventListener("click", () => {
    document.getElementById("modal-print").classList.add("hidden");
  });

  // Sincronización bidireccional de Nombre Completo y Ciudad
  ["input-cert-name", "input-cert-name-modal"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    ["input", "change", "keyup"].forEach((evName) => {
      el.addEventListener(evName, (e) => {
        state.userName = e.target.value;
        persistState();
        syncUserNameAndPlaceEverywhere();
      });
    });
  });

  ["input-cert-place", "input-cert-place-modal"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    ["input", "change", "keyup"].forEach((evName) => {
      el.addEventListener(evName, (e) => {
        state.userPlace = e.target.value;
        persistState();
        syncUserNameAndPlaceEverywhere();
      });
    });
  });

  document.getElementById("btn-do-print").addEventListener("click", () => {
    syncUserNameAndPlaceEverywhere();
    window.print();
  });

  // Navegación por teclado
  window.addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
    if (e.key === "Escape") {
      document.getElementById("modal-print").classList.add("hidden");
      document.getElementById("modal-lightbox").classList.add("hidden");
      settingsModal.classList.add("hidden");
      closeApostoladoTabInstant();
    } else if (e.key === "ArrowRight") {
      if (state.screen === "consagracion" && state.consecStep === "day") {
        document.getElementById("btn-day-next").click();
      } else if (state.screen === "advocaciones" && state.advSubView === "list") {
        document.getElementById("btn-adv-next-page").click();
      }
    } else if (e.key === "ArrowLeft") {
      if (state.screen === "consagracion" && state.consecStep === "day") {
        document.getElementById("btn-day-prev").click();
      } else if (state.screen === "advocaciones" && state.advSubView === "list") {
        document.getElementById("btn-adv-prev-page").click();
      }
    }
  });

  renderYearAndFeastSelectors();
  renderDogmasScreen();
  renderAdvocacionesScreen();
  renderCertificatePreview();
  updateGlobalProgressBadge();
});
