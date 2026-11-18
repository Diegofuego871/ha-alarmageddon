// Eigene Töne (1.39.0): Hochladen, Auswahl und Verwalten. Die Töne gehören dem ganzen Panel (alle Anlagen, alle Arten von Tönen); ein Schritt
// verweist nur auf die Kennung. Hochgeladen wird per HTTP mit der Anmeldung von Home Assistant (hass.fetchWithAuth), die Datei wird auf dem
// Server geprüft und in das Format der mitgelieferten Töne gebracht.

const V = new URL(import.meta.url).search;
const { ic, esc, fmtDur } = await import(`./common.js${V}`);

export const CUSTOM_RE = /^custom_[0-9a-f]{12}$/;
export const isCustom = (id) => CUSTOM_RE.test(String(id || ""));
export const customList = (host) => host._data?.custom_sounds || [];
export const customName = (host, id) => customList(host).find((s) => s.id === id)?.name || null;
export const limits = (host) => host._data?.custom_sound_limits || { max: 20, seconds: 30, bytes: 8 * 1024 * 1024, total: 12 * 1024 * 1024, ffmpeg: false };

// Welche Schritte nennen den Ton? Je Anlage alle Listen des Ablaufs
const LISTS = ["workflows", "workflows_after", "workflows_armed", "workflows_arming", "workflows_entry", "workflows_disarmed", "workflows_report"];
export function usage(host, id) {
  const systems = [];
  let steps = 0;
  for (const sys of host._data?.systems || []) {
    let own = 0;
    // Hat der Nutzer die Aktionen dieser Anlage gerade in Bearbeitung, zählt, was er sieht (der Entwurf), sonst der gespeicherte Stand
    const draft = host.actions?.draft?.entry === sys.entry_id ? host.actions.draft : null;
    const source = draft ? { workflows: draft.wf, workflows_after: draft.after, workflows_armed: draft.armed, workflows_arming: draft.arming, workflows_entry: draft.entrySteps, workflows_disarmed: draft.disarmed, workflows_report: draft.report } : sys;
    for (const key of LISTS) for (const list of Object.values(source[key] || {})) for (const step of (list || []).flatMap((item) => (item?.type === "group" ? item.steps || [] : [item]))) if (step?.sound === id) own += 1; // auch in Gruppen
    if (own) systems.push(sys.title);
    steps += own;
  }
  return { steps, systems };
}

export const fmtSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const fmtSeconds = (s) => (s < 10 ? `${s.toFixed(1)} s` : fmtDur(s));
export const soundInfo = (s) => `${fmtSeconds(Number(s.seconds) || 0)} · ${fmtSize(Number(s.size) || 0)}`;

// Formular zum Hochladen: `attr(name)` liefert das Attribut für die Ereignisse (data-wf oder data-sys), `ui` den Stand {name, error, busy}
export function uploadHtml(t, host, ui, attr) {
  const lim = limits(host);
  const formats = lim.ffmpeg ? "WAV, MP3, OGG, FLAC, M4A" : "WAV";
  // Nur Endungen, kein "audio/*" (1.43.1): iOS bietet bei jedem MIME-Typ mit "audio/", "video/" oder "image/" Fotomediathek und Videoaufnahme an;
  // mit reinen Endungen zeigt es nur die Dateiauswahl. Bewusst ohne .m4a und .ogg (iOS ordnet M4A dem MPEG-4-Typ zu, der als Film gilt); der Server erkennt das Format ohnehin am Inhalt, die Auswahl ist nur eine Vorfilterung.
  const accept = lim.ffmpeg ? ".wav,.mp3,.flac" : ".wav";
  return `<div class="ag-up" data-cs="upload">
    <div class="ag-ef"><div class="ag-ef-l">${esc(t("upName"))}</div><input class="ag-input" type="text" maxlength="40" value="${esc(ui.name || "")}" ${attr("cs-name")} data-cs="name" placeholder="${esc(t("upNamePh"))}" aria-label="${esc(t("upName"))}"></div>
    <div class="ag-ef"><div class="ag-ef-l">${esc(t("upFile"))}</div>${pickHtml(t, accept, ui.file)}</div>
    <div class="ag-pv-note">${ic("info", 14)} ${esc(t("upHint", { formats, seconds: lim.seconds, mb: Math.round(lim.bytes / 1048576) }))}${lim.ffmpeg ? "" : ` ${esc(t("upNoFfmpeg"))}`}</div>
    <div class="ag-dlg-err ag-up-err" aria-live="polite">${esc(ui.error || "")}</div>
    <div class="ag-btnrow"><button type="button" class="ag-btn primary" ${attr("cs-go")} ${ui.busy ? "disabled" : ""}>${ic("check", 18)}${esc(t(ui.busy ? "upBusy" : "upGo"))}</button>
      <button type="button" class="ag-btn" ${attr("cs-cancel")} ${ui.busy ? "disabled" : ""}>${esc(t("cancel"))}</button></div></div>`;
}

