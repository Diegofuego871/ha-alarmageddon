// Konfiguration › Aktionen: pro Anlage und Alarm (Modus Anwesend, Abwesend, Nacht, "immer aktiv") ein Ablauf als Zeitachse.
// Bausteine: Push-Meldung, Gerät schalten (mit dem, was das Gerät kann), Alarmton, Warten, Szene oder Skript, weitere Aktion
// (jeder Dienst von Home Assistant mit seinen Feldern, kein JSON). Gespeichert werden Schritte im Format des Servers
// (workflow.py); Entwurf mit "Speichern". Schritte lassen sich am Griff ziehen und einzeln testen.

const V = new URL(import.meta.url).search;
const { ic, esc, fmtDur, MODE_ICON, MODE_KEY, errText, onceBtn, paintOnce, runOnce, copyBtn, copyValue } = await import(`./common.js${V}`);
const { MonitorUi } = await import(`./monitor.js${V}`);
const { XferUi } = await import(`./xfer.js${V}`);
const { suggest, applySuffix } = await import(`./healthcheck.js${V}`);
const { isCustom, customList, customName, uploadHtml, uploadError, uploadSound } = await import(`./customsounds.js${V}`);

// ----- Geräte und ihre Aktionen (wie die Routinen in Device Panel): Domäne -> Aktion -> Dienst -----
const COMMON = { on: "turn_on", off: "turn_off", toggle: "toggle" };
const DEVICE = {
  switch: COMMON, light: COMMON, fan: COMMON, input_boolean: COMMON, siren: COMMON, humidifier: COMMON, climate: COMMON, media_player: COMMON,
  cover: { on: "open_cover", off: "close_cover", toggle: "toggle" },
  valve: { on: "open_valve", off: "close_valve", toggle: "toggle" },
  lock: { on: "lock", off: "unlock" },
};
const MIXED = { on: "turn_on", off: "turn_off", toggle: "toggle" }; // gemischte Geräte: homeassistant.turn_on usw.
const ACTION_LABEL = {
  cover: { on: "actOpen", off: "actClose", toggle: "actToggle" },
  valve: { on: "actOpen", off: "actClose", toggle: "actToggle" },
  lock: { on: "actLock", off: "actUnlock" },
};
const ACTION_ICON = { on: "power", off: "powerOff", toggle: "restore" };
const cap = (domain, action) => ACTION_LABEL[domain]?.[action] || { on: "actOn", off: "actOff", toggle: "actToggle" }[action];
const SOUND_LEN = { siren: 4, beep: 3, klaxon: 3, warning: 2, chime: 2 }; // Länge der Töne in Sekunden (wie der Server)
// Drei Arten von Tönen, jede mit eigenen Klängen (1.15.0): Alarmton, Voralarm, Aktivierungston
const SOUND_KEY = {
  siren: "sndSiren", beep: "sndBeep", klaxon: "sndKlaxon", hilo: "sndHilo", yelp: "sndYelp",
  chime: "sndChime", warning: "sndWarning", pre_beep: "sndPreBeep", pre_pulse: "sndPrePulse", pre_rising: "sndPreRising",
  tone_pip: "sndTonePip", tone_double: "sndToneDouble", tone_soft: "sndToneSoft", tone_bell: "sndToneBell", tone_rise: "sndToneRise", tone_confirm: "sndToneConfirm", tone_tick: "sndToneTick",
  off_fall: "sndOffFall", off_confirm: "sndOffConfirm", off_bell: "sndOffBell", off_soft: "sndOffSoft", off_double: "sndOffDouble", // Deaktivierungston (1.27.0)
};
// Vergleich unabhängig von der Schreibweise (1.16.0): Der Server ergänzt beim Speichern Vorgaben und ordnet die Felder anders als das
// Panel. Mit einem Vergleich Zeichen für Zeichen galt ein eben gespeicherter Ablauf nach dem nächsten Laden als geändert ("3 Änderungen",
// obwohl nichts offen war). Verglichen wird darum, was das Panel aus beiden Seiten selbst schreiben würde, mit sortierten Feldern.
const stable = (v) => (Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v);
const canonStep = (step, zone) => {
  try {
    return stable(toStep(fromStep(step), zone));
  } catch (_err) {
    return stable(step);
  }
};
const canon = (list, zone = "main") => JSON.stringify((list || []).map((step) => canonStep(step, zone)));
const canonEnd = (end) => JSON.stringify(stable(normEnd(end)));
// Liste der Klänge in den Daten des Panels, je Schrittart
const TONE_LIST = { sound: "sounds", prealarm: "prealarms", chime: "chimes", dechime: "dechimes" };
const SCENE_DOMAINS = ["scene", "script"];

// Wartet der Ablauf auf das Ende dieses Schritts? Wie der Server (workflow.py step_waits): Schritte, die etwas ausführen (Gerät, Ton),
// laufen standardmässig weiter, der nächste startet sofort; nur mit "wait" wartet der Ablauf. Ältere Abläufe ohne "wait" warteten,
// ausser mit "detach". Ein Ton "bis zum Deaktivieren" (Dauer 0) endet nie von selbst: auf ihn lässt sich nicht warten.
const endless = (step) => step?.type === "sound" && step.duration === 0;
const waits = (step) => (step?.type === "group" ? Boolean(step.wait) && step.mode !== "until_disarmed" : false) || ["action", "sound", "chime", "dechime", "prealarm"].includes(step?.type) && !endless(step) && !step.delay && ("wait" in step ? Boolean(step.wait) : step.type === "prealarm" || (step.type !== "chime" && step.type !== "dechime" && !step.detach));
// Schritte, die nach dem Quittieren möglich sind (keine Alarmmeldung, kein Quittieren)
const AFTER_KINDS = ["device", "sound", "chime", "healthcheck", "wait", "scene", "custom"];
// Schritte beim Scharfschalten (1.14.0): der Aktivierungston statt der Sirene, dazu Gerät, Warten, Szene und eigene Aktion
const ARMED_KINDS = ["chime", "device", "healthcheck", "wait", "scene", "custom"];
// Aktionen beim Deaktivieren (1.27.0): Gerät, Deaktivierungston, Warten, Szene und eigene Aktion; je Modus, der scharf war
const DISARMED_KINDS = ["dechime", "device", "healthcheck", "wait", "scene", "custom"];
// Aktionen bei einem stillen Alarm (1.62.0): dieselben wie beim Scharfschalten (nie eine Sirene); je Auslöser, auch "Immer aktiv"
const REPORT_KINDS = ["chime", "device", "healthcheck", "wait", "scene", "custom"];
// Alarmton und Aktivierungston teilen sich die Felder (Lautsprecher, Ton, Lautstärke, Dauer)
// So viele Schritte hat eine Liste höchstens (wie der Server: MAX_STEPS)
const MAX_STEPS = 40;
// Aktions-Gruppe (1.59.0): Grenzen wie der Server (GROUP_MAX_STEPS, GROUP_MAX_ROUNDS) und was es in einer Gruppe nie gibt (GROUP_EXCLUDED)
const GROUP_MAX_STEPS = 10;
const GROUP_MAX_ROUNDS = 100;
const GROUP_NO = ["acknowledge", "group"];
// Eine Liste ist eine der sechs Listen der Aktionen ("main", "after", "armed" ...) oder die Liste in einer Gruppe: "<Liste>:<Stelle der
// Gruppe>". So gelten Karten, Plus, Fenster, Test und Ziehen für die Schritte einer Gruppe genau wie für die der Liste selbst.
export const baseZone = (zone) => String(zone || "main").split(":")[0];
export const groupIndex = (zone) => (String(zone || "").includes(":") ? Number(String(zone).split(":")[1]) : null);
const inGroup = (zone) => groupIndex(zone) !== null;
// Rückgängig nach einer Zeit (1.37.0): der Gegendienst, wie im Server (UNDO_SERVICES)
const UNDO_SERVICES = { turn_on: "turn_off", turn_off: "turn_on", toggle: "toggle", open_cover: "close_cover", close_cover: "open_cover", open_valve: "close_valve", close_valve: "open_valve", lock: "unlock", unlock: "lock" };
const UNDO_ACTION = { on: "off", off: "on", toggle: "toggle" };
const isTone = (kind) => kind === "sound" || kind === "chime" || kind === "dechime" || kind === "prealarm";
// Lautstärke je Medienplayer (1.16.0): eigene Werte nur, wenn eingeschaltet, mehr als ein Lautsprecher gewählt ist und sie sich unterscheiden
const ownVolumes = (f) => {
  if (!f.setVolume || !f.perVolume || f.targets.length < 2) return null;
  const map = Object.fromEntries(f.targets.map((id) => [id, Number(f.volumes?.[id] ?? f.volume)]));
  return new Set(Object.values(map)).size > 1 ? map : null;
};
// Der gemeinsame Wert, der wirklich gilt: sind die Werte je Medienplayer alle gleich, ist das der gemeinsame Wert (die Karte und das Speichern
// dürfen dann nicht den alten Wert des einfachen Reglers nehmen, der gar nicht mehr zu sehen ist)
const effectiveVolume = (f) => {
  if (f.perVolume && f.targets.length > 1) {
    const values = f.targets.map((id) => Number(f.volumes?.[id] ?? f.volume));
    if (new Set(values).size === 1) return values[0];
  }
  return Number(f.volume);
};
// Voralarm und Aktivierungston haben immer eine Dauer und stellen nichts zurück (anders als der Alarmton)
const isShortTone = (kind) => kind === "chime" || kind === "dechime" || kind === "prealarm";
// Aktionen während der Verzögerungen (1.19.0): "arming" (Scharfschalten beginnt, die Ausgangsverzögerung läuft) und "entry"
// (Eingangsverzögerung läuft, Zeit zum Deaktivieren). Je Modus, nicht für "Immer aktiv" (dort gibt es keine Verzögerung).
const ARMING_KINDS = ["chime", "device", "healthcheck", "wait", "scene", "custom"];
const ENTRY_KINDS = ["chime", "prealarm", "device", "healthcheck", "wait", "scene", "custom"];
const DELAY_ZONES = ["arming", "entry"];
const ZONE_KEY = { main: "wf", after: "after", armed: "armed", arming: "arming", entry: "entry", disarmed: "disarmed", report: "report" };
const ZONE_CLASS = { main: ".ag-wf-main", after: ".ag-wf-after", armed: ".ag-wf-armed", arming: ".ag-wf-arming", entry: ".ag-wf-entry", disarmed: ".ag-wf-disarmed", report: ".ag-wf-report" };

export const KINDS = [
  { kind: "notify", icon: "bell", label: "stepNotify", hint: "stepNotifyHint" },
  // HealthCheck melden (1.77.0): nur anzubieten, wenn ein Dienst eingerichtet ist (openPicker); ein vorhandener Schritt bleibt immer gültig
  { kind: "healthcheck", icon: "heartPulse", label: "stepHealthcheck", hint: "stepHealthcheckHint" },
  { kind: "device", icon: "power", label: "stepDevice", hint: "stepDeviceHint" },
  { kind: "sound", icon: "speaker", label: "stepSound", hint: "stepSoundHint" },
  { kind: "prealarm", icon: "tone", label: "stepPrealarm", hint: "stepPrealarmHint" },
  { kind: "chime", icon: "note", label: "stepChime", hint: "stepChimeHint" },
  { kind: "dechime", icon: "note", label: "stepDechime", hint: "stepDechimeHint" },
  { kind: "wait", icon: "timer", label: "stepWait", hint: "stepWaitHint" },
  { kind: "acknowledge", icon: "check", label: "stepAck", hint: "stepAckHint" },
  { kind: "scene", icon: "script", label: "stepScene", hint: "stepSceneHint" },
  { kind: "custom", icon: "cog", label: "stepCustom", hint: "stepCustomHint" },
  { kind: "group", icon: "repeat", label: "stepGroup", hint: "stepGroupHint" },
];

const OPTION_KEYS = { light: ["brightness_pct", "color_temp_kelvin"], cover: ["position"], climate: ["temperature", "hvac_mode"], fan: ["percentage"] };

// "Alarm endet": die Abschlussmeldung. "notify" sind eigene Werte statt des Standards (nur, wenn eingeschaltet), "send: false" (seit 1.63.0)
// schaltet sie aus wie die anderen festen Meldungen. Ob Geräte zurückkehren, entscheidet allein der Schritt ("Rückgängig").
export function normEnd(value) {
  const v = value && typeof value === "object" ? value : {};
  const out = {};
  if (v.notify?.enabled) out.notify = { enabled: true, title: v.notify.title || "", message: v.notify.message || "", critical: v.notify.critical ?? null, volume: v.notify.volume ?? null, click: v.notify.click || "log", click_path: v.notify.click_path || "", ...(v.notify.targets?.length ? { targets: [...v.notify.targets] } : {}) };
  if (v.send === false) out.send = false;
  return out;
}

// Feste Meldungen im Reiter Aktionen (1.62.0, Entscheid des Nutzers): "Scharf geschaltet", "Deaktiviert", "Eingangsverzögerung" und "Stiller
// Alarm" stehen als festes Element an ihrem Punkt des Ablaufs (wie "Alarm endet"): immer da, anpassen oder ausschalten. Je Anlage und
// Auslöser; im Reiter "Immer aktiv" gibt es nur "Stiller Alarm". Die Werte kommen vom Server immer vollständig (event_notify).
export const NOTICE_KINDS = ["armed", "disarmed", "pending", "sensor_report"];
const NOTICE_DEFAULT = { armed: [false, false], disarmed: [false, false], pending: [false, false], sensor_report: [true, true] };
export const noticeKinds = (trigger) => (trigger === "always" ? ["sensor_report"] : NOTICE_KINDS);
// Platzhalter je Meldung: {person} (wer geschaltet hat) und {delay} (Zeit der Eingangsverzögerung) gibt es nur hier
export const NOTICE_TOKENS = {
  armed: ["{name}", "{mode}", "{person}", "{time}"],
  disarmed: ["{name}", "{mode}", "{person}", "{time}"],
  pending: ["{name}", "{sensor}", "{type}", "{area}", "{delay}", "{mode}", "{time}"],
  sensor_report: ["{name}", "{sensor}", "{type}", "{area}", "{mode}", "{time}"],
};
export function normNotice(kind, value) {
  const v = value && typeof value === "object" ? value : {};
  const [on, critical] = NOTICE_DEFAULT[kind] || [false, false];
  const volume = Number(v.volume);
  const click = ["log", "overview", "custom"].includes(v.click) ? v.click : "overview";
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : on,
    title: String(v.title || "").trim(),
    message: String(v.message || "").trim(),
    critical: typeof v.critical === "boolean" ? v.critical : critical,
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8,
    persistent: v.persistent === true,
    click,
    click_path: click === "custom" ? String(v.click_path || "").trim() : "",
    targets: Array.isArray(v.targets) ? [...v.targets] : [],
  };
}
const normNotices = (map, trigger) => Object.fromEntries(noticeKinds(trigger).map((kind) => [kind, normNotice(kind, map?.[kind])]));
const canonNotices = (map, trigger) => JSON.stringify(stable(normNotices(map, trigger)));

// ----- Schritt des Servers <-> Formular -----

const blank = () => ({ delay: false, kind: "custom", hcId: "", hcSuffix: "", hcTouched: false, hcRepeat: false, hcPause: false, targets: [], ntTargets: null, restore: false, seconds: 30, wait: false, ntTitle: "", ntMessage: "", ntCritical: null, ntVolume: null, ntButtons: {}, ntClick: null, ntClickPath: "", until: false, playSeconds: 30, sound: "siren", setVolume: true, volume: 0.7, repeat: 3, action: "on", opts: {}, optsOn: {}, domain: "", service: "", data: {}, extra: {}, gName: "", gMode: "count", gCount: 3, gSeconds: 60, gSteps: [] });

export function fromStep(step) {
  return { ...fromStepBase(step), wait: waits(step) };
}

function fromStepBase(step) {
  const f = blank();
  if (step.type === "notify") return { ...f, kind: "notify", ntTitle: step.title || "", ntMessage: step.message || "", ntCritical: step.critical ?? null, ntVolume: step.volume ?? null, ntButtons: { ...(step.buttons || {}) }, ntClick: step.click ?? null, ntClickPath: step.click_path || "", ntTargets: step.targets?.length ? [...step.targets] : null };
  if (step.type === "healthcheck") return { ...f, kind: "healthcheck", hcId: String(step.check_id || ""), hcSuffix: String(step.suffix || ""), hcTouched: true, hcRepeat: step.repeat === true, hcPause: step.pause === true };
  if (step.type === "wait") return { ...f, kind: "wait", seconds: step.seconds };
  if (step.type === "acknowledge") return { ...f, kind: "acknowledge" };
  if (step.type === "group") return { ...f, kind: "group", gName: step.name || "", gMode: ["count", "duration", "until_disarmed"].includes(step.mode) ? step.mode : "count", gCount: step.count ?? 2, gSeconds: step.seconds ?? 60, gSteps: Array.isArray(step.steps) ? step.steps : [] };
  if (isTone(step.type)) Object.assign(f, { perVolume: Object.keys(step.volumes || {}).length > 0, volumes: { ...(step.volumes || {}) } });
  if (step.type === "chime") {
    return { ...f, delay: !!step.delay, kind: "chime", targets: [...(step.players || [])], sound: step.sound || "tone_pip", setVolume: step.volume != null, volume: step.volume ?? 0.5, until: false, playSeconds: step.duration || 3, restore: step.restore !== false };
  }
  if (step.type === "dechime") {
    return { ...f, kind: "dechime", targets: [...(step.players || [])], sound: step.sound || "off_fall", setVolume: step.volume != null, volume: step.volume ?? 0.5, until: false, playSeconds: step.duration || 3, restore: step.restore !== false };
  }
  if (step.type === "prealarm") {
    return { ...f, delay: !!step.delay, kind: "prealarm", targets: [...(step.players || [])], sound: step.sound || "pre_beep", setVolume: step.volume != null, volume: step.volume ?? 0.3, until: false, playSeconds: step.duration || 20, restore: step.restore !== false };
  }
  if (step.type === "sound") {
    return { ...f, kind: "sound", targets: [...step.players], sound: step.sound, setVolume: step.volume != null, volume: step.volume ?? 0.7, repeat: step.repeat || 1, until: step.duration === 0, playSeconds: step.duration ? step.duration : Math.max(5, (step.repeat || 1) * (SOUND_LEN[step.sound] || 4)), restore: step.restore !== false };
  }
  const action = String(step.action || "");
  const [domain, service] = action.split(".");
  const data = { ...(step.data || {}) };
  const keys = Object.keys(data);
  const base = { ...f, targets: [...(step.target || [])], restore: !!step.restore, domain, service, undoOn: step.undo_after != null, undoSeconds: step.undo_after || 60 };
  if ((action === "scene.turn_on" || action === "script.turn_on") && !keys.length) return { ...base, kind: "scene" };
  const act = DEVICE[domain] && Object.keys(DEVICE[domain]).find((a) => DEVICE[domain][a] === service);
  if (act && !keys.length) return { ...base, kind: "device", action: act };
  const mixed = domain === "homeassistant" && Object.keys(MIXED).find((a) => MIXED[a] === service);
  if (mixed && !keys.length) return { ...base, kind: "device", action: mixed };
  // Einstellungen, die ein Gerät kann (ein Dienstaufruf genügt)
  const only = (allowed) => keys.length > 0 && keys.every((k) => allowed.includes(k));
  const withOpts = (optData) => ({ ...base, kind: "device", action: "on", opts: optData, optsOn: Object.fromEntries(Object.keys(optData).map((k) => [k, true])) });
  if (domain === "light" && service === "turn_on" && only(OPTION_KEYS.light)) return withOpts(data);
  if (domain === "fan" && service === "turn_on" && only(OPTION_KEYS.fan)) return withOpts(data);
  if (domain === "cover" && service === "set_cover_position" && only(["position"])) return withOpts(data);
  if (domain === "climate" && service === "set_temperature" && only(["temperature", "hvac_mode"])) return withOpts(data);
  return { ...base, kind: "custom", data };
}

export function toStep(f, path = "main") {
  const zone = baseZone(path); // die Regeln der Liste gelten auch in ihren Gruppen
  const step = toStepBase(f);
  // "HealthCheck melden": Wiederholen und Pausieren gibt es nur im Ablauf des Alarms; dort immer mit Angabe geschrieben (ein älterer Schritt ohne sie tut beides nicht)
  if (step.type === "healthcheck" && zone === "main") Object.assign(step, { repeat: Boolean(f.hcRepeat), pause: Boolean(f.hcPause) });
  if (step.type === "group") {
    // "Bis deaktiviert" gibt es nur im Ablauf des Alarms (nur dort deaktiviert oder quittiert jemand) und wartet nie; die Schritte der
    // Gruppe werden wie die der Liste geschrieben
    if (zone !== "main" && step.mode === "until_disarmed") step.mode = "count";
    step.wait = Boolean(f.wait) && step.mode !== "until_disarmed";
    step.steps = (f.gSteps || []).filter((inner) => !GROUP_NO.includes(inner?.type)).map((inner) => toStep(fromStep(inner), `${zone}:0`));
    return step;
  }
  const volumes = isTone(f.kind) ? ownVolumes(f) : null;
  if (volumes) step.volumes = volumes;
  // Schritte, die etwas ausführen, laufen standardmässig weiter; "wait" hält den nächsten Schritt zurück, bis dieser fertig ist
  // (nie bei einem Ton bis zum Deaktivieren). Das Panel schreibt die Angabe immer mit: so ist ein neuer Schritt von einem älteren
  // ohne Angabe (der wartete) zu unterscheiden.
  if (step.type === "action" || step.type === "sound" || step.type === "chime" || step.type === "dechime" || step.type === "prealarm") step.wait = Boolean(f.wait) && !(f.kind === "sound" && f.until);
  if (DELAY_ZONES.includes(zone) && f.delay && (step.type === "chime" || step.type === "prealarm")) {
    // So lange wie die laufende Verzögerung (1.19.0): die Dauer ist die Restzeit, der Ablauf wartet nie auf diesen Ton
    step.delay = true;
    step.wait = false;
  }
  if (zone !== "main") {
    // Nach dem Quittieren: kein Gerät kehrt mehr zurück, und ein Ton braucht eine Dauer (niemand deaktiviert danach). Bei Tönen
    // heisst "restore" hier: der Lautsprecher wird nach dem Ton zurückgestellt (1.26.0)
    if (step.type === "action") step.restore = false;
    if (step.type === "sound" && step.duration === 0) step.duration = Math.min(3600, Math.max(1, Math.round(Number(f.playSeconds) || 30)));
  }
  if (inGroup(path)) {
    // In einer Gruppe: kein Ton, der der Verzögerung folgt. "Nach einer Zeit rückgängig machen" bleibt (seit 1.60.0)
    if (step.delay) {
      delete step.delay;
      step.wait = Boolean(f.wait);
    }
  }
  return step;
}

// Leer = Standardtext des Servers (folgt der Sprache); der Editor zeigt den Standard, speichert ihn aber nicht
export const NOTIFY_TOKENS = ["{name}", "{sensor}", "{type}", "{area}", "{time}", "{mode}", "{alarm}"];
// Alarmart je Geräteklasse: dieselbe Zuordnung wie ALARM_KINDS in notify.py (ein Test hält beide gleich)
export const ALARM_KINDS = {
  smoke: "fire", heat: "heat", moisture: "water", gas: "gas", carbon_monoxide: "gas",
  door: "intrusion", window: "intrusion", garage_door: "intrusion", opening: "intrusion", motion: "intrusion",
  occupancy: "intrusion", presence: "intrusion", vibration: "intrusion", glass_break: "intrusion",
};

