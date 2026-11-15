// Eigene Töne (1.39.0): Hochladen, Auswahl und Verwalten. Die Töne gehören dem ganzen Panel (alle Anlagen, alle Arten von Tönen); ein Schritt
// verweist nur auf die Kennung. Hochgeladen wird per HTTP mit der Anmeldung von Home Assistant (hass.fetchWithAuth), die Datei wird auf dem
// Server geprüft und in das Format der mitgelieferten Töne gebracht.

const V = new URL(import.meta.url).search;
const { ic, esc } = await import(`./common.js${V}`);

export const CUSTOM_RE = /^custom_[0-9a-f]{12}$/;
export const isCustom = (id) => CUSTOM_RE.test(String(id || ""));
export const customList = (host) => host._data?.custom_sounds || [];
export const customName = (host, id) => customList(host).find((s) => s.id === id)?.name || null;
export const limits = (host) => host._data?.custom_sound_limits || { max: 20, seconds: 30, bytes: 8 * 1024 * 1024, total: 12 * 1024 * 1024, ffmpeg: false };

// Welche Schritte nennen den Ton? Je Anlage alle Listen des Ablaufs
const LISTS = ["workflows", "workflows_after", "workflows_armed", "workflows_arming", "workflows_entry", "workflows_disarmed"];
export function usage(host, id) {
  const systems = [];
  let steps = 0;
  for (const sys of host._data?.systems || []) {
    let own = 0;
    // Hat der Nutzer die Aktionen dieser Anlage gerade in Bearbeitung, zählt, was er sieht (der Entwurf), sonst der gespeicherte Stand
    const draft = host.actions?.draft?.entry === sys.entry_id ? host.actions.draft : null;
    const source = draft ? { workflows: draft.wf, workflows_after: draft.after, workflows_armed: draft.armed, workflows_arming: draft.arming, workflows_entry: draft.entrySteps, workflows_disarmed: draft.disarmed } : sys;
    for (const key of LISTS) for (const list of Object.values(source[key] || {})) for (const step of list || []) if (step?.sound === id) own += 1;
    if (own) systems.push(sys.title);
    steps += own;
  }
  return { steps, systems };
}

export const fmtSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const fmtSeconds = (s) => (s < 10 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`);
export const soundInfo = (s) => `${fmtSeconds(Number(s.seconds) || 0)} · ${fmtSize(Number(s.size) || 0)}`;

// Formular zum Hochladen: `attr(name)` liefert das Attribut für die Ereignisse (data-wf oder data-sys), `ui` den Stand {name, error, busy}
export function uploadHtml(t, host, ui, attr) {
  const lim = limits(host);
  const formats = lim.ffmpeg ? "WAV, MP3, OGG, FLAC, M4A" : "WAV";
  // Nur Audio, ohne Endungen wie .m4a/.aac: iOS ordnet sie dem MPEG-4-Typ zu (der als Film gilt) und bietet dann Fotomediathek und Videoaufnahme an
  const accept = lim.ffmpeg ? ".wav,.mp3,.flac,audio/*" : ".wav,audio/wav,audio/x-wav";
  return `<div class="ag-up" data-cs="upload">
    <div class="ag-ef"><div class="ag-ef-l">${esc(t("upName"))}</div><input class="ag-input" type="text" maxlength="40" value="${esc(ui.name || "")}" ${attr("cs-name")} data-cs="name" placeholder="${esc(t("upNamePh"))}" aria-label="${esc(t("upName"))}"></div>
    <div class="ag-ef"><div class="ag-ef-l">${esc(t("upFile"))}</div><input class="ag-input ag-up-file" type="file" accept="${accept}" data-cs="file" aria-label="${esc(t("upFile"))}"></div>
    <div class="ag-pv-note">${ic("info", 14)} ${esc(t("upHint", { formats, seconds: lim.seconds, mb: Math.round(lim.bytes / 1048576) }))}${lim.ffmpeg ? "" : ` ${esc(t("upNoFfmpeg"))}`}</div>
    <div class="ag-dlg-err ag-up-err" aria-live="polite">${esc(ui.error || "")}</div>
    <div class="ag-btnrow"><button type="button" class="ag-btn primary" ${attr("cs-go")} ${ui.busy ? "disabled" : ""}>${ic("plus", 18)}${esc(t(ui.busy ? "upBusy" : "upGo"))}</button>
      <button type="button" class="ag-btn" ${attr("cs-cancel")} ${ui.busy ? "disabled" : ""}>${esc(t("cancel"))}</button></div></div>`;
}

export function uploadError(t, code) {
  const text = t(`upErr_${code}`);
  return text === `upErr_${code}` ? t("upErr_upload_failed") : text;
}

// Die gewählte Datei hochladen. Wirft einen Fehler mit `code` (Schlüssel des Servers oder "upload_failed").
export async function uploadSound(host, root, ui, t) {
  const name = String(ui.name || "").trim();
  const file = root.querySelector('[data-cs="file"]')?.files?.[0];
  if (!name) throw Object.assign(new Error("name_invalid"), { code: "name_invalid" });
  if (!file) throw Object.assign(new Error("no_file"), { code: "no_file" });
  if (file.size > limits(host).bytes) throw Object.assign(new Error("too_big"), { code: "too_big" });
  const body = new FormData();
  body.append("name", name);
  body.append("file", file, file.name);
  let res;
  try {
    res = await host._hass.fetchWithAuth("/api/alarmageddon/sounds", { method: "POST", body });
  } catch {
    throw Object.assign(new Error("upload_failed"), { code: "upload_failed" });
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* Antwort ohne Inhalt */
  }
  if (!res.ok || !data.sound) throw Object.assign(new Error(data.error || "upload_failed"), { code: data.error || "upload_failed" });
  host._data.custom_sounds = [...customList(host), data.sound].sort((a, b) => a.name.localeCompare(b.name, host._lang || "en"));
  return data.sound;
}