// Dateiwahl (1.63.0, Wunsch des Nutzers): ein Knopf im Stil des Panels mit Upload-Symbol statt des Felds des Browsers. Dieses zeigte auf
// Deutsch "Choose File" (der Browser übersetzt es nicht) und auf dem iPhone nach der Wahl ein leeres Viereck vor dem Namen. Das echte Feld liegt
// unsichtbar über dem Knopf (nicht "hidden": so öffnet ein Tippen die Auswahl in jedem Browser, auch auf dem iPhone); daneben steht der Name.
function pickHtml(t, accept, file) {
  return `<div class="ag-up-pick"><label class="ag-btn ag-up-choose">${ic("upload", 18)}<span>${esc(t("upChoose"))}</span><input class="ag-up-input" type="file" accept="${accept}" data-cs="file" aria-label="${esc(t("upChoose"))}"></label>
    <span class="ag-up-name ${file ? "" : "ag-t2"}" data-cs="file-name" data-empty="${esc(t("upNoFile"))}">${esc(file ? file.name : t("upNoFile"))}</span></div>`;
}

// Die Wahl im Dateifeld hat sich geändert: den Namen neben dem Knopf zeigen und die Datei im Stand merken (das Formular kann neu gezeichnet
// werden, ein Dateifeld lässt sich nicht wieder füllen). Leert der Browser das Feld (Auswahl abgebrochen), ist auch keine Datei mehr gewählt.
export function filePicked(el, ui) {
  const file = el.files?.[0] || null;
  if (ui) ui.file = file;
  const name = el.closest(".ag-up-pick")?.querySelector('[data-cs="file-name"]');
  if (name) {
    name.textContent = file ? file.name : name.dataset.empty;
    name.classList.toggle("ag-t2", !file);
  }
}

export function uploadError(t, code, status) {
  const text = t(`upErr_${code}`, { status: status || "?" });
  return text === `upErr_${code}` ? t("upErr_upload_failed") : text;
}

// Die gewählte Datei hochladen. Wirft einen Fehler mit `code` (Schlüssel des Servers oder "upload_failed").
export async function uploadSound(host, root, ui, t) {
  const name = String(ui.name || "").trim();
  // Die Datei bleibt im Stand (ui.file), auch wenn das Formular nach einem Fehler neu gezeichnet wird: nur das Feld ändern, nicht neu wählen
  const file = root.querySelector('[data-cs="file"]')?.files?.[0] || ui.file;
  if (file) ui.file = file;
  if (!name) throw Object.assign(new Error("name_invalid"), { code: "name_invalid" });
  // Name vorher prüfen (ohne Hochladen), wie der Server: Gross- und Kleinschreibung und Leerzeichen zählen nicht
  const norm = (x) => String(x).split(/\s+/).filter(Boolean).join(" ").toLowerCase();
  if (customList(host).some((x) => norm(x.name) === norm(name))) throw Object.assign(new Error("name_taken"), { code: "name_taken" });
  if (!file) throw Object.assign(new Error("no_file"), { code: "no_file" });
  if (file.size > limits(host).bytes) throw Object.assign(new Error("too_big"), { code: "too_big" });
  const body = new FormData();
  body.append("name", name);
  body.append("file", file, file.name);
  let res;
  try {
    res = await host._hass.fetchWithAuth("/api/alarmageddon/sounds", { method: "POST", body });
  } catch {
    // Die Anfrage kam nicht an (Verbindung weg) oder die Datei liess sich nicht lesen (zum Beispiel nur in der Cloud, nicht auf dem Gerät)
    throw Object.assign(new Error("network"), { code: "network" });
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* Antwort ohne Inhalt */
  }
  // Ohne Fehlerschlüssel stammt die Antwort nicht von der Tonverwaltung (Proxy, Fehlerseite): den Statuscode zeigen
  if (!res.ok || !data.sound) throw Object.assign(new Error(data.error || "server"), { code: data.error || "server", status: res.status });
  host._data.custom_sounds = [...customList(host), data.sound].sort((a, b) => a.name.localeCompare(b.name, host._lang || "en"));
  return data.sound;
}

// Kennzeichen einer Tondatei: eine Dateiseite mit Eselsohr und einer kleinen Wellenform. Die Balken ergeben sich aus der Kennung des Tons,
// jeder Ton hat also sein eigenes Bild (gleiche Kennung, gleiches Bild). Beim Abspielen bewegen sich die Balken.
export function soundBadge(id, playing = false) {
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const heights = [];
  for (let i = 0; i < 4; i++) {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    heights.push(5 + (h % 12));
  }
  const bars = [...heights, ...heights.slice(0, 3).reverse()];
  const rects = bars.map((v, i) => `<rect class="ag-wv" style="--d:${(i * 0.13).toFixed(2)}s" x="${9.2 + i * 3.4}" y="${(29 - v / 2).toFixed(1)}" width="2.2" height="${v}" rx="1.1"/>`).join("");
  return `<span class="ag-sndbadge ${playing ? "playing" : ""}" aria-hidden="true"><svg width="29" height="34" viewBox="0 0 38 44">
    <path class="ag-sf-page" d="M6 3h17l11 11v26a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"/><path class="ag-sf-fold" d="M23 3v8a3 3 0 0 0 3 3h8"/>${rects}</svg></span>`;
}