function toStepBase(f) {
  if (f.kind === "notify") {
    const out = { type: "notify" };
    const title = String(f.ntTitle || "").trim();
    const message = String(f.ntMessage || "").trim();
    if (title) out.title = title;
    if (message) out.message = message;
    if (f.ntCritical !== null && f.ntCritical !== undefined) out.critical = !!f.ntCritical;
    if (f.ntVolume !== null && f.ntVolume !== undefined) out.volume = Math.min(1, Math.max(0, Number(f.ntVolume)));
    if (Object.keys(f.ntButtons || {}).length) out.buttons = { ...f.ntButtons };
    // Eigene Empfänger nur mit mindestens einem Eintrag; ohne gelten die Alarm-Empfänger der Konfiguration
    if (f.ntTargets?.length) out.targets = [...f.ntTargets];
    if (f.ntClick) {
      out.click = f.ntClick;
      if (f.ntClick === "custom") out.click_path = String(f.ntClickPath || "").trim();
    }
    return out;
  }
  if (f.kind === "healthcheck") return { type: "healthcheck", check_id: String(f.hcId || ""), suffix: String(f.hcSuffix || "").trim() };
  if (f.kind === "acknowledge") return { type: "acknowledge" };
  if (f.kind === "group") {
    const name = String(f.gName || "").trim().slice(0, 40);
    return { type: "group", ...(name ? { name } : {}), mode: f.gMode, count: Math.min(GROUP_MAX_ROUNDS, Math.max(1, Math.round(Number(f.gCount) || 1))), seconds: Math.min(3600, Math.max(1, Math.round(Number(f.gSeconds) || 1))) };
  }
  if (f.kind === "wait") return { type: "wait", seconds: Math.max(0, Math.round(Number(f.seconds) || 0)) };
  if (f.kind === "prealarm") {
    return { type: "prealarm", players: f.targets, sound: f.sound, volume: f.setVolume ? effectiveVolume(f) : null, duration: Math.min(600, Math.max(1, Math.round(Number(f.playSeconds) || 20))), restore: f.restore !== false };
  }
  if (f.kind === "dechime") {
    return { type: "dechime", players: f.targets, sound: f.sound, volume: f.setVolume ? effectiveVolume(f) : null, duration: Math.min(300, Math.max(1, Math.round(Number(f.playSeconds) || 3))), restore: f.restore !== false };
  }
  if (f.kind === "chime") {
    return { type: "chime", players: f.targets, sound: f.sound, volume: f.setVolume ? effectiveVolume(f) : null, duration: Math.min(300, Math.max(1, Math.round(Number(f.playSeconds) || 3))), restore: f.restore !== false };
  }
  if (f.kind === "sound") {
    return { type: "sound", players: f.targets, sound: f.sound, volume: f.setVolume ? effectiveVolume(f) : null, duration: f.until ? 0 : Math.min(3600, Math.max(1, Math.round(Number(f.playSeconds) || 1))), restore: !!f.restore };
  }
  if (f.kind === "scene") return { type: "action", action: `${f.targets[0].split(".")[0]}.turn_on`, target: [f.targets[0]], data: {}, restore: false };
  if (f.kind === "device") {
    const domains = [...new Set(f.targets.map((e) => e.split(".")[0]))];
    const single = domains.length === 1 ? domains[0] : null;
    let action = single ? `${single}.${DEVICE[single][f.action]}` : `homeassistant.${MIXED[f.action]}`;
    const data = {};
    if (single && f.action === "on") {
      const on = (k) => f.optsOn[k] && f.opts[k] != null && f.opts[k] !== "";
      if (single === "cover" && on("position")) action = "cover.set_cover_position";
      if (single === "climate" && (on("temperature") || on("hvac_mode"))) action = "climate.set_temperature";
      for (const k of OPTION_KEYS[single] || []) if (on(k)) data[k] = f.opts[k];
    }
    const out = { type: "action", action, target: f.targets, data, restore: !!f.restore };
    // Nach einer Zeit rückgängig machen: nur wo es einen Gegendienst gibt (nicht bei "Position setzen" oder "Temperatur setzen")
    if (f.undoOn && UNDO_SERVICES[action.split(".")[1]]) out.undo_after = Math.min(3600, Math.max(1, Math.round(Number(f.undoSeconds) || 60)));
    return out;
  }
  // Weitere Aktion: nur Werte der Felder, die ausgefüllt sind; unbekannte Werte aus einem früheren Schritt bleiben erhalten
  const data = {};
  for (const [k, v] of Object.entries({ ...f.extra, ...f.data })) if (v !== "" && v != null && !(typeof v === "number" && Number.isNaN(v))) data[k] = v;
  return { type: "action", action: `${f.domain}.${f.service}`, target: f.targets, data, restore: !!f.restore };
}

// ----- Was ein Gerät kann, aus seinem Zustand -----

function deviceOptions(states, targets) {
  const domains = [...new Set(targets.map((e) => e.split(".")[0]))];
  if (domains.length !== 1 || !OPTION_KEYS[domains[0]]) return [];
  const domain = domains[0];
  const sts = targets.map((e) => states[e]).filter(Boolean);
  if (!sts.length || sts.some((s) => s.state === "unavailable")) return [];
  const all = (fn) => sts.every(fn);
  const feats = (s) => Number(s.attributes?.supported_features) || 0;
  const out = [];
  if (domain === "light") {
    const modes = (s) => s.attributes?.supported_color_modes || [];
    if (all((s) => modes(s).some((m) => m !== "onoff"))) out.push({ key: "brightness_pct", type: "percent", label: "optBrightness", min: 1, max: 100 });
    if (all((s) => modes(s).includes("color_temp"))) {
      const lo = Math.max(...sts.map((s) => Number(s.attributes.min_color_temp_kelvin) || 2000));
      const hi = Math.min(...sts.map((s) => Number(s.attributes.max_color_temp_kelvin) || 6500));
      out.push({ key: "color_temp_kelvin", type: "kelvin", label: "optColorTemp", min: lo, max: Math.max(lo, hi), step: 100 });
    }
  } else if (domain === "cover") {
    if (all((s) => feats(s) & 4)) out.push({ key: "position", type: "percent", label: "optPosition", min: 0, max: 100 });
  } else if (domain === "fan") {
    if (all((s) => feats(s) & 1)) out.push({ key: "percentage", type: "percent", label: "optPercentage", min: 1, max: 100 });
  } else if (domain === "climate") {
    if (all((s) => feats(s) & 1)) {
      const lo = Math.max(...sts.map((s) => Number(s.attributes.min_temp) || 7));
      const hi = Math.min(...sts.map((s) => Number(s.attributes.max_temp) || 35));
      out.push({ key: "temperature", type: "temperature", label: "optTemperature", min: lo, max: Math.max(lo, hi), step: Number(sts[0].attributes.target_temp_step) || 0.5 });
    }
    const modes = (sts[0].attributes.hvac_modes || []).filter((m) => sts.every((s) => (s.attributes.hvac_modes || []).includes(m)) && m !== "off");
    if (modes.length) out.push({ key: "hvac_mode", type: "choice", label: "optHvac", values: modes });
  }
  return out;
}

// ----- Felder eines Dienstes von Home Assistant (hass.services) -----

function flatFields(fields, out = {}) {
  for (const [key, value] of Object.entries(fields || {})) {
    if (value && value.selector) out[key] = value;
    else if (value && value.fields) flatFields(value.fields, out);
    else if (value) out[key] = value;
  }
  return out;
}

const selectorType = (field) => Object.keys(field?.selector || {})[0] || "text";
const SIMPLE_SELECTORS = ["boolean", "number", "select", "text", "entity", "color_temp", "duration", "time", "date", "datetime", "icon", "url"];
const normalizeOptions = (opts) => (opts || []).map((o) => (typeof o === "object" ? { value: String(o.value), label: o.label || String(o.value) } : { value: String(o), label: String(o) }));

export class ActionsUi {
  constructor(host) {
    this.host = host;
    this.trigger = host._loadPref("trigger", "away");
    this.phase = ""; // Filter "Phase" der Ansicht (1.81.0): leer = alle
    this.draft = null;
    this.saveState = null;
    this.saving = false;
    this.testSource = null; // was gerade getestet wird: { kind: "all" } oder { kind: "step", zone, index }
    this.edit = null; // { index, insert, form, q, error, open }
    this.drag = null;
    this.mon = new MonitorUi(this); // Reiter "Überwachung" (1.48.0)
    this.xfer = new XferUi(this); // Aktion verschieben oder kopieren (1.85.0)
    this._rev = 0; // zählt jede Änderung der Listen im Entwurf ("Rückgängig" gilt nur, solange nichts anderes geändert wurde)
    this.previewing = null; // URL des Tons, der gerade auf diesem Gerät läuft
    this._comboPointer = false;
  }

  _t(key, vars) {
    return this.host._t(key, vars);
  }

  get system() {
    return this.host._system();
  }

  triggers(s = this.system) {
    // "Immer aktiv" nur, solange es an ist (Anlage › Modi); der gespeicherte Ablauf bleibt erhalten (der Server behält fehlende Auslöser)
    return [...(s?.modes || ["home", "away"]), ...(s?.always_enabled === false ? [] : ["always"])];
  }

  ensureDraft() {
    const s = this.system;
    if (!s) return null;
    if (!this.draft || this.draft.entry !== s.entry_id) {
      const wf = JSON.parse(JSON.stringify(s.workflows || {}));
      const end = { ...(s.workflow_end || {}) };
      const after = JSON.parse(JSON.stringify(s.workflows_after || {})); // Aktionen nach dem Quittieren, je Auslöser wie wf
      const armed = JSON.parse(JSON.stringify(s.workflows_armed || {})); // Aktionen beim Scharfschalten, je Modus (nicht für "Immer aktiv")
      const arming = JSON.parse(JSON.stringify(s.workflows_arming || {})); // Aktionen während der Ausgangsverzögerung (1.19.0)
      const entry = JSON.parse(JSON.stringify(s.workflows_entry || {})); // Aktionen während der Eingangsverzögerung (1.19.0)
      const disarmed = JSON.parse(JSON.stringify(s.workflows_disarmed || {})); // Aktionen beim Deaktivieren, je Modus (1.27.0)
      const report = JSON.parse(JSON.stringify(s.workflows_report || {})); // Aktionen bei einem stillen Alarm, je Auslöser (1.62.0)
      const notices = JSON.parse(JSON.stringify(s.event_notify || {})); // feste Meldungen je Auslöser und Art (1.62.0)
      // Ohne gespeicherte Wahl: an, wenn sich die Abläufe der Modi (oder "Immer aktiv") unterscheiden
      const keys = this.triggers(s);
      const modes = keys.filter((t) => t !== "always");
      const sig = (t) => [canon(wf[t]), canonEnd(end[t]), canon(after[t], "after"), canon(report[t], "report"), canonNotices(notices[t], "always")].join("|");
      const sigArmed = (t) => [canon(armed[t], "armed"), canon(arming[t], "arming"), canon(entry[t], "entry"), canon(disarmed[t], "disarmed"), canonNotices(notices[t], t)].join("|");
      this.draft = { entry: s.entry_id, wf, end, after, armed, arming, entrySteps: entry, disarmed, report, notices, perMode: keys.some((t) => sig(t) !== sig(keys[0])) || modes.some((t) => sigArmed(t) !== sigArmed(modes[0])) };
    }
    // "Überwachung" ist ein eigener Reiter neben den Modi (nur bei eingeschalteter Überwachung, Anlage › Modi)
    if (this.trigger === "monitor" && s.monitor_enabled === true) return this.draft;
    if (!this.triggers(s).includes(this.trigger)) this.trigger = "away";
    // Schalter aus: ein Ablauf für alles, bearbeitet wird der des ersten Reiters
    if (!this.draft.perMode) this.trigger = this.triggers(s)[0];
    return this.draft;
  }

  // Der Stand, der gespeichert würde: ohne "Einstellungen pro Modus" gilt der erste Ablauf für alle Modi und "Immer aktiv"
  _effective(d, s = this.system) {
    if (d.perMode) return { wf: d.wf, end: d.end || {}, after: d.after || {}, armed: d.armed || {}, arming: d.arming || {}, entry: d.entrySteps || {}, disarmed: d.disarmed || {}, report: d.report || {}, notices: d.notices || {} };
    const keys = this.triggers(s);
    const wf = {};
    const end = {};
    const after = {};
    const armed = {};
    const arming = {};
    const entry = {};
    const disarmed = {};
    const report = {};
    const notices = {};
    for (const t of keys) {
      report[t] = JSON.parse(JSON.stringify(d.report?.[keys[0]] || []));
      notices[t] = normNotices(d.notices?.[keys[0]], t); // "Immer aktiv" bekommt nur "Stiller Alarm"
      wf[t] = JSON.parse(JSON.stringify(d.wf[keys[0]] || []));
      end[t] = JSON.parse(JSON.stringify(normEnd(d.end?.[keys[0]])));
      after[t] = JSON.parse(JSON.stringify(d.after?.[keys[0]] || []));
      if (t !== "always") {
        armed[t] = JSON.parse(JSON.stringify(d.armed?.[keys[0]] || []));
        arming[t] = JSON.parse(JSON.stringify(d.arming?.[keys[0]] || []));
        entry[t] = JSON.parse(JSON.stringify(d.entrySteps?.[keys[0]] || []));
        disarmed[t] = JSON.parse(JSON.stringify(d.disarmed?.[keys[0]] || []));
      }
    }
    return { wf, end, after, armed, arming, entry, disarmed, report, notices };
  }

  reset() {
    this.draft = null;
    this.saveState = null;
    this.edit = null;
    this.mon.reset();
  }

  // Schritte des gewählten Auslösers: der Ablauf beim Alarm ("main"), die Aktionen nach dem Quittieren ("after") oder die beim
  // Scharfschalten ("armed")
  steps(zone = "main", trigger = this.trigger) {
    const list = this.ensureDraft()?.[this._draftKey(zone)]?.[trigger] || [];
    const gi = groupIndex(zone);
    if (gi === null) return list;
    return list[gi]?.type === "group" && Array.isArray(list[gi].steps) ? list[gi].steps : [];
  }

  // Schritte einer Liste samt denen ihrer Gruppen: die Grenze des Servers zählt beides (MAX_STEPS)
  _total(zone, trigger = this.trigger) {
    const list = this.steps(baseZone(zone), trigger);
    return list.length + list.reduce((sum, step) => sum + (step?.type === "group" ? (step.steps || []).length : 0), 0);
  }

  // Nimmt die Liste noch `extra` Schritte auf? Eine Gruppe höchstens GROUP_MAX_STEPS, die Liste samt Gruppen höchstens MAX_STEPS
  _full(zone, extra = 1, trigger = this.trigger) {
    return this._total(zone, trigger) + extra > MAX_STEPS || (inGroup(zone) && this.steps(zone, trigger).length + 1 > GROUP_MAX_STEPS);
  }

  // Schlüssel der Liste im Entwurf ("entry" ist schon die Anlage des Entwurfs, darum entrySteps)
  _draftKey(zone) {
    return baseZone(zone) === "entry" ? "entrySteps" : ZONE_KEY[baseZone(zone)] || "wf";
  }

  _setSteps(list, zone = "main", trigger = this.trigger) {
    const d = this.ensureDraft();
    const key = this._draftKey(zone);
    const gi = groupIndex(zone);
    if (gi !== null) {
      // Liste einer Gruppe: die Gruppe in ihrer Liste ersetzen
      const outer = [...(d[key]?.[trigger] || [])];
      if (outer[gi]?.type !== "group") return;
      outer[gi] = { ...outer[gi], steps: list };
      list = outer;
    }
    d[key] = { ...(d[key] || {}), [trigger]: list };
    this._rev += 1;
  }

  // Reiter (Auslöser) mit ungespeicherten Änderungen (für den Punkt am Reiter)
  dirtyTabs() {
    const s = this.system;
    const d = this.draft;
    if (!s || !d || d.entry !== s.entry_id) return [];
    const eff = this._effective(d, s);
    return [...this._changedTriggers(s, eff).map((k) => ["data-trigger", k]), ...(this.mon.dirtyCount() ? [["data-trigger", "monitor"]] : [])];
  }

  // Auslöser (Reiter), deren Entwurf vom gespeicherten Stand abweicht: Ablauf, "Alarm endet", Aktionen danach, beim Scharfschalten
  // und während der beiden Verzögerungen
  _changedTriggers(s, eff) {
    const active = this.triggers(s);
    const keys = new Set([...active, ...Object.keys(s.workflows || {}), ...Object.keys(eff.wf), ...Object.keys(s.workflows_after || {}), ...Object.keys(eff.after || {}),
      ...Object.keys(s.workflows_arming || {}), ...Object.keys(eff.arming || {}), ...Object.keys(s.workflows_entry || {}), ...Object.keys(eff.entry || {}), ...Object.keys(s.workflows_disarmed || {}), ...Object.keys(eff.disarmed || {})]);
    return [...keys].filter((k) => canon((s.workflows || {})[k]) !== canon(eff.wf[k]) || canonEnd((s.workflow_end || {})[k]) !== canonEnd((eff.end || {})[k])
      || canon((s.workflows_after || {})[k], "after") !== canon((eff.after || {})[k], "after") || canon((s.workflows_armed || {})[k], "armed") !== canon((eff.armed || {})[k], "armed")
      || canon((s.workflows_arming || {})[k], "arming") !== canon((eff.arming || {})[k], "arming") || canon((s.workflows_entry || {})[k], "entry") !== canon((eff.entry || {})[k], "entry")
      || canon((s.workflows_disarmed || {})[k], "disarmed") !== canon((eff.disarmed || {})[k], "disarmed")
      // Stiller Alarm und feste Meldungen (1.62.0): nur für die Auslöser, die es gerade gibt (der Server nennt die Meldungen für alle)
      || (active.includes(k) && (canon((s.workflows_report || {})[k], "report") !== canon((eff.report || {})[k], "report") || canonNotices((s.event_notify || {})[k], k) !== canonNotices((eff.notices || {})[k], k))));
  }

  // Ein Entwurf, den die Abfrage nicht verwerfen darf, auch wenn kein Inhalt abweicht: der Nutzer hat "Einstellungen pro Modus"
  // umgestellt. Der Schalter wird nicht gespeichert (er folgt daraus, ob die Abläufe sich unterscheiden), aber bis zum
  // Speichern, Abbrechen oder Verlassen soll er stehen bleiben (1.17.6).
  pinned() {
    return !!this.draft?.touched;
  }

  // Änderungen an den Abläufen der Modi (ohne die Überwachung); der Fuss der Reiter zeigt nur die seiner Seite
  flowDirty() {
    const s = this.system;
    const d = this.draft;
    if (!s || !d || d.entry !== s.entry_id) return 0;
    return this._changedTriggers(s, this._effective(d, s)).length;
  }

  // Alles zusammen: die Abfrage beim Verlassen der Seite darf nichts verwerfen
  dirtyCount() {
    return this.flowDirty() + this.mon.dirtyCount();
  }

  html() {
    return `<div class="ag-wf-head"></div><div class="ag-wf"></div><div class="ag-foot"></div>`;
  }

  render() {
    const h = this.host;
    this.loadTranslations();
    const head = h._view?.querySelector(".ag-wf-head");
    const body = h._view?.querySelector(".ag-wf");
    const s = this.system;
    if (!head || !body || !this.ensureDraft()) return;
    const triggers = this.triggers(s).map((t) => [t, t === "always" ? this._t("wfAlways") : this._t(MODE_KEY[t]), t === "always" ? "flash" : MODE_ICON[t]]);
    const running = s.workflow_running;
    const status = running ? `<span class="ag-tag ${s.workflow_test ? "warn" : "err"}">${esc(this._t(s.workflow_test ? "wfTestRunning" : "wfAlarmRunning"))}</span>` : "";
    const d = this.draft;
    // Reiter "Überwachung" neben den Modi; ohne getrennte Modi stehen nur "Alarm" (ein Ablauf für alles) und "Überwachung" da
    const mon = s.monitor_enabled === true;
    const tabItems = [...(d.perMode ? triggers : mon ? [[triggers[0][0], this._t("wfAlarmTab"), "alert"]] : []), ...(mon ? [["monitor", this._t("wfMonitor"), "eye"]] : [])];
    const tabs = tabItems.length ? h._segHtml("wf-trigger", tabItems, this.trigger, "data-trigger", "small ag-modeseg") : "";
    // Schalter "Einstellungen pro Modus": in jedem Reiter derselbe, an derselben Stelle (seit 1.63.0 auch bei "Überwachung", Wunsch des Nutzers;
    // vorher stand dort ein unsichtbarer Platzhalter). So steht die Reiterzeile in allen Reitern auf derselben Höhe und springt nie.
    const sw = `<div class="ag-pmsw"><button class="ag-toggle ${d.perMode ? "on" : ""}" data-wf="permode" role="switch" aria-checked="${d.perMode}" aria-label="${esc(this._t("wfPerMode"))}"></button>
        <div class="ag-settx"><b>${esc(this._t("wfPerMode"))}</b><small>${esc(this._t(d.perMode ? "wfPerModeOn" : "wfPerModeHint"))}</small></div></div>`;
    if (this.trigger === "monitor" && mon) {
      const monScope = `<div class="ag-pmscope" style="margin:0">${ic("eye", 18)}${esc(this._t("monScope"))}</div>`;
      h._setHtml(head, d.perMode
        ? `<div class="ag-tools"><div class="ag-pmbar" style="flex:1;margin:0">${sw}${tabs}${monScope}</div>${status}</div>`
        : `<div class="ag-tools"><div class="ag-pmbar" style="flex:1;margin:0">${sw}</div>${status}</div>
           <div class="ag-tools" style="margin-top:-4px">${tabs}</div><div class="ag-tools ag-monscope-row">${monScope}</div>`);
      h._setHtml(body, this.mon.bodyHtml());
      h._placePills();
      this.renderFoot();
      return;
    }
    const scope = d.perMode ? `<div class="ag-pmscope" style="margin:0">${ic(this.trigger === "always" ? "flash" : MODE_ICON[this.trigger], 18)}${esc(this._t(this.trigger === "always" ? "pmScopeAlways" : "pmScope", { mode: this._t(MODE_KEY[this.trigger] || "wfAlways") }))}</div>` : "";
    h._setHtml(head, `<div class="ag-tools"><div class="ag-pmbar" style="flex:1;margin:0">${sw}${d.perMode ? tabs : ""}${d.perMode ? scope : ""}</div>${status}</div>
      ${!d.perMode && tabs ? `<div class="ag-tools" style="margin-top:-4px">${tabs}</div>` : ""}
      ${this.trigger === "always" && d.perMode ? `<div class="ag-t2 ag-small" style="margin:-6px 4px 0">${esc(this._t("wfAlwaysHint"))}</div>` : ""}`);
    this._markTabs(head);
    const steps = this.steps();
    // Jede Verbindung zeichnet ihre Linie selbst (zwei Stücke über und unter dem Plus): so liegt sie nie über einem Symbol. Alle
    // Verbindungen sehen gleich aus; ob ein Schritt den nächsten aufhält, sagt die Pille "Wartet …" auf dem Schritt.
    const plus = (i) => `<div class="ag-wf-plus"><span class="ag-wf-seg"></span><button class="ag-wf-add" data-wf="add" data-at="${i}" aria-label="${esc(this._t("wfAdd"))}">${ic("plus", 18)}</button><span class="ag-wf-seg"></span></div>`;
    const cards = steps.map((step, i) => this._card(step, i, running)).map((c, i) => c + plus(i + 1)).join("");
    const arm = this._armedHtml(running);
    const entry = this._delayHtml("entry", running);
    // Zwei Kapitel (1.19.0): "Beim Scharfschalten" und "Bei einem Alarm"; im Reiter "Immer aktiv" (nie scharf geschaltet) ohne Titel
    const chapHtml = (title, hint, phases = "") => `<div class="ag-wf-chap" data-phase="${phases}"><h3 class="ag-chap-t">${esc(this._t(title))}</h3><p class="ag-chap-h">${esc(this._t(hint))}</p></div>`;
    const chap = (title, hint, phases = "") => (this.trigger === "always" ? "" : chapHtml(title, hint, phases));
    // Seit 1.62.0 steht vor dem Alarm das Kapitel "Bei einem stillen Alarm", auch im Reiter "Immer aktiv": dort trägt darum auch der
    // Alarm seinen Kapiteltitel (sonst hinge "Alarm beginnt" scheinbar am stillen Alarm)
    const alarmChap = chapHtml("wfChapAlarm", this.trigger === "always" ? "wfChapAlarmAlwaysHint" : "wfChapAlarmHint", "entry alarm end");
    h._setHtml(body, `${chap("wfChapArm", "wfChapArmHint", "arming armed")}${arm}${chapHtml("wfChapReport", "wfChapReportHint", "report")}${this._reportHtml(running)}${alarmChap}${entry}<div class="ag-wf-line ag-wf-main">
        <div class="ag-wf-start"><span class="ag-mini err alarm">${ic("alert", 20)}</span>${esc(this._fixedTitle("wfStart"))}</div>${steps.length ? plus(0) : plus(0).replace('class="ag-wf-plus"', 'class="ag-wf-plus last"')}
        ${cards}
      </div>${this._endHtml()}${this._afterHtml(running)}${this._disarmedHtml(running, chap)}`);
    this._applyPhase(body);
    h._placePills();
    this.renderFoot();
  }

  // Filter "Phase" (Wunsch des Nutzers, 1.81.0): zeigt nur eine Phase des Ablaufs. Die Reihenfolge ist die des Ablaufs; Standard und Rückfall: alle Phasen. Nur die
  // Ansicht: der Entwurf, das Speichern und "Aktionen übernehmen von" betreffen immer den ganzen Ablauf.
  _phases() {
    const always = this.trigger === "always";
    const delays = (zone) => !always && this._delaySeconds(zone) > 0;
    return [
      ...(delays("arming") ? [["arming", "wfArming"]] : []),
      ...(always ? [] : [["armed", "wfArmed"]]),
      ["report", "wfReport"],
      ...(delays("entry") ? [["entry", "wfEntry"]] : []),
      ["alarm", "wfStart"],
      ["end", "wfEnd"],
      ...(always ? [] : [["disarmed", "wfDisarmed"]]),
    ];
  }

  _phaseNow() {
    return this._phases().some(([key]) => key === this.phase) ? this.phase : "";
  }

  _applyPhase(body) {
    const MAP = { ".ag-wf-arming": "arming", ".ag-wf-armed": "armed", ".ag-wf-report": "report", ".ag-wf-entry": "entry", ".ag-wf-main": "alarm", ".ag-wf-end": "end", ".ag-wf-after": "end", ".ag-wf-disarmed": "disarmed" };
    const now = this._phaseNow();
    for (const el of body.children) {
      const own = Object.entries(MAP).find(([sel]) => el.matches(sel))?.[1];
      if (own) el.dataset.phase = own;
      const phases = (el.dataset.phase || "").split(" ").filter(Boolean);
      el.classList.toggle("ag-phase-off", Boolean(now) && phases.length > 0 && !phases.includes(now));
    }
  }

  // Titel der drei festen Punkte; mit getrennten Aktionen je Modus steht der Modus in Klammern dahinter, damit man
  // beim Scrollen sieht, für welchen Reiter der Ablauf gilt. Ohne getrennte Aktionen bleibt der Titel wie er war.
  _fixedTitle(key) {
    const text = this._t(key);
    if (!this.draft?.perMode) return text;
    return `${text} (${this._t(MODE_KEY[this.trigger] || "wfAlways")})`;
  }

  // Festes Ende des Ablaufs: "Alarm endet" (Deaktivieren/Quittieren) mit der Abschlussmeldung. Seit 1.63.0 (Wunsch des Nutzers) genau wie die
  // anderen festen Meldungen: Schalter (senden ja/nein), "Meldung: Abschlussmeldung", Kurzfassung, Play (Testmeldung) und Stift.
  _endHtml() {
    const e = normEnd(this.draft?.end?.[this.trigger]);
    const n = e.notify || {};
    const on = e.send !== false;
    const label = this._t("ntc_end");
    const parts = on
      ? [this._recipientsText(n.targets || []), n.critical ? this._t("ntcCritical", { volume: Math.round((n.volume ?? this._ntGlobal().volume) * 100) }) : "", n.title || n.message ? this._t("ntcOwnText") : ""].filter(Boolean)
      : [this._t("ntcOff")];
    const none = on && !(n.targets || []).length && !(this.host._data?.notify?.alarm_targets || []).length;
    return `<div class="ag-wf-end"><div class="ag-wf-start"><span class="ag-mini ok ag-end-ic">${ic("check", 20)}</span>${esc(this._fixedTitle("wfEnd"))}</div>
      <div class="ag-card ag-wf-endcard ag-wf-notice ${on ? "" : "off"}" data-end-notice>
        <button class="ag-toggle ${on ? "on" : ""}" data-wf="end-on" role="switch" aria-checked="${on}" aria-label="${esc(label)}"></button>
        <span class="ag-wf-icon k-notify">${ic("bell", 20)}</span><div class="ag-wf-text"><b>${esc(label)}</b><small class="ag-t2 ag-small ${none ? "ag-warntext" : ""}">${esc(parts.join(" · "))}</small></div>
        <div class="ag-wf-btns">${this._onceCardBtn("end", 'data-wf="end-play"', on)}<button class="ag-iconbtn" data-wf="end-edit" aria-label="${esc(this._t("ntcEdit", { name: label }))}" title="${esc(this._t("wfEndEdit"))}">${ic("pencil", 18)}</button></div></div></div>`;
  }

  // An wen eine feste Meldung geht: eigene Empfänger (kurz), sonst die Standard-Empfänger
  _recipientsText(targets) {
    const short = (x) => x.replace(/^notify\.(mobile_app_)?/, "");
    const standard = this.host._data?.notify?.alarm_targets || [];
    return targets.length ? targets.map(short).join(", ") : standard.length ? this._t("ntcToStandard") : this._t("ntcToNone");
  }

  // Play-Knopf einer festen Meldung (1.63.0): Testmeldung mit den Werten der Karte, auch ungespeichert; ausgeschaltet gesperrt
  _onceCardBtn(key, attrs, on) {
    return onceBtn(key, attrs, { running: this.onceKey === key, label: this._t("ntcTest"), stopLabel: this._t("playStop"), disabled: !on, title: on ? this._t("ntcTest") : this._t("ntcTestOff") });
  }

  // Feste Meldung eines Punkts (1.62.0): immer da, mit Schalter (an/aus) und Stift (alle Einstellungen im Fenster). Die Zeile darunter
  // sagt, an wen sie geht und wie; ausgeschaltet ist die Karte blass.
  _noticeHtml(kind) {
    const n = normNotice(kind, this.draft?.notices?.[this.trigger]?.[kind]);
    const standard = this.host._data?.notify?.alarm_targets || [];
    const parts = n.enabled
      ? [this._recipientsText(n.targets), n.critical ? this._t("ntcCritical", { volume: Math.round(n.volume * 100) }) : "", n.persistent ? this._t("ntcPersistent") : "", n.title || n.message ? this._t("ntcOwnText") : ""].filter(Boolean)
      : [this._t("ntcOff")];
    const label = this._t(`ntc_${kind}`);
    return `<div class="ag-card ag-wf-endcard ag-wf-notice ${n.enabled ? "" : "off"}" data-notice="${kind}">
      <button class="ag-toggle ${n.enabled ? "on" : ""}" data-wf="notice-on" data-kind="${kind}" role="switch" aria-checked="${n.enabled}" aria-label="${esc(label)}"></button>
      <span class="ag-wf-icon k-notify">${ic("bell", 20)}</span><div class="ag-wf-text"><b>${esc(label)}</b><small class="ag-t2 ag-small ${n.enabled && !n.targets.length && !standard.length ? "ag-warntext" : ""}">${esc(parts.join(" · "))}</small></div>
      <div class="ag-wf-btns">${this._onceCardBtn(`notice:${kind}`, `data-wf="notice-play" data-kind="${kind}"`, n.enabled)}<button class="ag-iconbtn" data-wf="notice-edit" data-kind="${kind}" aria-label="${esc(this._t("ntcEdit", { name: label }))}" title="${esc(this._t("wfEndEdit"))}">${ic("pencil", 18)}</button></div></div>`;
  }

  // Aktionen bei einem stillen Alarm (1.62.0): eigenes Kapitel vor dem Alarm, mit der festen Meldung und einer eigenen Liste. Je Auslöser,
  // auch im Reiter "Immer aktiv" (ein immer aktiver Sensor auf "Stiller Alarm").
  _reportHtml(running) {
    const steps = this.steps("report");
    const plus = (i) => `<div class="ag-wf-plus ${i === steps.length ? "last" : ""}"><span class="ag-wf-seg"></span><button class="ag-wf-add" data-wf="add" data-at="${i}" aria-label="${esc(this._t("wfReportAdd"))}" title="${esc(this._t("wfReportAdd"))}">${ic("plus", 18)}</button><span class="ag-wf-seg"></span>${i === steps.length ? `<small class="ag-wf-plushint ag-t2 ag-small">${esc(this._t(steps.length ? "wfReportMore" : "wfReportHint"))}</small>` : ""}</div>`;
    return `<div class="ag-wf-line ag-wf-report" data-zone="report"><div class="ag-wf-start"><span class="ag-mini quiet">${ic("bellOff", 20)}</span>${esc(this._fixedTitle("wfReport"))}</div>${this._noticeHtml("sensor_report")}${plus(0)}${steps.map((step, i) => this._card(step, i, running, "report") + plus(i + 1)).join("")}</div>`;
  }

  // Aktionen beim Scharfschalten (1.14.0): ganz oben der feste Punkt "Anlage scharf geschaltet" mit einer eigenen Liste, zum Beispiel
  // für den Aktivierungston. Je Modus wie die Alarmaktionen; im Reiter "Immer aktiv" gibt es ihn nicht (dort wird nie scharf geschaltet).
  _armedHtml(running) {
    if (this.trigger === "always") return "";
    return this._delayHtml("arming", running) + this._armedPointHtml(running);
  }

  // Zeit der Verzögerung, die ein Punkt zeigt: die des Reiters, ohne getrennte Modi die längste aller Modi (der Ablauf gilt für alle)
  _delaySeconds(zone, trigger = this.trigger) {
    const s = this.system;
    const modes = this.draft?.perMode ? [trigger] : (s?.modes || []);
    const values = modes.map((m) => (zone === "arming" ? Number(s?.mode_settings?.[m]?.exit_delay) : Number(s?.entry_delay_max?.[m])) || 0);
    return Math.max(0, ...values);
  }

  // Die Punkte zu den Verzögerungen stehen nur da, wo es die Verzögerung gibt: bei 0 liefe nie etwas, und ein Punkt, der immer sofort
  // endet, wäre irreführend (Vorgabe des Nutzers, 2026-11-12). Gespeicherte Schritte bleiben dabei erhalten.
  _delayHtml(zone, running) {
    if (this.trigger === "always") return "";
    const seconds = this._delaySeconds(zone);
    if (!seconds) return "";
    const steps = this.steps(zone);
    const part = zone === "arming" ? "Arming" : "Entry";
    const add = this._t(`wf${part}Add`);
    const plus = (i) => `<div class="ag-wf-plus ${i === steps.length ? "last" : ""}"><span class="ag-wf-seg"></span><button class="ag-wf-add" data-wf="add" data-at="${i}" aria-label="${esc(add)}" title="${esc(add)}">${ic("plus", 18)}</button><span class="ag-wf-seg"></span>${i === steps.length ? `<small class="ag-wf-plushint ag-t2 ag-small">${esc(this._t(steps.length ? `wf${part}More` : `wf${part}Hint`))}</small>` : ""}</div>`;
    const sub = `<small class="ag-t2 ag-wf-sub">${esc(this._t(`wf${part}Sub`, { n: fmtDur(seconds) }))}</small>`;
    return `<div class="ag-wf-line ag-wf-${zone}" data-zone="${zone}"><div class="ag-wf-start"><span class="ag-mini warn">${ic("timer", 20)}</span><span>${esc(this._fixedTitle(`wf${part}`))}${sub}</span></div>${zone === "entry" ? this._noticeHtml("pending") : ""}${plus(0)}${steps.map((step, i) => this._card(step, i, running, zone) + plus(i + 1)).join("")}</div>`;
  }

  _armedPointHtml(running) {
    const steps = this.steps("armed");
    const plus = (i) => `<div class="ag-wf-plus ${i === steps.length ? "last" : ""}"><span class="ag-wf-seg"></span><button class="ag-wf-add" data-wf="add" data-at="${i}" aria-label="${esc(this._t("wfArmedAdd"))}" title="${esc(this._t("wfArmedAdd"))}">${ic("plus", 18)}</button><span class="ag-wf-seg"></span>${i === steps.length ? `<small class="ag-wf-plushint ag-t2 ag-small">${esc(this._t(steps.length ? "wfArmedMore" : "wfArmedHint"))}</small>` : ""}</div>`;
    return `<div class="ag-wf-line ag-wf-armed" data-zone="armed"><div class="ag-wf-start"><span class="ag-mini arm">${ic("shield", 20)}</span>${esc(this._fixedTitle("wfArmed"))}</div>${this._noticeHtml("armed")}${plus(0)}${steps.map((step, i) => this._card(step, i, running, "armed") + plus(i + 1)).join("")}</div>`;
  }

  // Aktionen beim Deaktivieren (1.27.0): ganz unten ein eigenes Kapitel mit dem festen Punkt "Anlage deaktiviert" und einer eigenen
  // Liste, zum Beispiel für den Deaktivierungston. Je Modus, der scharf war; im Reiter "Immer aktiv" gibt es sie nicht.
  _disarmedHtml(running, chap) {
    if (this.trigger === "always") return "";
    const steps = this.steps("disarmed");
    const plus = (i) => `<div class="ag-wf-plus ${i === steps.length ? "last" : ""}"><span class="ag-wf-seg"></span><button class="ag-wf-add" data-wf="add" data-at="${i}" aria-label="${esc(this._t("wfDisarmedAdd"))}" title="${esc(this._t("wfDisarmedAdd"))}">${ic("plus", 18)}</button><span class="ag-wf-seg"></span>${i === steps.length ? `<small class="ag-wf-plushint ag-t2 ag-small">${esc(this._t(steps.length ? "wfDisarmedMore" : "wfDisarmedHint"))}</small>` : ""}</div>`;
    return `${chap("wfChapDisarm", "wfChapDisarmHint", "disarmed")}<div class="ag-wf-line ag-wf-disarmed" data-zone="disarmed"><div class="ag-wf-start"><span class="ag-mini ok">${ic("shieldOff", 20)}</span>${esc(this._fixedTitle("wfDisarmed"))}</div>${this._noticeHtml("disarmed")}${plus(0)}${steps.map((step, i) => this._card(step, i, running, "disarmed") + plus(i + 1)).join("")}</div>`;
  }

  // Aktionen nach dem Quittieren: eigene Liste hinter "Alarm endet", mit denselben Karten und demselben Plus wie oben. Möglich sind
  // Gerät, Ton (mit Dauer), Warten, Szene und eigene Aktion; "Rückgängig" gibt es hier nicht (danach folgt nichts mehr).
  _afterHtml(running) {
    const steps = this.steps("after");
    const plus = (i) => `<div class="ag-wf-plus ${i === steps.length ? "last" : ""}"><span class="ag-wf-seg"></span><button class="ag-wf-add" data-wf="add" data-at="${i}" aria-label="${esc(this._t("wfAfterAdd"))}" title="${esc(this._t("wfAfterAdd"))}">${ic("plus", 18)}</button><span class="ag-wf-seg"></span>${i === steps.length ? `<small class="ag-wf-plushint ag-t2 ag-small">${esc(this._t(steps.length ? "wfAfterMore" : "wfAfterHint"))}</small>` : ""}</div>`;
    return `<div class="ag-wf-line ag-wf-after" data-zone="after">${plus(0)}${steps.map((step, i) => this._card(step, i, running, "after") + plus(i + 1)).join("")}</div>`;
  }

  // Fenster "Alarm endet": Wahl beim Deaktivieren und optionale eigene Push-Meldung mit allen Optionen
  openEndEditor() {
    const e = normEnd(this.ensureDraft().end?.[this.trigger]);
    const n = e.notify || {};
    const form = { ...blank(), kind: "end", endSend: e.send !== false, ntTitle: n.title || "", ntMessage: n.message || "", ntCritical: n.critical ?? null, ntVolume: n.volume ?? null,
      ntClick: n.click && n.click !== "log" ? n.click : null, ntClickPath: n.click_path || "", ntTargets: n.targets?.length ? [...n.targets] : null };
    this.edit = { index: null, insert: null, end: true, form, q: "", error: "", open: false };
    this.renderEditor();
    this._dlg().showModal();
  }

  // Fenster der Abschlussmeldung, aufgebaut wie das der anderen festen Meldungen (1.63.0): "Meldung senden" (ja/nein), dann die Felder;
  // leerer Titel oder Text gilt als Standardtext
  _endFields(f) {
    const send = this._sec("ntcSend", `<div class="ag-ef-row"><div class="ag-settx"><b>${esc(this._t("ntcSend"))}</b><small>${esc(this._t("ntcHint_end"))}</small></div>${this._toggle('data-wf="end-notify"', f.endSend, "ntcSend")}</div>`);
    return send + (f.endSend ? `${this._notifyFields(f)}<div>${this._onceEditorBtn("end", 'data-wf="end-test"')}</div>` : "");
  }

  // Test-Knopf im Fenster einer festen Meldung: derselbe Test wie Play auf der Karte (gleicher Schlüssel, gleiches Verhalten)
  _onceEditorBtn(key, attrs) {
    return onceBtn(key, attrs, { running: this.onceKey === key, label: this._t("wfEndTest"), stopLabel: this._t("playStop"), text: this._t("wfEndTest"), size: 16, cls: "ag-btn" });
  }

  _endApply() {
    const f = this.edit.form;
    if (f.endSend && f.ntClick === "custom" && !/^\/[^\s]*$/.test(String(f.ntClickPath || "").trim())) return this._editError("fldNtPathBad");
    const d = this.ensureDraft();
    // Eigene Werte nur, wenn etwas vom Standard abweicht; ausgeschaltet bleiben sie stehen (wer wieder einschaltet, findet seinen Text)
    const own = this._endOf(f);
    const plain = !own.title && !own.message && own.critical === null && own.volume === null && own.click === "log" && !own.targets;
    d.end = { ...(d.end || {}), [this.trigger]: normEnd({ notify: plain ? null : own, send: f.endSend ? undefined : false }) };
    this.saveState = null;
    this.edit = null;
    this._dlg().close();
    this.render();
    this.host._renderDots();
  }

  // Die eigene Abschlussmeldung, wie das Fenster sie zeigt
  _endOf(f) {
    return { enabled: true, title: String(f.ntTitle || "").trim(), message: String(f.ntMessage || "").trim(), critical: f.ntCritical, volume: f.ntVolume, click: f.ntClick || "log",
      click_path: f.ntClick === "custom" ? String(f.ntClickPath || "").trim() : "", targets: f.ntTargets?.length ? [...f.ntTargets] : undefined };
  }

  // Testmeldung "Alarm beendet" an die Empfänger: aus dem Fenster (auch ungespeichert) oder von der Karte (Werte des Entwurfs)
  async _endTest(fromCard = false) {
    const f = this.edit?.form;
    let n;
    if (fromCard || !f) {
      n = { ...(normEnd(this.draft?.end?.[this.trigger]).notify || {}), enabled: true };
    } else {
      if (f.ntClick === "custom" && !/^\/[^\s]*$/.test(String(f.ntClickPath || "").trim())) return this._editError("fldNtPathBad");
      n = this._endOf(f);
    }
    const out = { enabled: true, title: n.title || "", message: n.message || "", click: n.click || "log" };
    if (n.critical !== null && n.critical !== undefined) out.critical = !!n.critical;
    if (n.volume !== null && n.volume !== undefined) out.volume = Math.min(1, Math.max(0, Number(n.volume)));
    if (n.targets?.length) out.targets = [...n.targets];
    if (out.click === "custom") out.click_path = String(n.click_path || "").trim();
    await this._once("end", async () => {
      await this.host._hass.callWS({ type: "alarmageddon/test_end_notify", entry_id: this.system.entry_id, notify: out });
      this.host._toast(this._t("wfEndTested"));
    });
  }

  // Einmaliger Test einer festen Meldung (Karte oder Fenster): Knopf rot und Stopp wie jeder Play-Knopf (common.js runOnce). Ein zweiter Druck
  // beendet nur die Anzeige. Fehler stehen im Fenster, sonst als Hinweis unten.
  async _once(key, work) {
    const paint = () => paintOnce([this.host._view, this._dlg()], this.onceKey);
    if (this.onceKey === key) {
      this.onceKey = null;
      return paint();
    }
    await runOnce(this, key, async () => {
      try {
        await work();
      } catch (err) {
        const text = err?.code === "no_targets" ? this._t("ntNoneChosen") : this._t("saveFailed", { message: errText(err) });
        if (this.edit && this._dlg()?.open) this._editError(null, text);
        else this.host._toast(text);
      }
    }, paint);
  }

  // Fenster einer festen Meldung (1.62.0): ein/aus, eigener Text mit Platzhaltern, Empfänger (Standard-Empfänger vorgewählt), Kritisch
  // und Lautstärke, in Home Assistant stehen lassen, Klickziel, Testmeldung. Dieselben Felder wie die Push-Meldung des Alarms.
  openNoticeEditor(kind) {
    const n = normNotice(kind, this.ensureDraft().notices?.[this.trigger]?.[kind]);
    const form = { ...blank(), kind: "notice", nKind: kind, nEnabled: n.enabled, ntTitle: n.title, ntMessage: n.message, ntCritical: n.critical, ntVolume: n.volume, ntPersistent: n.persistent,
      ntClick: n.click, ntClickPath: n.click_path, ntTargets: n.targets.length ? [...n.targets] : null };
    this.edit = { index: null, insert: null, notice: true, form, q: "", error: "", open: false };
    this.renderEditor();
    this._dlg().showModal();
  }

  _noticeFields(f) {
    const send = this._sec("ntcSend", `<div class="ag-ef-row"><div class="ag-settx"><b>${esc(this._t("ntcSend"))}</b><small>${esc(this._t(`ntcHint_${f.nKind}`))}</small></div>${this._toggle('data-wf="notice-enabled"', f.nEnabled, "ntcSend")}</div>`);
    return send + (f.nEnabled ? `${this._notifyFields(f)}<div>${this._onceEditorBtn(`notice:${f.nKind}`, `data-wf="notice-test" data-kind="${f.nKind}"`)}</div>` : "");
  }

  // Die Meldung, wie sie gespeichert und getestet wird
  _noticeOf(f) {
    return normNotice(f.nKind, { enabled: f.nEnabled, title: f.ntTitle, message: f.ntMessage, critical: f.ntCritical, volume: f.ntVolume, persistent: f.ntPersistent, click: f.ntClick || "overview",
      click_path: f.ntClickPath, targets: f.ntTargets || [] });
  }

  _noticeApply() {
    const f = this.edit.form;
    if (f.nEnabled && f.ntClick === "custom" && !/^\/[^\s]*$/.test(String(f.ntClickPath || "").trim())) return this._editError("fldNtPathBad");
    const d = this.ensureDraft();
    d.notices = { ...(d.notices || {}), [this.trigger]: { ...(d.notices?.[this.trigger] || {}), [f.nKind]: this._noticeOf(f) } };
    this.saveState = null;
    this.edit = null;
    this._dlg().close();
    this.render();
    this.host._renderDots();
  }

  // Testmeldung einer festen Meldung an ihre Empfänger: aus dem Fenster (auch ungespeichert) oder von der Karte (Werte des Entwurfs)
  async _noticeTest(kind = null) {
    const f = this.edit?.form;
    let notice;
    if (kind) {
      notice = normNotice(kind, this.draft?.notices?.[this.trigger]?.[kind]);
    } else {
      if (f.ntClick === "custom" && !/^\/[^\s]*$/.test(String(f.ntClickPath || "").trim())) return this._editError("fldNtPathBad");
      kind = f.nKind;
      notice = this._noticeOf(f);
    }
    await this._once(`notice:${kind}`, async () => {
      await this.host._hass.callWS({ type: "alarmageddon/test_event_notify", entry_id: this.system.entry_id, kind, trigger: this.trigger, notice: { ...notice, enabled: true } });
      this.host._toast(this._t("wfEndTested"));
    });
  }

  // Kurzfassung eines Schritts für die Karte
  _summary(f) {
    const names = f.targets.map((id) => this.host._name(id)).join(", ") || this._t("stepNoTargets");
    if (f.kind === "notify") return f.ntTitle || f.ntMessage ? [f.ntTitle, f.ntMessage].filter(Boolean).join(" – ") : this._t("stepNotifyHint");
    if (f.kind === "acknowledge") return this._t("stepAckHint");
    if (f.kind === "healthcheck") return `${this._hcItem(f.hcId)?.name || this._t("fldHcGone")} · ${f.hcSuffix}`;
    if (f.kind === "wait") return this._t("stepWaitSummary", { seconds: fmtDur(f.seconds) });
    if (isTone(f.kind)) return `${isCustom(f.sound) ? customName(this.host, f.sound) || this._t("customMissing") : this._t(SOUND_KEY[f.sound] || "sndSiren")} · ${names}${f.setVolume ? ` · ${this._volumeText(f)}` : ""}${f.delay ? "" : ` · ${f.until ? this._t("fldPlayUntilShort") : fmtDur(f.playSeconds)}`}`;
    if (f.kind === "scene") return names;
    if (f.kind === "device") {
      const domains = new Set(f.targets.map((e) => e.split(".")[0]));
      const word = this._t(cap(domains.size === 1 ? [...domains][0] : "", f.action));
      const opts = Object.entries(f.optsOn).filter(([, on]) => on).map(([k]) => this._optText(k, f.opts[k])).filter(Boolean);
      const undo = f.undoOn && UNDO_SERVICES[toStep(f).action?.split(".")[1]] ? [this._t("undoSummary", { action: this._t(cap(domains.size === 1 ? [...domains][0] : "", UNDO_ACTION[f.action])), time: fmtDur(f.undoSeconds) })] : [];
      return [word, names, ...opts, ...undo].join(" · ");
    }
    return `${this._serviceName(f.domain, f.service)} · ${names}`;
  }

  _optText(key, value) {
    if (value == null || value === "") return "";
    if (key === "brightness_pct" || key === "position" || key === "percentage") return `${value} %`;
    if (key === "color_temp_kelvin") return `${value} K`;
    if (key === "temperature") return `${value} °`;
    return String(value);
  }

  _card(step, i, running, zone = "main") {
    if (step?.type === "group" && !inGroup(zone)) return this._groupCard(step, i, running, zone);
    const f = fromStep(step);
    const k = KINDS.find((x) => x.kind === f.kind);
    const restore = baseZone(zone) === "main" && (f.kind === "sound" || f.restore) && f.kind !== "notify" && f.kind !== "wait" && f.kind !== "acknowledge" ? `<span class="ag-tag none" title="${esc(this._t("wfRestoreMark"))}">${ic("restore", 12)}</span>` : "";
    const title = f.kind === "custom" ? this._serviceName(f.domain, f.service) : this._t(k.label);
    const marks = this._marks(zone, i);
    return `<div class="ag-card ag-wf-step ${marks.length ? `ag-bad ${marks.some((m) => m.tone === "err") ? "err" : "warn"}` : ""}" data-index="${i}">${this._markBadge(marks)}
      <button class="ag-handle" data-wf="grab" data-index="${i}" aria-label="${esc(this._t("stepGrab"))}" title="${esc(this._t("stepGrab"))}">${ic("grip", 20)}</button>
      <span class="ag-wf-icon k-${f.kind}">${ic(k.icon, 20)}</span>
      <div class="ag-wf-text"><b>${esc(title)}</b> ${restore}<div class="ag-t2 ag-small">${esc(this._summary(f))}</div>${f.delay ? this._delayPill(zone) : this._waitPill(f)}${this._markLines(marks)}<span class="ag-zone">${esc(this._t(`zone_${baseZone(zone)}`))}</span></div>
      <div class="ag-wf-btns">${this._stepTestBtn(i, zone)}
        <button class="ag-iconbtn" data-wf="edit" data-index="${i}" aria-label="${esc(this._t("stepEdit"))}">${ic("pencil", 18)}</button>
        <button class="ag-iconbtn" data-wf="duplicate" data-index="${i}" ${this._full(zone) ? "disabled" : ""} aria-label="${esc(this._t("stepDuplicate"))}" title="${esc(this._t("stepDuplicate"))}">${ic("copy", 18)}</button>
        <button class="ag-iconbtn" data-wf="xfer" data-index="${i}" aria-label="${esc(this._t("xfBtn"))}" title="${esc(this._t("xfBtn"))}">${ic("fileMove", 18)}</button>
        <button class="ag-iconbtn" data-wf="delete" data-index="${i}" aria-label="${esc(this._t("stepDelete"))}">${ic("trash", 18)}</button></div></div>`;
  }

  // Kurzfassung der Wiederholung einer Gruppe ("3 Durchläufe", "Wiederholen für 5 min", "Wiederholen bis deaktiviert")
  _groupSummary(f) {
    if (f.gMode === "until_disarmed") return this._t("grpSumUntil");
    const s = Number(f.gSeconds);
    if (f.gMode === "duration") return this._t("grpSumDuration", { time: fmtDur(s) });
    return this._t(Number(f.gCount) === 1 ? "grpSumCountOne" : "grpSumCount", { n: f.gCount });
  }

  // Aktions-Gruppe (1.59.0, Variante B des Mockups): ein Rahmen in der Farbe der Liste, in der sie steht (beim Alarm rot), mit Kopfzeile;
  // darin die Schritte als dieselben Karten wie überall, mit Plus dazwischen. Die Liste in der Gruppe ist eine Liste wie die anderen
  // (data-zone "<Liste>:<Stelle>"): Plus, Fenster, Test und Ziehen gelten dort ohne eigene Wege.
  _groupCard(step, i, running, zone) {
    const f = fromStep(step);
    const inner = `${zone}:${i}`;
    const steps = f.gSteps;
    const full = this._full(inner);
    const add = this._t("grpAdd");
    const plus = (j) => `<div class="ag-wf-plus ${j === steps.length ? "last" : ""}"><span class="ag-wf-seg"></span><button class="ag-wf-add" data-wf="add" data-at="${j}" ${full ? "disabled" : ""} aria-label="${esc(add)}" title="${esc(add)}">${ic("plus", 18)}</button><span class="ag-wf-seg"></span>${j === steps.length ? `<small class="ag-wf-plushint ag-t2 ag-small">${esc(this._t(steps.length ? "grpMore" : "grpEmpty"))}</small>` : ""}</div>`;
    const name = String(f.gName || "").trim();
    // Befunde der Schritte in der Gruppe: das Ausrufezeichen an der Gruppe, die Karten darin tragen ihre eigenen
    const st = this.host.selftest;
    const gm = st && this.system?.entry_id && this.trigger !== "monitor" ? st.groupMarks(this.system.entry_id, this.trigger, this._stList(zone), i + 1) : [];
    const gTone = gm.some((m) => m.tone === "err") ? "err" : "warn";
    return `<div class="ag-wf-step ag-wf-group ${gm.length ? `ag-bad ${gTone}` : ""}" data-index="${i}">${this._markBadge(gm)}
      <div class="ag-wf-ghead"><button class="ag-handle" data-wf="grab" data-index="${i}" aria-label="${esc(this._t("stepGrab"))}" title="${esc(this._t("stepGrab"))}">${ic("grip", 20)}</button>
        <div class="ag-wf-gtitle"><span class="ag-wf-gpill">${ic("repeat", 16)}<span>${esc(name ? this._t("grpTitleNamed", { name }) : this._t("grpTitle"))}</span></span><span class="ag-wf-gsum">${esc(this._groupSummary(f))}</span>${this._waitPill(f)}${gm.length ? `<span class="ag-wf-prob ${gTone} gsum">${esc(this._t(gm.length === 1 ? "wfGroupProbOne" : "wfGroupProb", { n: gm.length }))}</span>` : ""}</div>
        <div class="ag-wf-btns">${this._stepTestBtn(i, zone)}
          <button class="ag-iconbtn" data-wf="edit" data-index="${i}" aria-label="${esc(this._t("grpEdit"))}" title="${esc(this._t("grpEdit"))}">${ic("pencil", 18)}</button>
          <button class="ag-iconbtn" data-wf="duplicate" data-index="${i}" ${this._full(zone, 1 + steps.length) ? "disabled" : ""} aria-label="${esc(this._t("stepDuplicate"))}" title="${esc(this._t("stepDuplicate"))}">${ic("copy", 18)}</button>
          <button class="ag-iconbtn" data-wf="xfer" data-index="${i}" aria-label="${esc(this._t("xfBtn"))}" title="${esc(this._t("xfBtn"))}">${ic("fileMove", 18)}</button>
          <button class="ag-iconbtn" data-wf="delete" data-index="${i}" aria-label="${esc(this._t("grpDelete"))}" title="${esc(this._t("grpDelete"))}">${ic("trash", 18)}</button></div></div>
      <div class="ag-wf-line ag-wf-glist ${steps.length ? "loop" : ""}" data-zone="${inner}">${steps.length ? '<span class="ag-wf-loop" aria-hidden="true"></span>' : ""}${plus(0)}${steps.map((s, j) => this._card(s, j, running, inner) + plus(j + 1)).join("")}</div></div>`;
  }

  // "70 %" oder, mit eigenen Werten je Medienplayer, die Spanne "30–70 %"
  _volumeText(f) {
    const own = ownVolumes(f);
    if (!own) return `${Math.round(effectiveVolume(f) * 100)} %`;
    const values = Object.values(own).map((v) => Math.round(v * 100));
    return `${Math.min(...values)}–${Math.max(...values)} %`;
  }

  // Pille "Solange die Verzögerung läuft" statt der Sekunden (1.19.0)
  _delayPill(zone) {
    return `<span class="ag-waitpill ag-delaypill">${ic("timer", 14)}<span>${esc(this._t(zone === "arming" ? "wfDelayPillArming" : "wfDelayPillEntry"))}</span></span>`;
  }

  // Pille auf dem Schritt, wenn der Ablauf auf sein Ende wartet (die Ausnahme; standardmässig läuft alles weiter). Eingestellt wird
  // das im Fenster des Schritts.
  _waitPill(f) {
    if (!f.wait || !["device", "sound", "chime", "dechime", "prealarm", "scene", "custom", "group"].includes(f.kind) || (f.kind === "sound" && f.until) || (f.kind === "group" && f.gMode === "until_disarmed")) return "";
    return `<span class="ag-waitpill">${ic("timer", 14)}<span>${esc(this._t("wfWaits"))}</span></span>`;
  }

  // Ist der Test dieses Schritts der laufende (1.18.1)? Dann wird sein Play-Knopf zum Stopp-Knopf; der Knopf unten bleibt gesperrt
  _isStepTest(index, zone) {
    const t = this.testSource;
    return !!(this.system?.workflow_running && this.system.workflow_test && t?.kind === "step" && t.zone === zone && t.index === index);
  }

  // Läuft ein echter Alarm, lässt sich nichts testen. Ein laufender Test sperrt nichts: ein neuer Test beendet ihn und startet (der Server
  // stoppt den alten), so läuft immer nur einer und kein Knopf bleibt gesperrt, weil ein früherer Test noch "läuft".
  _alarmBlocks() {
    const s = this.system;
    return !!(s?.workflow_running && !s.workflow_test);
  }

  _stepTestBtn(i, zone) {
    if (this._isStepTest(i, zone)) return `<button class="ag-iconbtn ag-running" data-wf="test-step-stop" data-index="${i}" aria-label="${esc(this._t("stepTestStop"))}" title="${esc(this._t("stepTestStop"))}">${ic("stop", 18)}</button>`;
    const busy = this._alarmBlocks();
    return `<button class="ag-iconbtn" data-wf="test-step" data-index="${i}" ${busy ? "disabled" : ""} aria-label="${esc(this._t("stepTest"))}" title="${esc(busy ? this._t("stepTestBusy") : this._t("stepTest"))}">${ic("play", 18)}</button>`;
  }

  // "Testen" steht unten bei den anderen Knöpfen (auf dem Handy nur das Symbol, damit alle drei Platz haben)
  _testBtnHtml(dirty) {
    const s = this.system;
    const running = s?.workflow_running;
    const label = this._t(running && s.workflow_test ? "wfTestStop" : "wfTest");
    const text = this.host.hasAttribute("narrow") ? "" : esc(label);
    // Läuft der Test eines einzelnen Schritts, hat dieser Schritt den Stopp-Knopf; "Test" unten startet den ganzen Ablauf und ersetzt ihn
    if (running && s.workflow_test && this.testSource?.kind === "step") return `<button class="ag-btn" data-wf="test" aria-label="${esc(this._t("wfTest"))}" ${dirty || !this.steps().length ? "disabled" : ""} title="${esc(dirty ? this._t("wfSaveFirst") : this._t("wfTestHint"))}">${ic("play", 18)}${this.host.hasAttribute("narrow") ? "" : esc(this._t("wfTest"))}</button>`;
    if (running && s.workflow_test) return `<button class="ag-btn ag-running" data-wf="test-stop" aria-label="${esc(label)}">${ic("stop", 18)}${text}</button>`;
    return `<button class="ag-btn" data-wf="test" aria-label="${esc(label)}" ${dirty || running || !this.steps().length ? "disabled" : ""} title="${esc(dirty ? this._t("wfSaveFirst") : this._t("wfTestHint"))}">${ic("play", 18)}${text}</button>`;
  }

  renderFoot() {
    const h = this.host;
    h._renderDots?.(); // Punkt "ungespeichert" an den Reitern
    const foot = h._view?.querySelector(".ag-foot");
    if (!foot) return;
    if (this.trigger === "monitor") {
      this.mon.renderFoot();
      return;
    }
    const n = this.flowDirty();
    let status;
    if (this.saveState === "saved" && !n) status = `<span class="ag-saved">${ic("check", 16)} ${esc(this._t("saved"))}</span>`;
    else if (this.saveState && this.saveState !== "saved") status = `<span class="ag-err">${esc(this.saveState)}</span>`;
    else status = `<span class="ag-t2">${esc(n === 0 ? this._t("noChanges") : n === 1 ? this._t("change") : this._t("changes", { count: n }))}</span>`;
    // "Aktionen übernehmen von": nur mit "Einstellungen pro Modus" (sonst gilt ohnehin ein Ablauf für alle)
    const others = this.draft?.perMode ? this.triggers().filter((t) => t !== this.trigger) : [];
    const name = (t) => (t === "always" ? this._t("wfAlways") : this._t(MODE_KEY[t]));
    const copy = others.length
      ? `<select class="ag-input ag-copyfrom" data-wf="copy-from" aria-label="${esc(this._t("wfCopyFrom"))}"><option value="">${esc(this._t("wfCopyFrom"))}</option>${others.map((t) => `<option value="${t}">${esc(name(t))}</option>`).join("")}</select>`
      : "";
    const now = this._phaseNow();
    const phase = `<select class="ag-input ag-phasefilter" data-wf="phase" aria-label="${esc(this._t("wfPhaseLabel"))}"><option value="">${esc(this._t("wfPhaseAll"))}</option>${this._phases().map(([key, label]) => `<option value="${key}" ${key === now ? "selected" : ""}>${esc(this._t(label))}</option>`).join("")}</select>`;
    h._setHtml(foot, `${status}<span class="ag-grow"></span><span class="ag-footsels">${copy}${phase}</span>${this._testBtnHtml(n > 0)}<button class="ag-btn" data-wf="cancel" ${n ? "" : "disabled"}>${esc(this._t("cancel"))}</button>
      <button class="ag-btn primary" data-wf="save" ${n && !this.saving ? "" : "disabled"}>${ic("check", 18)}${esc(this._t("save"))}</button>`);
  }

  // ----- Hilfen für den Editor -----

  get states() {
    return this.host._hass?.states || {};
  }

  _services() {
    return this.host._hass?.services || {};
  }

  // Übersetzungen der Dienste: HA liefert in hass.services nur Rohdaten; Namen, Beschreibungen und Feldnamen holt das Panel
  // wie die HA-Oberfläche über frontend/get_translations (einmal je Sprache, danach im Speicher)
  async loadTranslations() {
    const lang = this.host._hass?.locale?.language || this.host._lang;
    if (this._trLang === lang || this._trLoading) return;
    this._trLoading = true;
    const res = {};
    try {
      for (const category of ["services", "title", "entity_component", "selector"]) {
        const out = await this.host._hass.callWS({ type: "frontend/get_translations", language: lang, category });
        Object.assign(res, out?.resources || {});
      }
      this.tr = res;
      this._trLang = lang;
      if (this.host._tab === "config" && this.host._sub === "actions") {
        this.render();
        if (this.edit?.form && this._dlg()?.open) this.renderEditor();
      }
    } catch {
      this._trLang = lang; // ohne Übersetzungen bleibt es bei den Namen von HA; nicht dauernd neu versuchen
    } finally {
      this._trLoading = false;
    }
  }

  _tr(key) {
    return this.tr?.[key] || this.host._hass?.localize?.(key) || "";
  }

  // "set_cover_position" -> "Set cover position": besser lesbar als die Kennung, falls HA nichts liefert
  _human(id) {
    const s = String(id || "").replace(/_/g, " ").trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  }

  _domainName(d) {
    return this._tr(`component.${d}.title`) || this._tr(`component.${d}.entity_component._.name`) || this._human(d);
  }

  _serviceName(domain, service) {
    if (!domain || !service) return this._t("stepCustom");
    const meta = this._services()[domain]?.[service];
    return this._tr(`component.${domain}.services.${service}.name`) || meta?.name || this._human(service);
  }

  _serviceDesc(domain, service) {
    return this._tr(`component.${domain}.services.${service}.description`) || this._services()[domain]?.[service]?.description || "";
  }

  _fieldName(f, key, fd) {
    return this._tr(`component.${f.domain}.services.${f.service}.fields.${key}.name`) || fd.name || this._human(key);
  }

  _fieldDesc(f, key, fd) {
    return this._tr(`component.${f.domain}.services.${f.service}.fields.${key}.description`) || fd.description || "";
  }

  _entitiesAll(domains) {
    return Object.values(this.states)
      .filter((s) => !domains.length || domains.includes(s.entity_id.split(".")[0]))
      .map((s) => ({ id: s.entity_id, name: s.attributes?.friendly_name || s.entity_id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  _entities(domains) {
    const q = (this.edit?.q || "").toLowerCase();
    return this._entitiesAll(domains || []).filter((e) => !q || e.name.toLowerCase().includes(q) || e.id.includes(q));
  }

  // Auswahlfeld: Suchfeld mit Liste darunter, gewählte als Pille mit x (wie die Empfänger)
  _combo(domains, f, placeholderKey) {
    const pills = f.targets.map((id) => `<span class="ag-rpill ${this.states[id] ? "" : "gone"}">${ic("bell", 14)}<span>${esc(this.host._name(id))}</span><button type="button" class="ag-rx" data-wf="unpick" data-ent="${esc(id)}" aria-label="${esc(this._t("ntRemove", { name: this.host._name(id) }))}">${ic("close", 14)}</button></span>`).join("");
    return `<div class="ag-combo ${this.edit.open ? "open" : ""}">
      <label class="ag-search">${ic("search", 18)}<input type="search" data-wf="eq" placeholder="${esc(this._t(placeholderKey))}" value="${esc(this.edit.q)}" autocomplete="off" aria-label="${esc(this._t(placeholderKey))}">
        <button type="button" class="ag-clear" data-wf="eq-clear" aria-label="${esc(this._t("clearSearch"))}" ${this.edit.q ? "" : "hidden"}>${ic("close", 16)}</button></label>
      <div class="ag-combo-list" role="listbox">${this._comboItems(domains, f)}</div>
      ${pills ? `<div class="ag-rpills">${pills}</div>` : ""}</div>`;
  }

  _comboItems(domains, f) {
    const list = this._entities(domains).filter((e) => !f.targets.includes(e.id));
    const shown = list.slice(0, 60);
    if (!shown.length) return `<div class="ag-t2 ag-small ag-combo-more">${esc(this._t("fldNoMatch"))}</div>`;
    return shown.map((e) => `<button type="button" class="ag-combo-item" role="option" data-wf="pick" data-ent="${esc(e.id)}"><span>${esc(e.name)}</span><small>${esc(e.id)}</small></button>`).join("")
      + (list.length > shown.length ? `<div class="ag-t2 ag-small ag-combo-more">${esc(this._t("fldMore", { count: list.length - shown.length }))}</div>` : "");
  }

  _domainsOf(f) {
    if (isTone(f.kind)) return ["media_player"];
    if (f.kind === "device") return Object.keys(DEVICE);
    if (f.kind === "scene") return SCENE_DOMAINS;
    const meta = this._services()[f.domain]?.[f.service];
    const doms = [].concat(meta?.target?.entity || []).flatMap((x) => [].concat(x?.domain || []));
    return doms.length ? doms : f.domain ? [f.domain] : null;
  }

  _dlg() {
    return this.host._root.getElementById("ag-step");
  }

  // Schrittarten, die in einer Liste Sinn haben (beim Alarm alle ausser dem Aktivierungston)
  _zoneKinds(path) {
    const zone = baseZone(path);
    const allowed = zone === "after" ? AFTER_KINDS : zone === "armed" ? ARMED_KINDS : zone === "arming" ? ARMING_KINDS : zone === "entry" ? ENTRY_KINDS : zone === "disarmed" ? DISARMED_KINDS : zone === "report" ? REPORT_KINDS : null;
    const kinds = allowed || KINDS.filter((k) => k.kind !== "chime" && k.kind !== "dechime" && k.kind !== "group").map((k) => k.kind);
    // Die Gruppe gibt es in jeder Liste; in einer Gruppe gilt, was in ihrer Liste gilt, ohne Gruppe und ohne "Quittieren"
    const list = inGroup(path) ? kinds.filter((k) => !GROUP_NO.includes(k)) : [...kinds, "group"];
    // "HealthCheck melden" steht in der Auswahl immer ganz unten (Wunsch des Nutzers, 1.79.1)
    return [...list.filter((k) => k !== "healthcheck"), ...list.filter((k) => k === "healthcheck")];
  }

  openPicker(at, zone = "main") {
    this.edit = { insert: at, index: null, form: null, q: "", error: "", open: false, zone };
    // Je Liste nur, was dort Sinn hat: beim Alarm die Sirene (kein Aktivierungston), beim Scharfschalten der Aktivierungston (keine Sirene)
    const kinds = this._zoneKinds(zone).map((kind) => KINDS.find((k) => k.kind === kind));
    // Ohne eingerichteten Dienst bleibt "HealthCheck melden" sichtbar, aber ausgegraut mit kurzem Hinweis (Wunsch des Nutzers, 1.83.0): so sieht man, dass es das gibt
    const noHc = !this._hcItems().length;
    const dlg = this._dlg();
    this.host._setHtml(dlg, `<div class="ag-dlg-body"><h3>${esc(this._t("stepPick"))}</h3><div class="ag-kinds">${kinds.map((k) => (k.kind === "healthcheck" && noHc
      ? `<button class="ag-kind ag-kind-off" data-kind="healthcheck" disabled aria-disabled="true"><span class="ag-wf-icon k-${k.kind}">${ic(k.icon, 22)}</span><b>${esc(this._t(k.label))}</b><small>${esc(this._t(k.hint))}</small><em class="ag-kind-note">${esc(this._t("stepHealthcheckOff"))}</em></button>`
      : `<button class="ag-kind" data-wf="kind" data-kind="${k.kind}"><span class="ag-wf-icon k-${k.kind}">${ic(k.icon, 22)}</span><b>${esc(this._t(k.label))}</b><small>${esc(this._t(k.hint))}</small></button>`)).join("")}</div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-wf="close">${esc(this._t("cancel"))}</button></div></div>`);
    dlg.showModal();
  }

  // Einrichtungsassistent (1.69.0, "Schnell hinzufügen", Entscheid des Nutzers: Sirene und Alarmton): öffnet das Fenster eines neuen Schritts am
  // Ende des Alarms, vorbelegt; das Gerät oder den Lautsprecher wählt man selbst, gespeichert wird wie jeder Schritt
  quickAdd(kind) {
    if (!this.ensureDraft() || this.trigger === "monitor") return;
    this.edit = { insert: this.steps("main").length, index: null, form: null, q: "", error: "", open: false, zone: "main" };
    const form = kind === "siren"
      ? { ...blank(), kind: "device", action: "on", domain: "siren", restore: true, undoOn: true, undoSeconds: 180 }
      : { ...blank(), kind: "sound", restore: true, playSeconds: 180 };
    this.openEditor(form);
  }

  openEditor(form) {
    this.edit.form = form;
    this.renderEditor();
    if (!this._dlg().open) this._dlg().showModal();
  }

  // ----- Editor -----

  // Einfaches Feld mit Beschriftung (innerhalb eines Kapitels)
  _ef(label, body, hint = "") {
    return `<div class="ag-ef"><div class="ag-ef-l">${esc(this._t(label))}</div>${hint ? `<div class="ag-ef-h">${esc(this._t(hint))}</div>` : ""}${body}</div>`;
  }

  // Kapitel im Dialog (Design-Regel "Kapitel"): Titel mit Strich davor, darunter die Karte
  _sec(title, body, hint = "") {
    return `<section class="ag-chap ag-chap-s"><h4 class="ag-sec-t">${esc(this._t(title))}</h4>${hint ? `<p class="ag-chap-h">${esc(this._t(hint))}</p>` : ""}<div class="ag-card ag-efcard">${body}</div></section>`;
  }

  _field(label, body, hint = "") {
    return this._sec(label, body, hint);
  }

  _toggle(attr, on, label) {
    return `<button class="ag-toggle ${on ? "on" : ""}" ${attr} role="switch" aria-checked="${on}" aria-label="${esc(this._t(label))}"></button>`;
  }

  // Nicht abwarten: der nächste Schritt startet sofort; sinnvoll für lange Töne und träge Geräte
  // "Warten, bis die Aktion beendet ist": aus ist der Standard (der nächste Schritt startet sofort)
  _waitRow(f) {
    if (!["device", "sound", "chime", "dechime", "prealarm", "scene", "custom", "group"].includes(f.kind)) return "";
    const endlessGroup = f.kind === "group" && f.gMode === "until_disarmed";
    const fixed = (f.kind === "sound" && f.until) || ((f.kind === "chime" || f.kind === "prealarm") && f.delay) || endlessGroup;
    return `<div class="ag-ef ag-ef-row"><div class="ag-settx"><b>${esc(this._t("fldWait"))}</b><small>${esc(this._t(fixed ? (endlessGroup ? "grpFlowUntil" : (f.kind === "chime" || f.kind === "prealarm") && f.delay ? "wfFlowDelay" : "wfFlowUntil") : "fldWaitHint"))}</small></div>${this._toggle(`data-wf="waitend"${fixed ? " disabled" : ""}`, f.wait && !fixed, "fldWait")}</div>`;
  }

  // "Rückgängig" gibt es nur im Ablauf beim Alarm: nach dem Quittieren folgt nichts mehr, das etwas zurückstellen könnte
  _restoreRow(f) {
    const zone = baseZone(this.edit?.zone);
    // Töne ausserhalb des Alarmablaufs (Aktivierungston, Voralarm, Alarmton nach dem Quittieren oder beim Scharfschalten) stellen den
    // Lautsprecher nach dem Ton selbst zurück; Standard an, je Schritt abschaltbar (1.26.0)
    if (isShortTone(f.kind) || (f.kind === "sound" && zone !== "main")) {
      return `<div class="ag-ef ag-ef-row"><div class="ag-settx"><b>${esc(this._t("fldRestoreTone"))}</b><small>${esc(this._t("fldRestoreToneHint"))}</small></div>${this._toggle('data-wf="restore"', f.restore, "fldRestoreTone")}</div>${this._waitRow(f)}`;
    }
    const row = zone !== "main" ? "" : `<div class="ag-ef ag-ef-row"><div class="ag-settx"><b>${esc(this._t("fldRestore"))}</b><small>${esc(this._t(f.kind === "sound" ? "fldRestoreSoundHint" : "fldRestoreHint"))}</small></div>${this._toggle('data-wf="restore"', f.restore, "fldRestore")}</div>`;
    return `${row}${this._waitRow(f)}${this._undoRow(f)}`;
  }

  // "Danach wieder rückgängig machen" (1.37.0): Gerät schalten, zum Beispiel eine Steckdose mit Sirene: ein, nach N Sekunden aus
  _undoRow(f) {
    if (f.kind !== "device" || !UNDO_SERVICES[toStep(f, this.edit?.zone || "main").action?.split(".")[1]]) return "";
    const domains = [...new Set(f.targets.map((e) => e.split(".")[0]))];
    const back = UNDO_ACTION[f.action];
    const label = this._t(cap(domains.length === 1 ? domains[0] : "", back));
    const head = `<div class="ag-ef ag-ef-row"><div class="ag-settx"><b>${esc(this._t("fldUndo"))}</b><small>${esc(this._t("fldUndoHint", { action: label }))}</small></div>${this._toggle('data-wf="undo"', f.undoOn, "fldUndo")}</div>`;
    // In einer Gruppe gilt je Gerät nur ein vorgemerktes Zurückschalten: jede Runde beginnt die Zeit neu (1.60.0)
    const group = inGroup(this.edit?.zone) ? `<div class="ag-ef-h ag-undo-group">${esc(this._t("fldUndoGroupHint"))}</div>` : "";
    if (!f.undoOn) return head;
    const quick = [10, 30, 60, 120, 300].map((s) => `<button class="ag-chip ${Number(f.undoSeconds) === s ? "on" : ""}" data-wf="undosecs" data-value="${s}">${esc(fmtDur(s))}</button>`).join("");
    return `${head}<div class="ag-ef"><div class="ag-ef-l">${esc(this._t("fldUndoAfter"))}</div><span class="ag-num"><input type="number" min="1" max="3600" data-wf="f" data-key="undoSeconds" value="${esc(f.undoSeconds)}" aria-label="${esc(this._t("fldUndoAfter"))}"><span class="ag-t2">s</span></span><div class="ag-zline">${quick}</div>${group}</div>`;
  }

  _rangeRow(attr, label, value, min, max, step, text) {
    return `<div class="ag-ef-range"><label><span>${esc(label)}</span><b class="ag-ef-val">${esc(text)}</b></label><input type="range" class="ag-range" ${attr} min="${min}" max="${max}" step="${step}" value="${esc(value)}" aria-label="${esc(label)}"></div>`;
  }

  _deviceFields(f) {
    const domains = [...new Set(f.targets.map((e) => e.split(".")[0]))];
    const single = domains.length === 1 ? domains[0] : null;
    const actions = f.targets.length ? Object.keys(single ? DEVICE[single] : MIXED) : [];
    if (actions.length && !actions.includes(f.action)) f.action = actions[0];
    const picker = actions.length
      ? `<div class="ag-actions">${actions.map((a) => `<button class="ag-act ${f.action === a ? "on" : ""}" data-wf="action" data-value="${a}" aria-pressed="${f.action === a}">${ic(ACTION_ICON[a], 18)}${esc(this._t(cap(single || "", a)))}</button>`).join("")}</div>`
      : `<div class="ag-t2 ag-small">${esc(this._t("fldChooseFirst"))}</div>`;
    let options = "";
    if (f.action === "on" && domains.length > 1) options = `<div class="ag-t2 ag-small">${esc(this._t("optsMixed"))}</div>`;
    if (f.action === "on" && single) {
      options = deviceOptions(this.states, f.targets).map((sp) => {
        const on = !!f.optsOn[sp.key];
        const label = this._t(sp.label);
        let control = "";
        if (on) {
          const val = f.opts[sp.key] ?? (sp.type === "choice" ? sp.values[0] : sp.min);
          if (sp.type === "choice") control = `<select class="ag-input" data-wf="opt" data-key="${sp.key}" aria-label="${esc(label)}">${sp.values.map((v) => `<option value="${esc(v)}" ${v === val ? "selected" : ""}>${esc(this._hvacLabel(v))}</option>`).join("")}</select>`;
          else control = this._rangeRow(`data-wf="opt" data-key="${sp.key}"`, label, val, sp.min, sp.max, sp.step || 1, this._optText(sp.key, val));
        }
        return `<div class="ag-opt"><div class="ag-ef-row"><div class="ag-settx"><b>${esc(label)}</b>${on ? "" : `<small>${esc(this._t("optUnchanged"))}</small>`}</div>${this._toggle(`data-wf="opt-on" data-key="${sp.key}"`, on, sp.label)}</div>${control}</div>`;
      }).join("");
    }
    return this._field("fldDevices", this._combo(Object.keys(DEVICE), f, "fldSearchDevice"))
      + this._field("fldAction", picker)
      + (options ? this._field("optsTitle", options) : "")
      + this._restoreRow(f);
  }

  _hvacLabel(mode) {
    const key = `hvac_${mode}`;
    const text = this._t(key);
    return text === key ? mode : text;
  }

  _soundFields(f) {
    // Jede Art bietet ihre eigenen Klänge an; ein früher gewählter Klang einer anderen Art bleibt wählbar, solange er eingestellt ist
    const all = [...(this.host._data?.sounds || []), ...(this.host._data?.prealarms || []), ...(this.host._data?.chimes || []), ...(this.host._data?.dechimes || [])];
    const own = this.host._data?.[TONE_LIST[f.kind] || "sounds"] || [];
    const sounds = own.some((s) => s.id === f.sound) ? own : [...own, ...all.filter((s) => s.id === f.sound)];
    const custom = customList(this.host);
    const current = sounds.find((s) => s.id === f.sound) || custom.find((s) => s.id === f.sound);
    const play = Boolean(this.previewing && current && this.previewing === current.url);
    // Eigene Töne (1.39.0): für jede Art wählbar; ein Ton, dessen Datei fehlt, bleibt sichtbar ausgewählt ("fehlt"), der Alarm spielt dann den Standardton
    const missing = isCustom(f.sound) && !custom.some((s) => s.id === f.sound) ? `<option value="${esc(f.sound)}" selected>${esc(this._t("customMissing"))}</option>` : "";
    const customGroup = `<optgroup label="${esc(this._t("customTones"))}">${custom.map((s) => `<option value="${esc(s.id)}" ${s.id === f.sound ? "selected" : ""}>${esc(s.name)}</option>`).join("")}${missing}<option value="__upload">${esc(this._t("uploadOption"))}</option></optgroup>`;
    const upload = this.edit?.upload ? `<div class="ag-up-box">${uploadHtml((k, v) => this._t(k, v), this.host, this.edit.upload, (name) => `data-wf="${name}"`)}</div>` : "";
    const tone = `<div class="ag-tone"><select class="ag-input" data-wf="f" data-key="sound" aria-label="${esc(this._t("fldTone"))}">${sounds.map((s) => `<option value="${s.id}" ${s.id === f.sound ? "selected" : ""}>${esc(this._t(SOUND_KEY[s.id] || s.id))}</option>`).join("")}${customGroup}</select>
        <div class="ag-pv" role="group" aria-label="${esc(this._t("pvNote"))}">
          ${play
            ? `<button class="ag-iconbtn ag-running" data-wf="pv-stop" aria-label="${esc(this._t("pvStop"))}" title="${esc(this._t("pvStop"))}">${ic("stop", 18)}</button>`
            : `<button class="ag-iconbtn" data-wf="pv-play" data-url="${esc(current?.url || "")}" aria-label="${esc(this._t("pvPlay"))}" title="${esc(this._t("pvPlay"))}">${ic("play", 18)}</button>`}</div></div>
      <div class="ag-pv-note">${ic("info", 14)} ${esc(this._t("pvNote"))}</div>${this.edit?.uploaded && this.edit.uploaded === f.sound ? `<div class="ag-unsaved ag-unsaved-note">${esc(this._t("upStepUnsaved"))}</div>` : ""}${upload}`;
    const volume = `<div class="ag-ef-row"><div class="ag-settx"><b>${esc(this._t("fldVolumeSet"))}</b>${f.setVolume ? "" : `<small>${esc(this._t("fldVolumeKeep"))}</small>`}</div>${this._toggle('data-wf="setvol"', f.setVolume, "fldVolumeSet")}</div>
      ${f.setVolume && !(f.perVolume && f.targets.length > 1) ? this._rangeRow('data-wf="volume"', this._t("fldVolume"), Math.round(f.volume * 100), 0, 100, 5, `${Math.round(f.volume * 100)} %`) : ""}
      ${f.setVolume && f.targets.length > 1 ? `<div class="ag-ef-row ag-pervol"><div class="ag-settx"><b>${esc(this._t("fldVolumePer"))}</b><small>${esc(this._t("fldVolumePerHint"))}</small></div>${this._toggle('data-wf="pervol"', f.perVolume, "fldVolumePer")}</div>` : ""}
      ${f.setVolume && f.perVolume && f.targets.length > 1 ? f.targets.map((id) => { const v = Math.round(Number(f.volumes?.[id] ?? f.volume) * 100); return this._rangeRow(`data-wf="pvol" data-ent="${esc(id)}"`, this.host._hass?.states?.[id]?.attributes?.friendly_name || id, v, 0, 100, 5, `${v} %`); }).join("") : ""}`;
    return this._field("fldPlayers", this._combo(["media_player"], f, "fldSearchPlayer"))
      + this._field("fldTone", tone)
      + this._field("fldVolume", volume)
      + this._field("fldPlayFor", this._playFor(f) + ((f.kind === "chime" || f.kind === "dechime") && !f.delay ? `<div class="ag-pv-note">${ic("info", 14)} ${esc(this._t("fldChimeFor"))}</div>` : ""))
      + this._restoreRow(f);
  }

  // Dauer des Alarmtons: Sekunden oder "bis zum Deaktivieren"
  _playFor(f) {
    const zone = this.edit?.zone;
    if (DELAY_ZONES.includes(zone) && isShortTone(f.kind)) {
      // So lange wie die Verzögerung (1.19.0): ein Schalter; die feste Dauer gilt nur, wenn er aus ist
      const part = zone === "arming" ? "Arming" : "Entry";
      const follow = `<div class="ag-ef-row ag-delayfollow"><div class="ag-settx"><b>${esc(this._t(`fldDelay${part}`))}</b><small>${esc(this._t(`fldDelay${part}Hint`, { n: fmtDur(this._delaySeconds(zone)) }))}</small></div>${this._toggle('data-wf="delay"', f.delay, `fldDelay${part}`)}</div>`;
      if (f.delay) return `${follow}<div class="ag-delayfixed"><span class="ag-num"><input type="number" disabled value="${esc(this._delaySeconds(zone))}" aria-label="${esc(this._t("fldPlayFor"))}"><span class="ag-t2">s</span></span></div><div class="ag-ef-h">${esc(this._t("fldDelayFixedHint"))}</div>`;
      return follow + this._playForFixed(f);
    }
    return this._playForFixed(f);
  }

  _playForFixed(f) {
    // Nach dem Quittieren gibt es "bis zum Deaktivieren" nicht: niemand deaktiviert danach, der Ton braucht eine Dauer
    const until = baseZone(this.edit?.zone) !== "main" || isShortTone(f.kind) ? "" : `<div class="ag-ef-row"><div class="ag-settx"><b>${esc(this._t("fldPlayUntil"))}</b><small>${esc(this._t("fldPlayUntilHint"))}</small></div>${this._toggle('data-wf="until"', f.until, "fldPlayUntil")}</div>`;
    if (f.until) return until;
    const quick = [10, 30, 60, 300].map((s) => `<button class="ag-chip ${Number(f.playSeconds) === s ? "on" : ""}" data-wf="playsecs" data-value="${s}">${esc(fmtDur(s))}</button>`).join("");
    return `<span class="ag-num"><input type="number" min="1" max="3600" data-wf="f" data-key="playSeconds" value="${esc(f.playSeconds)}" aria-label="${esc(this._t("fldPlayFor"))}"><span class="ag-t2">s</span></span>
      <div class="ag-zline">${quick}</div><div class="ag-ef-h">${esc(this._t("fldPlayForHint"))}</div>${until}`;
  }

  // Titel und Text der Push-Meldung: der Standardtext steht im Feld und lässt sich ändern; Platzhalter füllt der Server beim Alarm
  _notifyFields(f) {
    const [dt, dm] = this._ntDefaults(f);
    const notice = f.kind === "notice";
    const tokens = notice ? NOTICE_TOKENS[f.nKind] : NOTIFY_TOKENS;
    const chips = tokens.map((tok) => `<button type="button" class="ag-chip" data-wf="ins" data-token="${esc(tok)}">${esc(tok)}<small>${esc(this._t(`ntTok_${tok.slice(1, -1)}`))}</small></button>`).join("");
    return `${notice || f.kind === "end" ? "" : `<div class="ag-t2">${esc(this._t("stepNotifyHint"))}</div>`}
      ${this._sec("chapNtContent", `${this._ef("fldNtTitle", `<input class="ag-input" data-wf="f" data-key="ntTitle" maxlength="100" value="${esc(f.ntTitle || dt)}" aria-label="${esc(this._t("fldNtTitle"))}">`, f.kind === "end" || notice ? "" : "fldNtTitleHint")}
      ${this._ef("fldNtMessage", `<textarea class="ag-input" rows="3" data-wf="f" data-key="ntMessage" maxlength="300" aria-label="${esc(this._t("fldNtMessage"))}">${esc(f.ntMessage || dm)}</textarea>`)}
      ${this._ef("fldNtTokens", `<div class="ag-zline">${chips}</div>`, notice ? "ntcTokensHint" : "fldNtTokensHint")}
      ${this._ef("fldNtPreview", `<div class="ag-ntprev" id="ag-ntprev">${this._ntPreview(f)}</div>
        <div><button type="button" class="ag-btn" data-wf="nt-default">${ic("undo", 16)}${esc(this._t("fldNtDefault"))}</button></div>`)}`)}
      ${this._ntDelivery(f)}`;
  }

  // Standardtext der Meldung: Alarm oder "Alarm endet" (eigener Text, nie kritisch)
  _ntDefaults(f) {
    if (f.kind === "notice") return [this._t(`ntcDefTitle_${f.nKind}`), this._t(`ntcDefMsg_${f.nKind}`)];
    return f.kind === "end" ? [this._t("ntEndDefaultTitle"), this._t("ntEndDefaultMessage")] : [this._t("ntDefaultTitle"), this._t("ntDefaultMessage")];
  }

  // Wirksame Werte der Alarmmeldung: aus dem Schritt, sonst der frühere globale Wert (so ändert sich bei bestehenden Schritten nichts)
  _ntGlobal() {
    const g = this.host._data?.notify || {};
    return { critical: g.types?.triggered?.critical ?? true, volume: g.types?.triggered?.volume ?? 0.8, open: g.open_action ?? true, silence: g.silence_action ?? false, acknowledge: g.acknowledge_action ?? true, disarm: g.disarm_action ?? false };
  }

  // Empfänger der Meldung: Standard sind die Alarm-Empfänger der Konfiguration; hier lassen sie sich für diese Meldung ersetzen
  _ntRecipients(f) {
    const short = (x) => x.replace(/^notify\.(mobile_app_)?/, "");
    const data = this.host._data || {};
    const services = data.notify_services || [];
    const globalTargets = data.notify?.alarm_targets || [];
    const own = Array.isArray(f.ntTargets);
    const pill = (x, removable) => `<span class="ag-rpill ${services.includes(x) ? "" : "gone"}">${ic("bell", 14)}<span>${esc(short(x))}</span>${removable ? `<button type="button" class="ag-rx" data-wf="nt-tgt-del" data-target="${esc(x)}" aria-label="${esc(this._t("ntRemove", { name: short(x) }))}">${ic("close", 14)}</button>` : ""}</span>`;
    let body;
    if (!own) {
      body = globalTargets.length
        ? `<small>${esc(this._t("fldNtTargetsDefault"))}</small><div class="ag-rpills">${globalTargets.map((x) => pill(x, false)).join("")}</div>`
        : `<small class="ag-warntext">${ic("alert", 14)} ${esc(this._t("ntNoneChosen"))}</small>`;
    } else {
      const free = services.filter((x) => !f.ntTargets.includes(x));
      body = `<div class="ag-rline"><select class="ag-input ag-rsel" data-wf="nt-tgt-add" aria-label="${esc(this._t("ntAdd"))}" ${free.length ? "" : "disabled"}>
          <option value="">${esc(this._t(free.length ? "ntAdd" : "ntAllChosen"))}</option>${free.map((x) => `<option value="${esc(x)}">${esc(short(x))}</option>`).join("")}</select></div>
        ${f.ntTargets.length ? `<div class="ag-rpills">${f.ntTargets.map((x) => pill(x, true)).join("")}</div>` : `<small>${esc(this._t("fldNtTargetsEmpty"))}</small>`}`;
    }
    return this._sec("fldNtTargets", `<div class="ag-ef-row"><div class="ag-settx"><b>${esc(this._t("fldNtTargetsOwn"))}</b><small>${esc(this._t("fldNtTargetsOwnHint"))}</small></div>${this._toggle('data-wf="nt-tgt-own"', own, "fldNtTargetsOwn")}</div>${body}`);
  }

  _ntDelivery(f) {
    const g = this._ntGlobal();
    const notice = f.kind === "notice";
    const end = f.kind === "end" || notice; // beide ohne die Knöpfe der Alarmmeldung
    const critical = f.ntCritical ?? (end ? false : g.critical);
    const volume = Math.round((f.ntVolume ?? g.volume) * 100);
    const btn = (key, label, hint, warn) => {
      const on = f.ntButtons?.[key] ?? g[key];
      return `<div class="ag-ef-row"><div class="ag-settx"><b>${esc(this._t(label))}</b><small class="${warn ? "ag-warntext" : ""}">${warn ? `${ic("alert", 14)} ` : ""}${esc(this._t(hint))}</small></div>${this._toggle(`data-wf="nt-btn" data-key="${key}"`, on, label)}</div>`;
    };
    return this._ntRecipients(f)
      + this._sec("fldNtDelivery", `<div class="ag-ef-row"><div class="ag-settx"><b>${esc(this._t("ntCriticalShort"))}</b><small>${esc(this._t("fldNtCriticalHint"))}</small></div>${this._toggle('data-wf="nt-crit"', critical, "ntCriticalShort")}</div>
        ${critical ? this._rangeRow('data-wf="nt-vol"', this._t("ntVolumeShort"), volume, 0, 100, 5, `${volume} %`) : ""}
        ${notice ? `<div class="ag-ef-row"><div class="ag-settx"><b>${esc(this._t("ntPersistent"))}</b><small>${esc(this._t("ntPersistentHint"))}</small></div>${this._toggle('data-wf="notice-persist"', f.ntPersistent, "ntPersistent")}</div>` : ""}`)
      + this._sec("fldNtClick", `<select class="ag-input" data-wf="nt-click" aria-label="${esc(this._t("fldNtClick"))}">${["log", "overview", "custom"].map((k) => `<option value="${k}" ${(f.ntClick || (notice ? "overview" : "log")) === k ? "selected" : ""}>${esc(this._t(`ntClick_${k}`))}</option>`).join("")}</select>
        ${f.ntClick === "custom" ? `<input class="ag-input ag-mono" data-wf="f" data-key="ntClickPath" value="${esc(f.ntClickPath || "")}" placeholder="/lovelace/alarm" aria-label="${esc(this._t("ntClick_custom"))}" autocapitalize="off" autocomplete="off" spellcheck="false">` : ""}`, "fldNtClickHint")
      + (end ? "" : this._sec("fldNtButtons", `${btn("open", "ntOpenAction", "ntOpenActionHint", false)}${btn("silence", "ntSilenceAction", "ntSilenceActionHint", true)}${btn("acknowledge", "ntAckAction", "ntAckActionHint", true)}${btn("disarm", "ntDisarmAction", "ntDisarmActionHint", true)}`));
  }

  // Vorschau mit echten Namen der Anlage und eines Sensors, so wie die Meldung aussähe
  _ntPreview(f) {
    const s = this.system;
    const sensorId = Object.values(s?.zones || {}).flat()[0];
    // Art und Bereich des ersten Sensors; unbekannte Klassen bleiben leer (wie auf dem Server), die Alarmart fällt auf "Alarm" zurück
    const info = sensorId ? this.host._sensor(sensorId) || {} : {};
    const dc = info.device_class || "";
    const typeKey = `ntType_${dc}`;
    // In einem Durchgang wie auf dem Server (notify.py PLACEHOLDER): ein eingesetzter Wert, etwa der Name einer Anlage, wird nie selbst
    // noch einmal ersetzt. Alles andere in geschweiften Klammern bleibt wie geschrieben.
    const values = {
      "{name}": s?.title || "",
      "{sensor}": sensorId ? this.host._name(sensorId) : "",
      "{type}": this._t(typeKey) === typeKey ? "" : this._t(typeKey),
      "{area}": info.area || "",
      "{time}": new Date().toLocaleTimeString(this.host._hass?.locale?.language || this.host._lang, { hour: "2-digit", minute: "2-digit" }),
      "{mode}": this._t(MODE_KEY[this.trigger] || "modeAway"),
      "{alarm}": this._t(`ntAlarm_${ALARM_KINDS[dc] || "alarm"}`),
      // Nur in den festen Meldungen (1.62.0): wer geschaltet hat (hier der angemeldete Benutzer) und die Zeit der Eingangsverzögerung
      "{person}": f.kind === "notice" ? this.host._hass?.user?.name || "" : "",
      "{delay}": f.kind === "notice" && f.nKind === "pending" ? fmtDur(this._delaySeconds("entry")) : "",
    };
    const fill = (text) => text.replace(/\{(?:name|sensor|type|area|time|mode|alarm|person|delay)\}/g, (token) => values[token]);
    const [dt, dm] = this._ntDefaults(f);
    const title = fill(f.ntTitle || dt).trim();
    const message = fill(f.ntMessage || dm).trim();
    return `<b>${esc(title)}</b><div>${esc(message)}</div>`;
  }

  // Fenster der Aktions-Gruppe (1.59.0): Name, wie lange wiederholt wird (Reiterleiste), der Wert dazu und "Warten, bis ... beendet ist"
  // wie bei den anderen Schritten. "Bis deaktiviert" gibt es nur im Ablauf des Alarms.
  _groupFields(f) {
    const alarm = baseZone(this.edit?.zone) === "main";
    const modes = [["count", this._t("grpModeCount")], ["duration", this._t("grpModeDuration")], ...(alarm ? [["until_disarmed", this._t("grpModeUntil")]] : [])];
    const seg = this.host._segHtml("gmode", modes, f.gMode, 'data-wf="gmode" data-value');
    let value;
    if (f.gMode === "count") {
      value = `<div class="ag-ef"><div class="ag-ef-l">${esc(this._t("fldGrpCount"))}</div><span class="ag-num"><input type="number" min="1" max="${GROUP_MAX_ROUNDS}" data-wf="f" data-key="gCount" value="${esc(f.gCount)}" aria-label="${esc(this._t("fldGrpCount"))}"><span class="ag-t2">${esc(this._t("fldGrpCountUnit", { max: GROUP_MAX_ROUNDS }))}</span></span></div>`;
    } else if (f.gMode === "duration") {
      const quick = [30, 60, 180, 300, 600].map((sec) => `<button class="ag-chip ${Number(f.gSeconds) === sec ? "on" : ""}" data-wf="gsecs" data-value="${sec}">${esc(fmtDur(sec))}</button>`).join("");
      value = `<div class="ag-ef"><div class="ag-ef-l">${esc(this._t("fldGrpSeconds"))}</div><span class="ag-num"><input type="number" min="1" max="3600" data-wf="f" data-key="gSeconds" value="${esc(f.gSeconds)}" aria-label="${esc(this._t("fldGrpSeconds"))}"><span class="ag-t2">s</span></span><div class="ag-zline" style="margin-top:10px">${quick}</div><div class="ag-ef-h">${esc(this._t("grpDurationHint"))}</div></div>`;
    } else value = `<div class="ag-ef"><div class="ag-ef-h">${esc(this._t("grpUntilHint"))}</div></div>`;
    return `<div class="ag-t2 ag-grp-intro">${esc(this._t("grpIntro"))}</div>
      ${this._sec("fldGrpName", `<input class="ag-input" type="text" maxlength="40" data-wf="f" data-key="gName" value="${esc(f.gName || "")}" placeholder="${esc(this._t("fldGrpNamePh"))}" aria-label="${esc(this._t("fldGrpName"))}">`)}
      ${this._sec("fldGrpRepeat", `<div class="ag-ef">${seg}</div>${value}`)}
      ${this._sec("fldGrpFlow", this._waitRow(f))}`;
  }

  // ----- Aktion "HealthCheck melden" (1.77.0, Wunsch des Nutzers 2026-11-22) -----
  // Dienst aus den eingerichteten (Auswahl), Zusatz frei bearbeitbar (bei einem erkannten Dienst mit Vorschlag), die ganze Adresse nur zur Ansicht.
  // Den Alarm-Zusatz im Dienst selbst gibt es nicht mehr: je Aktion ein eigener, also je Alarmart ein anderer.

  _hcItems() {
    return this.host._data?.healthchecks || [];
  }

  _hcItem(id) {
    return this._hcItems().find((i) => i.id === id) || null;
  }

  _hcSuggestion(id) {
    const item = this._hcItem(id);
    return item ? suggest(item.url)?.alarm || "" : "";
  }

  // Neuer Schritt: der erste Dienst, bei einem erkannten gleich mit dem Vorschlag
  _hcInitial() {
    const item = this._hcItems()[0];
    return { hcId: item?.id || "", hcSuffix: item ? this._hcSuggestion(item.id) : "", hcTouched: false, hcRepeat: true, hcPause: true }; // neue Schritte: beide Schalter an (Wunsch des Nutzers, 1.80.0)
  }

  _hcAddress(f) {
    const item = this._hcItem(f.hcId);
    const suffix = String(f.hcSuffix || "").trim();
    return item && suffix && /^[/?&]\S*$/.test(suffix) ? applySuffix(item.url, suffix) : null;
  }

  // Fehlt etwas oder passt der Zusatz nicht? (Schlüssel eines Textes oder null)
  _hcProblem(f) {
    if (!this._hcItem(f.hcId)) return "fldHcNoService";
    const suffix = String(f.hcSuffix || "").trim();
    return !suffix || !/^[/?&]\S*$/.test(suffix) || suffix.length > 200 || !this._hcAddress(f) ? "fldHcBadSuffix" : null;
  }

  _hcOfferHtml(f) {
    const sug = this._hcSuggestion(f.hcId);
    if (!sug || sug === String(f.hcSuffix || "").trim()) return "";
    return `<div class="ag-hcoffer"><span class="ag-t2">${esc(this._t("hcSuggest", { name: suggest(this._hcItem(f.hcId)?.url)?.name || "", suffix: sug }))}</span><button type="button" class="ag-link" data-wf="hc-take">${esc(this._t("hcTake"))}</button></div>`;
  }

  // Beim Tippen nur Vorschlag und Vorschau nachführen, nie das Feld selbst (Fokus und Schreibmarke bleiben)
  _hcRefresh() {
    const f = this.edit?.form;
    const dlg = this._dlg();
    if (!f || f.kind !== "healthcheck") return;
    const offer = dlg.querySelector('[data-hcp="offer"]');
    if (offer) offer.innerHTML = this._hcOfferHtml(f);
    const prev = dlg.querySelector('[data-hcp="preview"]');
    const address = this._hcAddress(f);
    if (prev) {
      prev.textContent = address || this._t("fldHcPreviewNone");
      prev.classList.toggle("none", !address);
    }
    const copy = dlg.querySelector('[data-hcp="copy"]');
    if (copy) {
      copy.dataset.value = address;
      copy.hidden = !address;
    }
  }

  _healthcheckFields(f) {
    const items = this._hcItems();
    const gone = Boolean(f.hcId) && !this._hcItem(f.hcId);
    const options = `${gone ? `<option value="${esc(f.hcId)}" selected>${esc(this._t("fldHcGone"))}</option>` : ""}${items.map((i) => `<option value="${esc(i.id)}" ${i.id === f.hcId ? "selected" : ""}>${esc(i.name || i.url)}</option>`).join("")}`;
    const service = `<div class="ag-ef"><select class="ag-input" data-wf="hc-id" aria-label="${esc(this._t("fldHcService"))}">${options}</select></div>
      ${gone ? `<div class="ag-ef"><small class="ag-err ag-block">${esc(this._t("fldHcGoneHint"))}</small></div>` : ""}
      <div class="ag-ef"><button type="button" class="ag-link" data-wf="hc-open">${esc(this._t("fldHcOpen"))}</button></div>`;
    const suffix = `<div class="ag-ef"><input class="ag-input ag-mono" type="text" data-wf="hc-suffix" value="${esc(f.hcSuffix || "")}" placeholder="?state=fail&message=Alarm+triggered" maxlength="200" autocomplete="off" spellcheck="false" aria-label="${esc(this._t("fldHcSuffix"))}">
      <div class="ag-ef-h">${esc(this._t("fldHcSuffixHint"))}</div><div data-hcp="offer">${this._hcOfferHtml(f)}</div></div>`;
    // Reine Anzeige, kein Feld (Wunsch des Nutzers, 1.79.1): Text ohne Rahmen eines Eingabefelds, zum Markieren, mit Knopf zum Kopieren
    const address = this._hcAddress(f);
    const preview = `<div class="ag-ef"><div class="ag-hccall"><code class="ag-mono ag-hcpreview ${address ? "" : "none"}" data-hcp="preview">${esc(address || this._t("fldHcPreviewNone"))}</code>${copyBtn(address, this._t("fldHcCopy"), `data-wf="hc-copy" data-hcp="copy" ${address ? "" : "hidden"}`)}</div><div class="ag-ef-h">${esc(this._t("fldHcPreviewHint"))}</div></div>`;
    // Nur im Ablauf des Alarms (1.80.0): Meldung wiederholen und die Lebenszeichen pausieren, beides bis der Alarm endet. Der Abstand der Wiederholung ist der des
    // Dienstes (nie einstellbar), damit beim Anbieter nichts angepasst werden muss.
    const every = fmtDur(this._hcItem(f.hcId)?.interval || 0);
    const row = (key, attr, on) => `<div class="ag-ef-row"><div class="ag-settx"><b>${esc(this._t(key))}</b><small>${esc(this._t(`${key}Hint`, { every }))}</small></div>${this._toggle(attr, on, key)}</div>`;
    const hold = baseZone(this.edit?.zone) === "main"
      ? this._sec("fldHcWhile", `${row("fldHcRepeat", 'data-wf="hc-repeat"', f.hcRepeat)}${row("fldHcPause", 'data-wf="hc-pause"', f.hcPause)}`)
      : "";
    return `<div class="ag-t2 ag-grp-intro">${esc(this._t("fldHcIntro"))}</div>
      ${this._sec("fldHcService", service)}
      ${this._sec("fldHcSuffix", suffix)}
      ${this._sec("fldHcPreview", preview)}
      ${hold}`;
  }

  _waitFields(f) {
    const quick = [10, 30, 60, 300].map((s) => `<button class="ag-chip ${Number(f.seconds) === s ? "on" : ""}" data-wf="secs" data-value="${s}">${esc(fmtDur(s))}</button>`).join("");
    return this._field("fldDuration", `<span class="ag-num"><input type="number" min="0" max="3600" data-wf="f" data-key="seconds" value="${esc(f.seconds)}" aria-label="${esc(this._t("fldSeconds"))}"><span class="ag-t2">s</span></span><div class="ag-zline" style="margin-top:10px">${quick}</div>`);
  }

  _sceneFields(f) {
    const options = SCENE_DOMAINS.map((d) => [d, this._entitiesAll([d])]).filter(([, list]) => list.length)
      .map(([d, list]) => `<optgroup label="${esc(this._t(d === "scene" ? "grpScenes" : "grpScripts"))}">${list.map((e) => `<option value="${esc(e.id)}" ${f.targets[0] === e.id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</optgroup>`).join("");
    return this._field("fldSceneScript", options
      ? `<select class="ag-input" data-wf="scene" aria-label="${esc(this._t("fldSceneScript"))}"><option value="">${esc(this._t("fldChoose"))}</option>${options}</select>`
      : `<div class="ag-t2 ag-small">${esc(this._t("fldNoEntities"))}</div>`);
  }

  // Durchsuchbares Auswahlfeld (tippen filtert): Art und Aktion bei "Eigene Aktion"; die Listen sind lang
  _cbItems(key, f) {
    const services = this._services();
    const q = (this.edit?.cb?.key === key ? this.edit.cb.q : "").trim().toLowerCase();
    const items = key === "domain"
      ? Object.keys(services).filter((d) => Object.keys(services[d] || {}).length).map((d) => ({ value: d, label: this._domainName(d) }))
      : Object.keys(services[f.domain] || {}).map((s) => ({ value: s, label: this._serviceName(f.domain, s) }));
    items.sort((x, y) => x.label.localeCompare(y.label));
    const shown = items.filter((it) => !q || it.label.toLowerCase().includes(q) || it.value.toLowerCase().includes(q));
    if (!shown.length) return `<div class="ag-t2 ag-small ag-combo-more">${esc(this._t("fldNoMatch"))}</div>`;
    const cur = key === "domain" ? f.domain : f.service;
    return shown.map((it) => `<button type="button" class="ag-combo-item ${it.value === cur ? "cur" : ""}" role="option" data-wf="cb-pick" data-key="${key}" data-value="${esc(it.value)}"><span>${esc(it.label)}</span><small>${esc(key === "domain" ? it.value : `${f.domain}.${it.value}`)}</small></button>`).join("");
  }

  _cbox(key, f, label) {
    const cur = key === "domain" ? f.domain : f.service;
    const text = !cur ? "" : key === "domain" ? this._domainName(cur) : this._serviceName(f.domain, cur);
    const disabled = key === "service" && !f.domain;
    return `<div class="ag-combo ag-cbox"><label class="ag-search ${disabled ? "off" : ""}">${ic("search", 18)}<input type="search" data-wf="cb" data-key="${key}" value="${esc(text)}" placeholder="${esc(this._t("fldChoose"))}" autocomplete="off" aria-label="${esc(label)}" ${disabled ? "disabled" : ""}>${ic("chevRight", 16)}</label>
      <div class="ag-combo-list" role="listbox">${this._cbItems(key, f)}</div></div>`;
  }

  _customFields(f) {
    const services = this._services();
    const domains = Object.keys(services).filter((d) => Object.keys(services[d] || {}).length).sort();
    if (!domains.length) return `<div class="ag-t2">${esc(this._t("fldNoServices"))}</div>`;
    const dom = this._cbox("domain", f, this._t("fldKind"));
    const srv = this._cbox("service", f, this._t("fldAction"));
    const meta = services[f.domain]?.[f.service];
    let html = this._field("fldKind", dom) + this._field("fldAction", srv + (this._serviceDesc(f.domain, f.service) ? `<div class="ag-ef-h" style="margin-top:6px">${esc(this._serviceDesc(f.domain, f.service))}</div>` : ""));
    if (!meta) return html + this._restoreRow(f);
    if (meta.target) html += this._field("fldDevices", this._combo(this._domainsOf(f), f, "fldSearchDevice"));
    const fields = Object.entries(flatFields(meta.fields));
    const req = fields.filter(([, fd]) => fd.required);
    const opt = fields.filter(([, fd]) => !fd.required);
    html += req.map(([k, fd]) => this._dataField(k, fd, f)).join("");
    if (opt.length) html += `<details class="ag-more" ${opt.some(([k]) => f.data[k] != null && f.data[k] !== "") ? "open" : ""}><summary>${esc(this._t("fldMoreSettings"))}</summary>${opt.map(([k, fd]) => this._dataField(k, fd, f)).join("")}</details>`;
    // Werte aus einem früheren Schritt, die zu keinem Feld passen, bleiben erhalten und werden nur genannt
    const known = new Set(fields.map(([k]) => k));
    const extra = Object.entries(f.extra).filter(([k]) => !known.has(k));
    if (extra.length) html += `<div class="ag-ef-h">${esc(this._t("fldExtra"))}: ${esc(extra.map(([k, v]) => `${k}: ${typeof v === "object" ? "…" : v}`).join(", "))}</div>`;
    return html + this._restoreRow(f);
  }

  _dataField(key, fd, f) {
    const type = selectorType(fd);
    const val = f.data[key];
    const sel = fd.selector?.[type] || {};
    const name = this._fieldName(f, key, fd);
    const desc = this._fieldDesc(f, key, fd);
    const attr = `data-wf="df" data-key="${esc(key)}" data-type="${type}"`;
    let control;
    if (!SIMPLE_SELECTORS.includes(type) || (type === "select" && sel.multiple) || (type === "entity" && sel.multiple)) {
      control = `<div class="ag-t2 ag-small">${ic("info", 14)} ${esc(this._t("fldUnsupported"))}</div>`;
    } else if (type === "boolean") {
      control = `<div class="ag-ef-row"><span class="ag-t2">${esc(desc)}</span>${this._toggle(`${attr} data-bool`, !!val, "fldValue")}</div>`;
    } else if (type === "number" || type === "color_temp") {
      const min = sel.min ?? sel.min_kelvin ?? "";
      const max = sel.max ?? sel.max_kelvin ?? "";
      const slider = sel.mode === "slider" && min !== "" && max !== "";
      const shown = val ?? fd.default ?? min;
      control = slider
        ? this._rangeRow(attr, name, shown, min, max, sel.step || 1, `${shown}${sel.unit_of_measurement ? ` ${sel.unit_of_measurement}` : ""}`)
        : `<span class="ag-num"><input type="number" ${attr} min="${min}" max="${max}" step="${sel.step || "any"}" value="${esc(val ?? "")}" placeholder="${esc(fd.default ?? "")}" aria-label="${esc(name)}"><span class="ag-t2">${esc(sel.unit_of_measurement || "")}</span></span>`;
    } else if (type === "select") {
      control = `<select class="ag-input" ${attr} aria-label="${esc(name)}"><option value="">${esc(this._t("fldChoose"))}</option>${normalizeOptions(sel.options).map((o) => `<option value="${esc(o.value)}" ${String(val) === o.value ? "selected" : ""}>${esc((sel.translation_key && this._tr(`component.${f.domain}.selector.${sel.translation_key}.options.${o.value}`)) || o.label)}</option>`).join("")}</select>`;
    } else if (type === "entity") {
      const list = this._entitiesAll([].concat(sel.domain || []));
      control = list.length <= 250
        ? `<select class="ag-input" ${attr} aria-label="${esc(name)}"><option value="">${esc(this._t("fldChoose"))}</option>${list.map((e) => `<option value="${esc(e.id)}" ${val === e.id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select>`
        : `<input class="ag-input" ${attr} value="${esc(val ?? "")}" aria-label="${esc(name)}">`;
    } else {
      control = `<input class="ag-input" ${attr} value="${esc(val ?? "")}" placeholder="${esc(fd.example ?? "")}" aria-label="${esc(name)}">`;
    }
    return `<div class="ag-ef"><div class="ag-ef-l">${esc(name)}${fd.required ? ` <span class="ag-req">${esc(this._t("fldRequired"))}</span>` : ""}</div>${desc && type !== "boolean" ? `<div class="ag-ef-h">${esc(desc)}</div>` : ""}${control}</div>`;
  }

  renderEditor() {
    const f = this.edit.form;
    if (this.edit.snap === undefined) this.edit.snap = JSON.stringify(f); // Stand beim Öffnen: Abbrechen fragt nur bei echten Änderungen
    const k = f.kind === "end" ? { kind: "end", icon: "check", label: "wfEnd" } : f.kind === "notice" ? { kind: "notify", icon: "bell", label: `ntc_${f.nKind}` } : KINDS.find((x) => x.kind === f.kind);
    let fields;
    if (f.kind === "end") fields = this._endFields(f);
    else if (f.kind === "notice") fields = this._noticeFields(f);
    else if (f.kind === "notify") fields = this._notifyFields(f);
    else if (f.kind === "device") fields = this._deviceFields(f);
    else if (isTone(f.kind)) fields = this._soundFields(f);
    else if (f.kind === "wait") fields = this._waitFields(f);
    else if (f.kind === "healthcheck") fields = this._healthcheckFields(f);
    else if (f.kind === "acknowledge") fields = `<div class="ag-t2">${esc(this._t("fldAckHint"))}</div>`;
    else if (f.kind === "group") fields = this._groupFields(f);
    else if (f.kind === "scene") fields = this._sceneFields(f);
    else fields = this._customFields(f);
    this.host._setHtml(this._dlg(), `<div class="ag-dlg-body ag-step-ed"><div class="ag-sys-top"><span class="ag-wf-icon k-${k.kind}">${ic(k.icon, 22)}</span><h3>${esc(this._t(k.label))}</h3></div>
      ${fields}<div class="ag-dlg-err" aria-live="polite">${esc(this.edit.error || "")}</div>
      <div class="ag-dlg-btns"><button class="ag-btn" data-wf="close">${esc(this._t("cancel"))}</button><button class="ag-btn primary" data-wf="apply">${esc(this._t("apply"))}</button></div></div>`);
    if (f.kind === "group") this.host._placePills?.(); // Kapsel der Reiterleiste "Wie lange wiederholen?"
  }

  apply() {
    const f = this.edit.form;
    if (f.kind === "end") return this._endApply();
    if (f.kind === "notice") return this._noticeApply();
    if (["device", "sound", "chime", "dechime", "prealarm", "scene"].includes(f.kind) && !f.targets.length) return this._editError("stepNoTargets");
    if (f.kind === "healthcheck") {
      const bad = this._hcProblem(f);
      if (bad) return this._editError(bad);
    }
    if (f.kind === "notify" && f.ntClick === "custom" && !/^\/[^\s]*$/.test(String(f.ntClickPath || "").trim())) return this._editError("fldNtPathBad");
    if (f.kind === "custom") {
      if (!f.domain || !f.service) return this._editError("stepNoService");
      const meta = this._services()[f.domain]?.[f.service];
      const fields = flatFields(meta?.fields);
      const empty = (k) => f.data[k] === undefined || f.data[k] === "" || Number.isNaN(f.data[k]);
      const missing = Object.entries(fields).find(([k, fd]) => fd.required && selectorType(fd) !== "boolean" && SIMPLE_SELECTORS.includes(selectorType(fd)) && empty(k) && !f.extra[k]);
      if (missing) return this._editError(null, this._t("fldMissing", { name: this._fieldName(f, missing[0], missing[1]) }));
      if (meta?.target && !f.targets.length && !("entity_id" in fields)) return this._editError("stepNoTargets");
    }
    let step;
    try {
      step = toStep(f, this.edit.zone);
    } catch (err) {
      return this._editError(null, errText(err));
    }
    const zone = this.edit.zone || "main";
    const list = [...this.steps(zone)];
    if (this.edit.index === null && this._full(zone)) return this._editError(inGroup(zone) && list.length >= GROUP_MAX_STEPS ? "grpFull" : "wfFull");
    if (this.edit.index !== null) list[this.edit.index] = step;
    else list.splice(this.edit.insert, 0, step);
    this._setSteps(list, zone);
    this.saveState = null;
    this._stopPreview();
    this.edit = null;
    this._dlg().close();
    this.render();
  }

  _editError(key, text) {
    this.edit.error = text || this._t(key);
    this.renderEditor();
  }

  // ----- Vorhören auf diesem Gerät (nicht auf dem Medienplayer) -----

  _play(url) {
    this._stopPreview();
    const audio = new Audio(url);
    audio.addEventListener("ended", () => {
      if (this._preview === audio) {
        this._preview = null;
        this.previewing = null;
        if (isTone(this.edit?.form?.kind)) this.renderEditor();
      }
    });
    this._preview = audio;
    this.previewing = url;
    audio.play().catch(() => {
      if (this._preview === audio) {
        this._preview = null;
        this.previewing = null;
        if (isTone(this.edit?.form?.kind)) this.renderEditor();
      }
    });
  }

  // Eigenen Ton hochladen, direkt aus dem Editor des Schritts; danach ist er für alle Schritte aller Anlagen wählbar
  async _uploadSound() {
    const ui = this.edit?.upload;
    const form = this.edit?.form;
    if (!ui || !form || ui.busy) return;
    ui.busy = true;
    ui.error = "";
    const dlg = this._dlg();
    dlg.querySelector('[data-wf="cs-go"]')?.setAttribute("disabled", "");
    try {
      const sound = await uploadSound(this.host, dlg, ui, (k, v) => this._t(k, v));
      form.sound = sound.id;
      this.edit.upload = null;
      // Der Ton selbst ist gespeichert, die Wahl im Schritt noch nicht: der Editor zeigt das, bis der Schritt gespeichert ist (_soundFields)
      this.edit.uploaded = sound.id;
      this.host._toast(this._t("upDone", { name: sound.name }));
    } catch (err) {
      ui.busy = false;
      ui.error = uploadError((k, v) => this._t(k, v), err.code || "upload_failed", err.status);
    }
    if (this.edit) this.renderEditor();
  }

  _stopPreview() {
    if (this._preview) {
      this._preview.pause();
      this._preview = null;
    }
    this.previewing = null;
  }

  // ----- Speichern und Testen -----

  async save() {
    const h = this.host;
    const s = this.system;
    const d = this.draft;
    if (!s || !d || this.saving) return;
    this.saving = true;
    this.renderFoot();
    try {
      const eff = this._effective(d, s);
      const wf = Object.fromEntries(this.triggers(s).map((t) => [t, eff.wf[t] || []]));
      const end = Object.fromEntries(this.triggers(s).map((t) => [t, normEnd(eff.end[t])]));
      const after = Object.fromEntries(this.triggers(s).map((t) => [t, eff.after?.[t] || []]));
      const armed = Object.fromEntries(this.triggers(s).filter((t) => t !== "always").map((t) => [t, eff.armed?.[t] || []]));
      const modeOnly = (map) => Object.fromEntries(this.triggers(s).filter((t) => t !== "always").map((t) => [t, map?.[t] || []]));
      const arming = modeOnly(eff.arming);
      const entrySteps = modeOnly(eff.entry);
      const disarmedSteps = modeOnly(eff.disarmed);
      const report = Object.fromEntries(this.triggers(s).map((t) => [t, eff.report?.[t] || []]));
      // Feste Meldungen: nur, was sich geändert hat. Was fehlt, bleibt beim Server, wie es ist: eine Anlage, die nie etwas Eigenes
      // gespeichert hat, folgt weiter der früheren gemeinsamen Einstellung, und Speichern ohne Änderung lädt die Anlage nicht neu.
      const notices = {};
      for (const t of this.triggers(s)) {
        const mine = normNotices(eff.notices?.[t], t);
        const theirs = normNotices(s.event_notify?.[t], t);
        const changed = Object.fromEntries(Object.entries(mine).filter(([kind, n]) => JSON.stringify(stable(n)) !== JSON.stringify(stable(theirs[kind]))));
        if (Object.keys(changed).length) notices[t] = changed;
      }
      const saved = await h._hass.callWS({ type: "alarmageddon/save_workflows", entry_id: s.entry_id, workflows: wf, workflow_end: end, workflows_after: after, workflows_armed: armed, workflows_arming: arming, workflows_entry: entrySteps, workflows_disarmed: disarmedSteps, workflows_report: report, ...(Object.keys(notices).length ? { event_notify: notices } : {}) });
      const keepNonEmpty = (map) => JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(map).filter(([, v]) => v.length))));
      s.workflows_arming = keepNonEmpty(arming);
      s.workflows_entry = keepNonEmpty(entrySteps);
      s.workflows_disarmed = keepNonEmpty(disarmedSteps);
      s.workflows_report = keepNonEmpty(report);
      s.event_notify = Object.fromEntries(Object.entries({ ...(s.event_notify || {}), ...notices }).map(([t, kinds]) => [t, { ...(s.event_notify?.[t] || {}), ...JSON.parse(JSON.stringify(notices[t] || kinds)) }]));
      s.workflows_armed = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(armed).filter(([, v]) => v.length))));
      s.workflows_after = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(after).filter(([, v]) => v.length))));
      // Wie der Server speichert: eigene Werte und (seit 1.63.0) "aus"; ohne "aus" sprang die Karte nach dem Speichern auf "an" zurück
      s.workflow_end = Object.fromEntries(Object.entries(end).filter(([, v]) => v.notify || v.send === false));
      s.workflows = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(wf).filter(([, v]) => v.length))));
      this.draft = null;
      this.saveState = "saved";
      this.host._markSaved(this); // Punkte "ungespeichert" verschwinden sofort
      // Nur warten, wenn die Anlage wirklich neu lädt (der Server sagt es; ältere Server ohne Angabe: wie bisher warten)
      // Nach dem Speichern sofort prüfen (nur lesen, schnell): behobene Befunde verschwinden an den Karten, neue erscheinen (Wunsch des Nutzers 2026-11-23)
      h.selftest.checkAfterSave(); // sofort, parallel zum Neuladen
      if (saved?.reload !== false) h._reloadWait(s.entry_id);
      else h._fetch();
    } catch (err) {
      this.saveState = this._t("saveFailed", { message: errText(err) });
    } finally {
      this.saving = false;
      this.render();
    }
  }

  async test(stop, step, source) {
    const h = this.host;
    const s = this.system;
    try {
      const msg = stop ? { type: "alarmageddon/stop_workflow", entry_id: s.entry_id } : { type: "alarmageddon/test_workflow", entry_id: s.entry_id, trigger: this.trigger };
      if (step) msg.step = step;
      await h._hass.callWS(msg);
      this.testSource = stop ? null : source || { kind: "all" };
      s.workflow_running = stop ? null : this.trigger;
      s.workflow_test = !stop;
      this.render();
      if (!stop) this._watchTest();
    } catch (err) {
      h._toast(this._t("errGeneric", { message: errText(err) }));
    }
  }

  // Nach dem Start eines Tests nachfragen, bis er vorbei ist (Töne enden mit dem Ton, andere Tests mit dem Zeitfenster): der Stopp-Knopf
  // bleibt nicht stehen. Höchstens 70 Sekunden, ein neuer Test ersetzt die Abfrage.
  _watchTest() {
    clearInterval(this._testWatch);
    const started = Date.now();
    this._testWatch = setInterval(async () => {
      if (Date.now() - started > 70000 || !this.system?.workflow_running) {
        clearInterval(this._testWatch);
        return;
      }
      try {
        await this.host._fetch();
      } catch {
        /* nächste Abfrage */
      }
    }, 2500);
  }

  // Einzelner Schritt: läuft wirklich auf den Geräten, darum vorher fragen
  async testStep(index, zone = "main") {
    const step = this.steps(zone)[index];
    if (!step) return;
    const ok = await this.host._confirm(this._t("stepTestTitle"), this._t("stepTestText"), this._t("stepTestRun"));
    if (ok) await this.test(false, step, { kind: "step", zone, index });
  }

  // ----- Ziehen am Griff (Pointer-Ereignisse am Fenster, Tastatur mit Pfeiltasten) -----

  onPointerDown(ev) {
    if (ev.target.closest?.(".ag-combo-list")) this._comboPointer = true;
    const grab = ev.target.closest?.('[data-wf="grab"]');
    if (!grab || (ev.button !== undefined && ev.button !== 0)) return;
    const root = this.host._view;
    // Nur die Karten derselben Liste (Ablauf beim Alarm oder Aktionen danach): gezogen wird innerhalb der Liste
    const line = grab.closest(".ag-wf-line") || root;
    // Nur die Karten dieser Liste selbst: die Schritte einer Gruppe gehören zur Liste der Gruppe
    const cards = [...line.querySelectorAll(":scope > .ag-wf-step")];
    const from = Number(grab.dataset.index);
    if (!cards[from]) return;
    ev.preventDefault();
    const rects = cards.map((c) => c.getBoundingClientRect());
    const slot = (rects[from + 1] ? rects[from + 1].top : rects[from].bottom + 40) - rects[from].top;
    // Alle anderen Listen, die gerade sichtbar sind: ein Schritt lässt sich auch in eine andere Liste ziehen (1.22.0), auch in eine
    // leere. Lagen werden beim Start gemessen (in Bildschirmkoordinaten dieses Moments); beim Mitscrollen wird der Zeiger darauf
    // umgerechnet. "ok" = die Liste nimmt diese Art von Schritt auf; sonst zeigt sie rot, dass es dort nicht geht.
    const zone = line.dataset?.zone || "main";
    const dragged = this.steps(zone)[from] || {};
    const kind = fromStep(dragged).kind;
    const size = 1 + (dragged.type === "group" ? (dragged.steps || []).length : 0);
    // Ziele: jede andere Liste, auch die Listen der Gruppen (ein Schritt lässt sich in eine Gruppe ziehen und wieder heraus), ausser der
    // Liste in der gezogenen Gruppe selbst. Eine Gruppe nimmt jede Liste auf: was dort nicht geht, fällt nach einer Rückfrage weg.
    const lines = [...root.querySelectorAll(".ag-wf-line")].map((el) => ({ el, zone: el.dataset?.zone || "main" })).filter((l) => l.zone !== zone && !cards[from].contains(l.el)).map((l) => {
      // Die Fläche der Liste samt ihren Plus: bei einer leeren Liste ragt das Plus über den Rahmen der Liste hinaus
      const rs = [l.el, ...l.el.querySelectorAll(":scope > .ag-wf-plus")].map((e) => e.getBoundingClientRect());
      // Innerhalb derselben Liste (in eine Gruppe hinein oder aus ihr heraus) ändert sich die Zahl der Schritte nicht
      const room = baseZone(l.zone) === baseZone(zone) ? !(inGroup(l.zone) && this.steps(l.zone).length + 1 > GROUP_MAX_STEPS) : !this._full(l.zone, size);
      return { ...l, nested: inGroup(l.zone), around: l.el.contains(line), ok: this._zoneKinds(l.zone).includes(kind) && room, top: Math.min(...rs.map((r) => r.top)), bottom: Math.max(...rs.map((r) => r.bottom)),
        centers: [...l.el.querySelectorAll(":scope > .ag-wf-step")].map((c) => { const b = c.getBoundingClientRect(); return b.top + b.height / 2; }) };
    });
    const own = line.getBoundingClientRect();
    this.drag = { from, to: from, startY: ev.clientY, lastY: ev.clientY, sc0: this.host._content?.scrollTop ?? 0, cards, rects, slot, moved: false, zone, lines, target: null, own: { top: own.top, bottom: own.bottom } };
    cards[from].classList.add("dragging");
    root.classList.add("ag-dragging");
    this._dragScrollLoop();
  }

  onPointerMove(ev) {
    const d = this.drag;
    if (!d) return;
    d.lastY = ev.clientY;
    if (Math.abs(ev.clientY - d.startY) > 4) d.moved = true;
    this._dragUpdate();
  }

  // Lage der gezogenen Karte, Platz in der eigenen Liste und Zielliste neu berechnen (bei Bewegung und beim Mitscrollen)
  _dragUpdate() {
    const d = this.drag;
    if (!d) return;
    const sc = (this.host._content?.scrollTop ?? 0) - d.sc0; // so weit ist die Seite seit dem Start gescrollt
    const dy = d.lastY - d.startY + sc;
    const py = d.lastY + sc; // Zeiger in den Koordinaten vom Start
    d.cards[d.from].style.transform = `translateY(${dy}px)`;
    const center = d.rects[d.from].top + d.rects[d.from].height / 2 + dy;
    // Neue Stelle: so viele andere Karten, wie oberhalb der Mitte der gezogenen liegen
    let to = 0;
    d.rects.forEach((r, i) => {
      if (i !== d.from && r.top + r.height / 2 < center) to += 1;
    });
    d.to = to;
    // Über einer anderen Liste (auch über einer ihrer Aktionen oder knapp daneben): sie leuchtet auf, die Karte landet beim Loslassen
    // dort. Nimmt sie den Schritt nicht auf, leuchtet sie rot. Liegt der Zeiger in keiner, gilt die nächste in 48 px Abstand.
    d.target = null;
    // Eine Gruppe liegt in ihrer Liste: von den Listen unter dem Zeiger gilt die innerste. Die Liste um die eigene Gruppe herum zählt
    // erst, wenn der Zeiger die Gruppe verlassen hat (sonst liesse sich in der Gruppe nichts umordnen).
    const inOwn = d.own && py >= d.own.top && py <= d.own.bottom;
    let hit = d.lines.filter((l) => py >= l.top && py <= l.bottom && !(l.around && inOwn)).sort((x, y) => (x.bottom - x.top) - (y.bottom - y.top))[0];
    if (!hit) {
      // Knapp daneben gilt nur für die Listen selbst, nie für eine Gruppe (in sie muss man hineinziehen)
      const near = d.lines.filter((l) => !l.nested && !(l.around && inOwn)).map((l) => [Math.min(Math.abs(py - l.top), Math.abs(py - l.bottom)), l]).filter(([gap]) => gap <= 48).sort((x, y) => x[0] - y[0])[0];
      hit = near?.[1];
    }
    for (const l of d.lines) {
      l.el.classList.toggle("ag-drop", l === hit && l.ok);
      l.el.classList.toggle("ag-drop-no", l === hit && !l.ok);
    }
    if (hit?.ok) {
      d.target = { zone: hit.zone, at: hit.centers.filter((c) => c < py).length };
      d.to = d.from;
    }
    d.cards.forEach((c, i) => {
      if (i === d.from) return;
      let shift = 0;
      if (d.target) shift = 0;
      else if (d.from < d.to && i > d.from && i <= d.to) shift = -d.slot;
      else if (d.from > d.to && i < d.from && i >= d.to) shift = d.slot;
      c.style.transform = shift ? `translateY(${shift}px)` : "";
    });
  }

  // Am oberen und unteren Rand des sichtbaren Bereichs scrollt die Seite von selbst mit, solange der Zeiger dort steht: umso
  // schneller, je näher am Rand (1.24.0). Die festen Leisten oben (Reiter) und unten (Speichern) gehören nicht zum Bereich.
  _dragScrollLoop() {
    const win = this.host.ownerDocument.defaultView;
    const step = () => {
      const d = this.drag;
      const c = this.host._content;
      if (!d || !c) return;
      const cr = c.getBoundingClientRect();
      const view = this.host._view;
      let top = cr.top;
      for (const el of [c.querySelector(":scope > .ag-head"), view?.querySelector(":scope > .ag-cfg")]) if (el) top = Math.max(top, el.getBoundingClientRect().bottom);
      const foot = view?.querySelector(".ag-foot");
      const bottom = foot ? Math.min(cr.bottom, foot.getBoundingClientRect().top) : cr.bottom;
      const band = 90;
      let v = 0;
      if (d.lastY < top + band) v = -Math.min(1, (top + band - d.lastY) / band) * 22;
      else if (d.lastY > bottom - band) v = Math.min(1, (d.lastY - (bottom - band)) / band) * 22;
      if (v) {
        const before = c.scrollTop;
        c.scrollTop = before + v;
        if (c.scrollTop !== before) {
          d.moved = true;
          this._dragUpdate();
        }
      }
      this._dragRaf = win.requestAnimationFrame(step);
    };
    win.cancelAnimationFrame(this._dragRaf);
    this._dragRaf = win.requestAnimationFrame(step);
  }

  onPointerEnd() {
    setTimeout(() => (this._comboPointer = false), 250);
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.host.ownerDocument.defaultView.cancelAnimationFrame(this._dragRaf);
    this.host._view?.classList.remove("ag-dragging");
    d.cards.forEach((c) => {
      c.style.transform = "";
      c.classList.remove("dragging");
    });
    for (const l of d.lines || []) l.el.classList.remove("ag-drop", "ag-drop-no");
    if (d.moved && d.target) this._moveAcross(d.from, d.zone, d.target.zone, d.target.at);
    else if (d.moved && d.to !== d.from) this._move(d.from, d.to, d.zone);
  }

  // Schritt in eine andere Liste legen (1.22.0), auch in eine Gruppe hinein oder aus ihr heraus (1.59.0). Er wird dabei für die neue
  // Liste umgerechnet: nach dem Quittieren kehrt nichts zurück, ein Ton in den Listen der Verzögerungen folgt standardmässig der
  // Verzögerung (wie ein neuer Schritt dort). Gibt zurück, wo der Schritt jetzt liegt ({ zone, index }), oder null.
  // Rückfrage, wenn eine Gruppe in einen anderen Bereich wandert und dort nicht alles gilt (aus _moveAcross herausgelöst; gilt auch für "Verschieben oder
  // kopieren", 1.85.0). `unchanged` prüft nach der Antwort, ob sich die Liste inzwischen geändert hat. false = abgebrochen.
  async _confirmGroupMove(f, srcBase, dstBase, unchanged) {
    if (f.kind !== "group" || dstBase === srcBase) return true;
    // Eine Gruppe wandert in einen anderen Bereich: Aktionen, die es dort nicht gibt, fallen weg. Vorher fragen (Wunsch des
    // Nutzers, 2026-11-17); "Abbrechen" lässt die Gruppe, wo und wie sie ist.
    const kinds = this._zoneKinds(`${dstBase}:0`);
    const lost = f.gSteps.filter((inner) => !kinds.includes(fromStep(inner).kind));
    const until = f.gMode === "until_disarmed" && dstBase !== "main";
    if (lost.length || until) {
      const names = [...new Set(lost.map((inner) => this._t(KINDS.find((k) => k.kind === fromStep(inner).kind)?.label || "stepCustom")))].join(", ");
      const text = [lost.length ? this._t(lost.length === 1 ? "grpMoveLostOne" : "grpMoveLost", { count: lost.length, list: names, zone: this._t(`zone_${dstBase}`) }) : "", until ? this._t("grpMoveUntil", { n: f.gCount }) : ""].filter(Boolean).join(" ");
      if (!(await this.host._confirm(this._t("grpMoveTitle"), text, this._t(lost.length ? "grpMoveOk" : "grpMoveOkPlain")))) return false;
      if (!unchanged()) return false; // inzwischen hat sich die Liste geändert
      f.gSteps = f.gSteps.filter((inner) => kinds.includes(fromStep(inner).kind));
      if (until) f.gMode = "count";
    }
    return true;
  }

  async _moveAcross(from, src, dst, at) {
    const step = this.steps(src)[from];
    if (!step) return null;
    const f = fromStep(step);
    if (!this._zoneKinds(dst).includes(f.kind)) return null;
    const dstBase = baseZone(dst);
    if (!(await this._confirmGroupMove(f, baseZone(src), dstBase, () => this.steps(src)[from] === step))) return null;
    if (DELAY_ZONES.includes(dst) && isShortTone(f.kind)) Object.assign(f, { delay: true, wait: false });
    // Zielgruppe vor dem Entfernen merken: liegt der Schritt in derselben Liste davor, rückt die Gruppe um eine Stelle nach vorn
    const group = inGroup(dst) ? this.steps(dstBase)[groupIndex(dst)] : null;
    if (inGroup(dst) && group?.type !== "group") return null;
    this._setSteps(this.steps(src).filter((_s, k) => k !== from), src);
    const zone = group ? `${dstBase}:${this.steps(dstBase).indexOf(group)}` : dst;
    const list = [...this.steps(zone)];
    const index = Math.min(at, list.length);
    list.splice(index, 0, toStep(f, zone));
    this._setSteps(list, zone);
    this.saveState = null;
    this.render();
    // Die Karte ist hochgesprungen: dorthin scrollen, falls sie ausser Sicht ist
    this._lineEl(zone)?.querySelector(`:scope > .ag-wf-step[data-index="${index}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return { zone, index };
  }

  // ----- Marken des Selbsttests an den Karten (1.86.0, Wunsch des Nutzers 2026-11-23) -----

  // Ein Ausrufezeichen am Reiter eines Modus, in dem der Selbsttest Befunde an Aktionen meldet (so findet man den Modus, ohne alle durchzuklicken)
  _markTabs(head) {
    const st = this.host.selftest;
    const entry = this.system?.entry_id;
    // Die Seite zeichnet die Reiter nicht immer neu (nur die Unterschiede): alte Marken erst entfernen, sonst bliebe eine behobene Marke stehen
    head.querySelectorAll(".ag-tabmark").forEach((x) => x.remove());
    if (!st || !entry) return;
    for (const btn of head.querySelectorAll("[data-trigger]")) {
      const t = btn.dataset.trigger;
      if (t === "monitor") continue;
      const m = st.triggerMarks(entry, t);
      if (m.n) btn.insertAdjacentHTML("beforeend", `<span class="ag-tabmark ${m.red ? "err" : "warn"}" title="${esc(this._t(m.n === 1 ? "wfTabProbOne" : "wfTabProb", { n: m.n }))}" aria-label="${esc(this._t(m.n === 1 ? "wfTabProbOne" : "wfTabProb", { n: m.n }))}">!</span>`);
    }
  }

  // Liste im Selbsttest (alarm, after, ...) zur Liste der Seite
  _stList(zone) {
    return { main: "alarm", after: "after", armed: "armed", arming: "arming", entry: "entry", disarmed: "disarmed", report: "report" }[baseZone(zone)];
  }

  // Befunde, die diese Karte betreffen (Entität fehlt oder nicht erreichbar, Dienst, Lautsprecher, Empfänger fehlen ...); `i` ist die Stelle in `zone`
  _marks(zone, i) {
    const st = this.host.selftest;
    const entry = this.system?.entry_id;
    if (!st || !entry || this.trigger === "monitor") return [];
    const gi = groupIndex(zone);
    return gi === null ? st.cardMarks(entry, this.trigger, this._stList(zone), i + 1) : st.cardMarks(entry, this.trigger, this._stList(zone), gi + 1, i + 1);
  }

  // Marke an einer Karte: das grosse rote (bei Befunden ohne Gefahr für den Alarm orange) Ausrufezeichen an der Ecke und je Befund eine Zeile, die den Befund öffnet
  _markBadge(marks) {
    if (!marks.length) return "";
    if (this.host.selftest?.checking) return `<span class="ag-wf-badge chk" aria-hidden="true"><i></i></span>`;
    const tone = marks.some((m) => m.tone === "err") ? "err" : "warn";
    return `<span class="ag-wf-badge ${tone}" aria-hidden="true">!</span>`;
  }

  _markLines(marks) {
    if (!marks.length) return "";
    if (this.host.selftest?.checking) return `<div class="ag-wf-probs"><span class="ag-wf-prob chk">${esc(this._t("wfProbChecking"))}</span></div>`;
    const shown = marks.slice(0, 3);
    const more = marks.length - shown.length;
    return `<div class="ag-wf-probs">${shown.map((m) => `<button type="button" class="ag-wf-prob ${m.tone}" data-wf="st-open" data-key="${esc(m.key)}" title="${esc(this._t("wfProbOpen"))}">${ic(m.icon, 14)}<span>${esc(m.title)}</span></button>`).join("")}${more > 0 ? `<span class="ag-wf-prob more">${esc(this._t("wfProbMore", { n: more }))}</span>` : ""}</div>`;
  }

  // ----- Aktion verschieben oder kopieren (1.85.0, Fenster in xfer.js) -----

  zoneKinds(path) {
    return this._zoneKinds(path);
  }

  xfKind(step) {
    return fromStep(step).kind;
  }

  xfIcon(step) {
    return KINDS.find((k) => k.kind === fromStep(step).kind)?.icon || "cog";
  }

  // Name einer Aktion wie auf ihrer Karte
  xfName(step) {
    const f = fromStep(step);
    if (f.kind === "group") {
      const name = String(f.gName || "").trim();
      return name ? this._t("grpTitleNamed", { name }) : this._t("grpTitle");
    }
    return f.kind === "custom" ? this._serviceName(f.domain, f.service) : this._t(KINDS.find((k) => k.kind === f.kind)?.label || "stepCustom");
  }

  xfGroupSummary(step) {
    return this._groupSummary(fromStep(step));
  }

  // Phasen eines Auslösers in der Reihenfolge des Ablaufs: [Schlüssel, Liste, Text]. Verzögerungen nur mit eingestellter Zeit, "Immer aktiv" wird nie scharf
  // (dieselben Regeln wie die Ansicht und der Filter "Phase")
  xfPhases(trigger) {
    const always = trigger === "always";
    const delays = (zone) => !always && this._delaySeconds(zone, trigger) > 0;
    return [
      ...(delays("arming") ? [["arming", "arming", "wfArming"]] : []),
      ...(always ? [] : [["armed", "armed", "wfArmed"]]),
      ["report", "report", "wfReport"],
      ...(delays("entry") ? [["entry", "entry", "wfEntry"]] : []),
      ["alarm", "main", "wfStart"],
      ["end", "after", "wfEnd"],
      ...(always ? [] : [["disarmed", "disarmed", "wfDisarmed"]]),
    ];
  }

  // Nimmt die Zielliste die Aktion nicht mehr auf? Kopie: sie kommt dazu. Verschieben innerhalb derselben Liste ändert nichts an der Zahl; wandert sie in eine
  // Gruppe oder aus ihr, in eine andere Liste oder einen anderen Auslöser, zählt die Zielliste (die Gruppe höchstens GROUP_MAX_STEPS)
  xfFull(from, to, size, copy) {
    const sameBase = from.trigger === to.trigger && baseZone(from.zone) === baseZone(to.zone);
    if (!copy && sameBase) return inGroup(to.zone) && from.zone !== to.zone && this.steps(to.zone, to.trigger).length + 1 > GROUP_MAX_STEPS;
    return this._full(to.zone, size, to.trigger);
  }

  // Zustand der Listen im Entwurf (für "Rückgängig")
  _lists() {
    const d = this.ensureDraft();
    return JSON.stringify({ wf: d.wf, after: d.after, armed: d.armed, arming: d.arming, entrySteps: d.entrySteps, disarmed: d.disarmed, report: d.report });
  }

  // Aktion verschieben (copy = false) oder kopieren. from = { trigger, zone, index }, to = { trigger, zone, at }; die Stelle `at` zählt vor dem Entfernen
  // (der Einfügepunkt zwischen den Aktionen, wie ihn das Fenster zeigt). Danach springt die Seite zur Aktion und hebt sie hervor. Gibt { zone, index, undo }
  // zurück, null bei einem Abbruch oder wenn die Aktion dort nicht erlaubt ist.
  async _relocate(from, to, copy, phase = "") {
    const d = this.ensureDraft();
    const step = d ? this.steps(from.zone, from.trigger)[from.index] : null;
    if (!step) return null;
    const f = fromStep(JSON.parse(JSON.stringify(step)));
    if (!this._zoneKinds(to.zone).includes(f.kind)) return null;
    const srcBase = baseZone(from.zone);
    const dstBase = baseZone(to.zone);
    if (!(await this._confirmGroupMove(f, srcBase, dstBase, () => this.steps(from.zone, from.trigger)[from.index] === step))) return null;
    if (DELAY_ZONES.includes(dstBase) && isShortTone(f.kind)) Object.assign(f, { delay: true, wait: false });
    const group = inGroup(to.zone) ? this.steps(dstBase, to.trigger)[groupIndex(to.zone)] : null;
    if (inGroup(to.zone) && group?.type !== "group") return null;
    const size = 1 + (f.kind === "group" ? f.gSteps.length : 0);
    if (this.xfFull(from, to, size, copy)) return null;
    const before = this._lists();
    const beforeTrigger = this.trigger;
    const same = from.trigger === to.trigger && from.zone === to.zone;
    let at = to.at;
    if (!copy) {
      this._setSteps(this.steps(from.zone, from.trigger).filter((_s, k) => k !== from.index), from.zone, from.trigger);
      if (same && at > from.index) at -= 1;
    }
    // Die Gruppe ist nach dem Entfernen eine Stelle weiter vorn, wenn die Aktion davor aus derselben Liste kam
    const zone = group ? `${dstBase}:${this.steps(dstBase, to.trigger).indexOf(group)}` : to.zone;
    const list = [...this.steps(zone, to.trigger)];
    const index = Math.max(0, Math.min(at, list.length));
    list.splice(index, 0, toStep(f, zone));
    this._setSteps(list, zone, to.trigger);
    this.saveState = null;
    // Sprung: der Reiter des Zielmodus, die Phase sichtbar (ein Filter "Phase" gibt sie frei), die Aktion hervorgehoben
    if (this.trigger !== to.trigger) {
      this.trigger = to.trigger;
      this.host._savePref("trigger", this.trigger);
    }
    if (this.phase && phase && this.phase !== phase) this.phase = "";
    this.render();
    const el = this._lineEl(zone)?.querySelector(`:scope > .ag-wf-step[data-index="${index}"]`);
    el?.classList.add("ag-flash");
    // Erst nach dem Zeichnen und dem Schliessen des Fensters scrollen (vorher stünde die Seite noch unter dem Fenster, und das Neuzeichnen setzt die Lage zurück)
    const jump = () => el?.isConnected && el.scrollIntoView({ block: "center" });
    requestAnimationFrame(jump);
    setTimeout(jump, 250);
    setTimeout(() => el?.classList.remove("ag-flash"), 2400);
    const rev = this._rev;
    const draft = this.draft;
    const undo = () => {
      // Nur solange nichts anderes im Entwurf geändert wurde (und er nicht verworfen oder gespeichert ist)
      if (this.draft !== draft || this._rev !== rev) {
        this.host._toast(this._t("xfUndoGone"));
        return;
      }
      Object.assign(this.draft, JSON.parse(before));
      this._rev += 1;
      this.saveState = null;
      this.trigger = beforeTrigger;
      this.host._savePref("trigger", this.trigger);
      this.render();
      this.host._toast(this._t("xfUndone"));
    };
    return { zone, index, undo };
  }

  // Das Element einer Liste: eine der sechs Listen oder die Liste in einer Gruppe
  _lineEl(zone) {
    const line = this.host._view?.querySelector(ZONE_CLASS[baseZone(zone)] || ".ag-wf-main");
    const gi = groupIndex(zone);
    return gi === null ? line : line?.querySelector(`:scope > .ag-wf-step[data-index="${gi}"] > .ag-wf-glist`) || null;
  }

  _move(from, to, zone = "main") {
    const list = [...this.steps(zone)];
    const [step] = list.splice(from, 1);
    list.splice(to, 0, step);
    this._setSteps(list, zone);
    this.saveState = null;
    this.render();
  }

  // Tastatur am Griff: Pfeiltasten verschieben den Schritt (Ersatz für das Ziehen). Trifft er auf eine Gruppe, geht er hinein (oben
  // oder unten), am Rand einer Gruppe wieder hinaus: so erreicht die Tastatur jede Stelle, die auch das Ziehen erreicht.
  onKeyDown(ev) {
    const grab = ev.target.closest?.('[data-wf="grab"]');
    if (!grab || !["ArrowUp", "ArrowDown"].includes(ev.key)) return false;
    const i = Number(grab.dataset.index);
    const down = ev.key === "ArrowDown";
    const j = down ? i + 1 : i - 1;
    ev.preventDefault();
    const zone = grab.closest("[data-zone]")?.dataset.zone || "main";
    const list = this.steps(zone);
    const kind = fromStep(list[i] || {}).kind;
    const focus = (where) => where && this._lineEl(where.zone)?.querySelector(`:scope > .ag-wf-step[data-index="${where.index}"] [data-wf="grab"]`)?.focus();
    if (inGroup(zone)) {
      if (j < 0 || j >= list.length) {
        // Am Rand der Gruppe: hinaus, vor oder hinter die Gruppe
        this._moveAcross(i, zone, baseZone(zone), groupIndex(zone) + (down ? 1 : 0)).then(focus);
        return true;
      }
    } else if (list[j]?.type === "group" && kind !== "group" && this._zoneKinds(`${zone}:${j}`).includes(kind) && (list[j].steps || []).length < GROUP_MAX_STEPS) {
      // Die Nachbarin ist eine Gruppe: hinein, von oben an ihren Anfang, von unten an ihr Ende
      this._moveAcross(i, zone, `${zone}:${j}`, down ? 0 : (list[j].steps || []).length).then(focus);
      return true;
    } else if (j < 0 || j >= list.length) {
      // Über den Rand hinaus: in die nächste Liste, die den Schritt aufnimmt (der Tastatur-Ersatz fürs Ziehen dorthin)
      const zones = [...this.host._view.querySelectorAll(".ag-wf-line:not(.ag-wf-glist)")].map((el) => el.dataset?.zone || "main");
      const at = zones.indexOf(zone);
      const next = (j < 0 ? zones.slice(0, at).reverse() : zones.slice(at + 1)).find((z) => this._zoneKinds(z).includes(kind));
      if (next) this._moveAcross(i, zone, next, j < 0 ? this.steps(next).length : 0).then(focus);
      return true;
    }
    this._move(i, j, zone);
    focus({ zone, index: j });
    return true;
  }

  // Suchfeld: Liste nur zeigen, solange es den Fokus hat oder darin getippt wird
  onFocus(el, inside) {
    if (inside && ["ntTitle", "ntMessage"].includes(el?.dataset?.key)) {
      this.ntField = el;
      return true;
    }
    if (el?.dataset?.wf === "cb" && this.edit) {
      const combo = el.closest(".ag-combo");
      if (inside) {
        this.edit.cb = { key: el.dataset.key, q: "" };
        el.select(); // der Text wird beim Tippen ersetzt; die Liste zeigt zuerst alles
        const list = combo.querySelector(".ag-combo-list");
        list.innerHTML = this._cbItems(el.dataset.key, this.edit.form);
        combo.classList.add("open");
        list.querySelector(".cur")?.scrollIntoView({ block: "nearest" });
      } else {
        setTimeout(() => {
          if (this._comboPointer) return;
          combo.classList.remove("open");
          if (this.edit?.cb?.key === el.dataset.key) this.edit.cb = null;
          const f = this.edit?.form;
          if (f && el.isConnected) {
            const cur = el.dataset.key === "domain" ? f.domain : f.service;
            el.value = !cur ? "" : el.dataset.key === "domain" ? this._domainName(cur) : this._serviceName(f.domain, cur);
          }
        }, 120);
      }
      return true;
    }
    if (el?.dataset?.wf !== "eq" || !this.edit) return false;
    const combo = el.closest(".ag-combo");
    this.edit.open = inside;
    if (inside) combo?.classList.add("open");
    else setTimeout(() => !this._comboPointer && combo?.classList.remove("open"), 120);
    return true;
  }

  // ----- Ereignisse; true = erledigt -----

  onClick(el) {
    const trig = el?.closest?.("[data-trigger]");
    if (trig && !el.dataset.wf) {
      this.trigger = trig.dataset.trigger;
      this.host._savePref("trigger", this.trigger);
      this.render();
      return true;
    }
    const act = el?.dataset.wf;
    if (!act) return false;
    if (act.startsWith("mon-")) return this.mon.onClick(el);
    if (act.startsWith("xf-")) return this.xfer.onClick(el);
    if (act === "st-open") {
      this.host.selftest.openAt(el.dataset.key);
      return true;
    }
    if (act === "permode") {
      const dr = this.ensureDraft();
      const first = this.triggers()[0];
      // Aus: der Ablauf des ersten Modus gilt für alle. Der Entwurf behält die Abläufe der übrigen Modi; was gilt, rechnet _effective beim
      // Zählen und Speichern (bis zu "Speichern" lässt sich das mit "Abbrechen" oder erneutem Einschalten zurücknehmen). Bis 1.62.0 stand hier
      // eine Zuweisung aus _effective, die bei eingeschaltetem Schalter die eigenen Listen zurückgab und darum nichts bewirkte.
      // Im Reiter "Überwachung" bleibt man dort (der Schalter ändert nur die Reiter der Modi), sonst geht es zum ersten Modus
      if (this.trigger !== "monitor") this.trigger = first;
      dr.perMode = !dr.perMode;
      dr.touched = true; // der Schalter allein ändert keinen Inhalt: der Entwurf darf trotzdem nicht verworfen werden (pinned)
      this.render();
      return true;
    }
    if (act === "grab") return true; // das Ziehen läuft über Pointer-Ereignisse; ein Klick tut nichts
    const d = this.ensureDraft();
    const i = Number(el.dataset.index);
    // Liste des Klicks: Ablauf beim Alarm oder Aktionen nach dem Quittieren (im Fenster die Liste, aus der es geöffnet wurde)
    const zone = el.closest("[data-zone]")?.dataset.zone || (el.closest("dialog") ? this.edit?.zone : null) || "main";
    const list = d ? this.steps(zone) : [];
    const form = this.edit?.form;
    if (act === "add") this.openPicker(Number(el.dataset.at), zone);
    else if (act === "kind") {
      const k = KINDS.find((x) => x.kind === el.dataset.kind);
      this.openEditor({ ...blank(), kind: k.kind, ...(k.kind === "healthcheck" ? this._hcInitial() : {}), restore: ["sound", "chime", "dechime", "prealarm"].includes(k.kind), ...(k.kind === "chime" ? { sound: "tone_pip", playSeconds: 3, until: false, volume: 0.5 } : {}), ...(k.kind === "dechime" ? { sound: "off_fall", playSeconds: 3, until: false, volume: 0.5 } : {}), ...(k.kind === "prealarm" ? { sound: "pre_beep", playSeconds: 20, until: false, setVolume: true, volume: 0.3, wait: true } : {}),
        // Töne in den Listen der Verzögerungen folgen standardmässig der Verzögerung (1.19.0)
        ...(DELAY_ZONES.includes(this.edit?.zone) && (k.kind === "chime" || k.kind === "prealarm") ? { delay: true, wait: false } : {}) }); // Alarmton beim Alarm: standardmässig zurückstellen; Aktivierungston: Piepsen, 3 Sekunden
    } else if (act === "edit") {
      this.edit = { index: i, insert: null, form: fromStep(list[i]), q: "", error: "", open: false, zone };
      this.renderEditor();
      this._dlg().showModal();
    } else if (act === "duplicate") {
      // Kopie direkt unter dem Schritt, in derselben Liste (der Server begrenzt die Zahl der Schritte je Liste, die einer Gruppe zählen mit)
      if (list[i] && !this._full(zone, 1 + (list[i].type === "group" ? (list[i].steps || []).length : 0))) {
        this._setSteps([...list.slice(0, i + 1), JSON.parse(JSON.stringify(list[i])), ...list.slice(i + 1)], zone);
        this.saveState = null;
        this.render();
      }
    } else if (act === "xfer") {
      this.xfer.open(zone, i);
    } else if (act === "delete") {
      this._setSteps(list.filter((_s, k) => k !== i), zone);
      this.saveState = null;
      this.render();
    } else if (act === "test-step") this.testStep(i, zone);
    else if (act === "test-step-stop") this.test(true);
    else if (act === "pick") {
      if (!form.targets.includes(el.dataset.ent)) form.targets = [...form.targets, el.dataset.ent];
      this.edit.q = "";
      this.edit.open = false;
      this.renderEditor();
    } else if (act === "unpick") {
      form.targets = form.targets.filter((x) => x !== el.dataset.ent);
      this.renderEditor();
    } else if (act === "action") {
      form.action = el.dataset.value;
      this.renderEditor();
    } else if (act === "ins") {
      // Platzhalter an der Schreibmarke des zuletzt benutzten Textfelds einfügen
      const field = this.ntField && this._dlg().contains(this.ntField) ? this.ntField : this._dlg().querySelector('[data-key="ntTitle"]');
      const pos = field.selectionStart ?? field.value.length;
      field.value = field.value.slice(0, pos) + el.dataset.token + field.value.slice(field.selectionEnd ?? pos);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.focus();
      field.setSelectionRange(pos + el.dataset.token.length, pos + el.dataset.token.length);
    } else if (act === "cb-pick") {
      const key = el.dataset.key;
      if (form[key] !== el.dataset.value) {
        form[key] = el.dataset.value;
        if (key === "domain") form.service = "";
        form.data = {};
        form.extra = {};
      }
      this.edit.cb = null;
      this.renderEditor();
    } else if (act === "nt-tgt-own") {
      // Einschalten beginnt mit den bisherigen Alarm-Empfängern; ausschalten verwirft die eigene Liste
      form.ntTargets = Array.isArray(form.ntTargets) ? null : [...(this.host._data?.notify?.alarm_targets || [])];
      this.renderEditor();
    } else if (act === "nt-tgt-del") {
      form.ntTargets = (form.ntTargets || []).filter((x) => x !== el.dataset.target);
      this.renderEditor();
    } else if (act === "nt-crit") {
      form.ntCritical = !(form.ntCritical ?? (form.kind === "end" || form.kind === "notice" ? false : this._ntGlobal().critical));
      this.renderEditor();
    } else if (act === "nt-btn") {
      const key = el.dataset.key;
      form.ntButtons = { ...(form.ntButtons || {}), [key]: !(form.ntButtons?.[key] ?? this._ntGlobal()[key]) };
      this.renderEditor();
    } else if (act === "notice-edit") {
      this.openNoticeEditor(el.dataset.kind);
    } else if (act === "notice-on") {
      // Schalter auf der Karte: nur ein/aus, alles andere bleibt
      const dr = this.ensureDraft();
      const kind = el.dataset.kind;
      const now = normNotice(kind, dr.notices?.[this.trigger]?.[kind]);
      dr.notices = { ...(dr.notices || {}), [this.trigger]: { ...(dr.notices?.[this.trigger] || {}), [kind]: { ...now, enabled: !now.enabled } } };
      this.saveState = null;
      this.render();
      this.host._renderDots();
    } else if (act === "notice-enabled") {
      form.nEnabled = !form.nEnabled;
      this.renderEditor();
    } else if (act === "notice-persist") {
      form.ntPersistent = !form.ntPersistent;
      this.renderEditor();
    } else if (act === "notice-test") {
      this._noticeTest();
    } else if (act === "notice-play") {
      this._noticeTest(el.dataset.kind);
    } else if (act === "end-play") {
      this._endTest(true);
    } else if (act === "end-on") {
      // Schalter auf der Karte der Abschlussmeldung: nur senden ja/nein, die eigenen Werte bleiben
      const dr = this.ensureDraft();
      const now = normEnd(dr.end?.[this.trigger]);
      dr.end = { ...(dr.end || {}), [this.trigger]: normEnd({ ...now, send: now.send === false ? undefined : false }) };
      this.saveState = null;
      this.render();
      this.host._renderDots();
    } else if (act === "end-edit") {
      this.openEndEditor();
    } else if (act === "end-notify") {
      form.endSend = !form.endSend;
      this.renderEditor();
    } else if (act === "end-test") {
      this._endTest();
    } else if (act === "nt-default") {
      form.ntTitle = "";
      form.ntMessage = "";
      this.renderEditor();
    } else if (act === "delay") {
      form.delay = !form.delay;
      if (form.delay) form.wait = false; // endet erst mit der Verzögerung: darauf lässt sich nicht warten
      this.renderEditor();
    } else if (act === "until") {
      form.until = !form.until;
      if (this.edit?.zone === "after") form.until = false; // nach dem Quittieren braucht ein Ton eine Dauer
      if (form.until) form.wait = false; // endet nie von selbst: darauf lässt sich nicht warten
      this.renderEditor();
    } else if (act === "undo") {
      form.undoOn = !form.undoOn;
      this.renderEditor();
    } else if (act === "undosecs") {
      form.undoSeconds = Number(el.dataset.value);
      this.renderEditor();
    } else if (act === "playsecs") {
      form.playSeconds = Number(el.dataset.value);
      this.renderEditor();
    } else if (act === "secs") {
      form.seconds = Number(el.dataset.value);
      this.renderEditor();
    } else if (act === "opt-on") {
      const key = el.dataset.key;
      form.optsOn[key] = !form.optsOn[key];
      if (form.optsOn[key] && form.opts[key] == null) {
        const spec = deviceOptions(this.states, form.targets).find((sp) => sp.key === key);
        form.opts[key] = spec ? (spec.type === "choice" ? spec.values[0] : key === "brightness_pct" ? 100 : spec.min) : "";
      }
      this.renderEditor();
    } else if (act === "setvol") {
      form.setVolume = !form.setVolume;
      this.renderEditor();
    } else if (act === "pervol") {
      // Je Medienplayer einzeln: jeder beginnt mit dem gemeinsamen Wert
      form.perVolume = !form.perVolume;
      if (form.perVolume) form.volumes = Object.fromEntries(form.targets.map((id) => [id, form.volumes?.[id] ?? form.volume]));
      this.renderEditor();
    } else if (act === "hc-repeat" || act === "hc-pause") {
      form[act === "hc-repeat" ? "hcRepeat" : "hcPause"] = !form[act === "hc-repeat" ? "hcRepeat" : "hcPause"];
      this.renderEditor();
    } else if (act === "hc-copy") {
      copyValue(el, this.host._root.ownerDocument);
    } else if (act === "hc-take") {
      form.hcSuffix = this._hcSuggestion(form.hcId);
      form.hcTouched = true;
      this.renderEditor();
    } else if (act === "hc-open") {
      // Die Dienste öffnen sich über dem Fenster des Schritts; beim Schliessen die Auswahl neu zeichnen (ein Dienst kann dazugekommen sein)
      const list = this.host.healthcheck.listDlg;
      list?.addEventListener("close", () => { if (this.edit?.form?.kind === "healthcheck") this.renderEditor(); }, { once: true });
      this.host.healthcheck.openList();
    } else if (act === "waitend") {
      if (!(form.kind === "sound" && form.until) && !(form.kind === "group" && form.gMode === "until_disarmed")) form.wait = !form.wait;
      this.renderEditor();
    } else if (act === "gmode") {
      form.gMode = el.dataset.value;
      if (form.gMode === "until_disarmed") form.wait = false; // endet nie von selbst: auf sie lässt sich nicht warten
      this.renderEditor();
    } else if (act === "gsecs") {
      form.gSeconds = Number(el.dataset.value);
      this.renderEditor();
    } else if (act === "restore") {
      form.restore = !form.restore;
      this.renderEditor();
    } else if (act === "df" && el.hasAttribute("data-bool")) {
      form.data[el.dataset.key] = !form.data[el.dataset.key];
      this.renderEditor();
    } else if (act === "cs-cancel") {
      if (this.edit) this.edit.upload = null;
      this.renderEditor();
    } else if (act === "cs-go") {
      this._uploadSound();
    } else if (act === "pv-play") {
      if (el.dataset.url) this._play(el.dataset.url);
      this.renderEditor();
    } else if (act === "pv-stop") {
      this._stopPreview();
      this.renderEditor();
    } else if (act === "eq-clear") {
      const input = this._dlg().querySelector('[data-wf="eq"]');
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    } else if (act === "apply") this.apply();
    else if (act === "close") {
      this._stopPreview();
      this.edit = null;
      this._dlg().close();
    } else if (act === "cancel") {
      this.draft = null;
      this.saveState = null;
      this.render();
    } else if (act === "save") this.save();
    else if (act === "test") this.test(false);
    else if (act === "test-stop") this.test(true);
    else return false;
    return true;
  }

  // Alle Aktionen (Schritte, "Alarm endet", seit 1.62.0 auch die Aktionen bei einem stillen Alarm und die festen Meldungen) eines anderen
  // Modus in den Reiter übernehmen; gespeichert wird erst mit "Speichern"
  async _copyFrom(from) {
    const d = this.ensureDraft();
    const to = this.trigger;
    if (!d?.perMode || !from || from === to || !this.triggers().includes(from)) return;
    const name = (t) => (t === "always" ? this._t("wfAlways") : this._t(MODE_KEY[t]));
    // Die Aktionen beim Scharfschalten, in den Verzögerungen und beim Deaktivieren gehen mit, wenn beide Reiter Modi sind ("Immer aktiv" hat keine)
    const modes = from !== "always" && to !== "always";
    // Feste Meldungen: die Arten, die es in beiden Reitern gibt ("Immer aktiv" kennt nur "Stiller Alarm"); sie stehen am Ende der Liste
    const shared = noticeKinds(from).filter((kind) => noticeKinds(to).includes(kind));
    const notices = (t) => Object.fromEntries(shared.map((kind) => [kind, normNotice(kind, d.notices?.[t]?.[kind])]));
    const lists = (t) => [d.wf[t] || [], normEnd(d.end?.[t]), d.after?.[t] || [], d.report?.[t] || [], ...(modes ? [d.armed?.[t] || [], d.arming?.[t] || [], d.entrySteps?.[t] || [], d.disarmed?.[t] || []] : []), notices(t)];
    // Verglichen wird der ganze Inhalt aller Listen (auch die Einstellungen im Schritt, etwa die Lautstärke eines Lautsprechers), nicht nur
    // die Aktionen: sonst gälte "Anwesend" als gleich wie "Abwesend", obwohl nur ein Wert im Schritt abweicht
    const copy = lists(from).map((x) => JSON.parse(JSON.stringify(x)));
    const same = JSON.stringify(stable(lists(to))) === JSON.stringify(stable(copy));
    if (same) return;
    // Rückfrage nur, wenn der Entwurf dieses Reiters wirklich ersetzt würde
    const hasOwn = lists(to).slice(0, -1).some((x) => (Array.isArray(x) ? x.length : Object.keys(x).length) > 0);
    if (hasOwn && !(await this.host._confirm(this._t("wfCopyTitle"), this._t("wfCopyText", { from: name(from), to: name(to) }), this._t("wfCopyOk")))) return;
    if (this.trigger !== to || this.draft !== d) return; // während der Rückfrage gewechselt
    const [wf, end, after, report, armed, arming, entry, disarmed] = copy;
    d.wf = { ...d.wf, [to]: wf };
    d.end = { ...(d.end || {}), [to]: end };
    d.after = { ...(d.after || {}), [to]: after };
    d.report = { ...(d.report || {}), [to]: report };
    d.notices = { ...(d.notices || {}), [to]: { ...(d.notices?.[to] || {}), ...copy.at(-1) } };
    if (modes) {
      d.armed = { ...(d.armed || {}), [to]: armed };
      d.arming = { ...(d.arming || {}), [to]: arming };
      d.entrySteps = { ...(d.entrySteps || {}), [to]: entry };
      d.disarmed = { ...(d.disarmed || {}), [to]: disarmed };
    }
    this.saveState = null;
    this.render();
    this.host._renderDots();
  }

  onChange(el) {
    return this.mon.onChange(el);
  }

  onInput(el) {
    const act = el.dataset.wf;
    if (act?.startsWith("mon-")) return this.mon.onInput(el);
    if (act === "phase") {
      this.phase = el.value;
      this.render();
      return true;
    }
    if (act === "copy-from") {
      const value = el.value;
      el.value = "";
      this._copyFrom(value);
      return true;
    }
    if (!act || !this.edit?.form) return false;
    const f = this.edit.form;
    if (act === "eq") {
      this.edit.q = el.value;
      this.edit.open = true;
      // Nur die Liste neu aufbauen, damit das Suchfeld den Fokus behält (LEARNINGS)
      const list = this._dlg().querySelector(".ag-combo-list");
      if (list) list.innerHTML = this._comboItems(this._domainsOf(f), f);
      const clear = this._dlg().querySelector('[data-wf="eq-clear"]');
      if (clear) clear.hidden = !el.value;
      this._dlg().querySelector(".ag-combo")?.classList.add("open");
      return true;
    }
    if (act === "cb") {
      this.edit.cb = { key: el.dataset.key, q: el.value };
      // Nur die Liste neu, das Feld behält Fokus und Schreibmarke
      el.closest(".ag-combo").querySelector(".ag-combo-list").innerHTML = this._cbItems(el.dataset.key, f);
      el.closest(".ag-combo").classList.add("open");
      return true;
    }
    if (act === "f") {
      const key = el.dataset.key;
      if (key === "domain" || key === "service") {
        f[key] = el.value;
        if (key === "domain") f.service = "";
        f.data = {};
        f.extra = {};
        this.renderEditor();
      } else if (key === "sound") {
        this._stopPreview();
        if (el.value === "__upload") {
          // "Eigenen Ton hochladen": das Formular erscheint unter dem Feld, der Ton bleibt, wie er war, bis der neue da ist
          this.edit.upload = this.edit.upload || { name: "", error: "", busy: false };
        } else {
          f.sound = el.value;
          if (this.edit) this.edit.upload = null;
        }
        this.renderEditor();
      } else if (key === "ntTitle" || key === "ntMessage") {
        // Entspricht der Text dem Standard, bleibt das Feld leer (folgt der Sprache)
        const def = this._ntDefaults(f)[key === "ntTitle" ? 0 : 1];
        f[key] = el.value.trim() === def ? "" : el.value;
        const prev = this._dlg().querySelector("#ag-ntprev");
        if (prev) prev.innerHTML = this._ntPreview(f);
      } else f[key] = el.value;
      return true;
    }
    if (act === "hc-id") {
      f.hcId = el.value;
      if (!f.hcTouched) f.hcSuffix = this._hcSuggestion(f.hcId); // ein erkannter Dienst bringt seinen Vorschlag mit, solange niemand den Zusatz berührt hat
      this.renderEditor();
      return true;
    }
    if (act === "hc-suffix") {
      f.hcSuffix = el.value;
      f.hcTouched = true; // der Nutzer hat das letzte Wort
      this._hcRefresh();
      return true;
    }
    if (act === "cs-name") {
      if (this.edit?.upload) this.edit.upload.name = el.value;
      return true;
    }
    if (act === "scene") {
      f.targets = el.value ? [el.value] : [];
      return true;
    }
    if (act === "nt-tgt-add") {
      if (el.value && /^notify\.[a-z0-9_]+$/.test(el.value) && !(f.ntTargets || []).includes(el.value)) f.ntTargets = [...(f.ntTargets || []), el.value];
      this.renderEditor();
      return true;
    }
    if (act === "nt-click") {
      f.ntClick = el.value === "log" && f.kind !== "notice" ? null : el.value; // die festen Meldungen führen standardmässig zur Übersicht
      this.renderEditor();
      return true;
    }
    if (act === "nt-vol") {
      f.ntVolume = Number(el.value) / 100;
      el.closest(".ag-ef-range").querySelector(".ag-ef-val").textContent = `${el.value} %`;
      return true;
    }
    if (act === "pvol") {
      f.volumes = { ...(f.volumes || {}), [el.dataset.ent]: Number(el.value) / 100 };
      el.closest(".ag-ef-range").querySelector(".ag-ef-val").textContent = `${el.value} %`;
      return true;
    }
    if (act === "volume") {
      f.volume = Number(el.value) / 100;
      el.closest(".ag-ef-range").querySelector(".ag-ef-val").textContent = `${el.value} %`;
      return true;
    }
    if (act === "opt") {
      const key = el.dataset.key;
      f.opts[key] = el.tagName === "SELECT" ? el.value : Number(el.value);
      const val = el.closest(".ag-opt")?.querySelector(".ag-ef-val");
      if (val) val.textContent = this._optText(key, f.opts[key]);
      return true;
    }
    if (act === "df") {
      if (el.hasAttribute("data-bool")) return true;
      const type = el.dataset.type;
      const key = el.dataset.key;
      if (el.type === "range") {
        f.data[key] = Number(el.value);
        const val = el.closest(".ag-ef-range")?.querySelector(".ag-ef-val");
        if (val) val.textContent = el.value;
      } else if (type === "number" || type === "color_temp") f.data[key] = el.value === "" ? "" : Number(el.value);
      else f.data[key] = el.value;
      return true;
    }
    return false;
  }
}
