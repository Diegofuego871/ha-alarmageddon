// 1.39.0: Eigene Töne: überall wählbar, wo es einen Ton gibt, Hochladen direkt im Editor eines Schritts, Verwalten unter Konfiguration › Anlage.
// Je Sprache, Desktop und Handy, echte Klicks. Das Hochladen läuft gegen den Nachbau (hass.fetchWithAuth), der die Regeln des Servers in klein kennt.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { choose: "Hochladen", noFile: "Keine Datei gewählt", save: "Speichern", many: "in 3 Aktionen genutzt", errText: "Textdatei", errImage: "ein Bild", errServer: "Code 500", errNet: "nicht gesendet", group: "Eigene Töne", up: "+ Eigenen Ton hochladen …", missing: "Eigener Ton gelöscht (Standardton spielt)", used: "in 1 Aktion genutzt", unused: "nicht genutzt", errName: "Gib einen Namen", errFile: "Wähle eine Datei", errInvalid: "kein Ton", errTaken: "schon einen Ton mit diesem Namen", wavOnly: "Formate: WAV." },
  en: { choose: "Upload", noFile: "No file chosen", save: "Save", many: "used in 3 actions", errText: "text file", errImage: "a picture", errServer: "code 500", errNet: "could not be sent", group: "Your own sounds", up: "+ Upload your own sound …", missing: "Own sound deleted (standard sound plays)", used: "used in 1 action", unused: "not used", errName: "Enter a name", errFile: "Choose a file", errInvalid: "not a sound", errTaken: "already a sound with this name", wavOnly: "Formats: WAV." },
};
const STEP = (kind, sound) => ({ type: kind, players: ["media_player.sonos_wohnzimmer"], sound, duration: 5, restore: true });
const WAV = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), Buffer.alloc(40)]);

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config", query: "&sounds=1", prefs: { sub: "actions", trigger: "away" } });
    await s.page.waitForTimeout(500);
    const editStep = async (index) => {
      await s.tap(`.ag-wf-main .ag-wf-step[data-index="${index - 1}"] [data-wf="edit"]`);
      await s.waitFor("return r.getElementById('ag-step').open");
    };
    const dlg = (js) => s.ev(`const d=r.getElementById("ag-step"); ${js}`);
    // zwei Schritte: ein Alarmton mit dem eigenen Ton, ein Aktivierungston mit Standardton
    await s.ev(`const a=r.host.actions; a._setSteps(${JSON.stringify([STEP("sound", "custom_0123456789ab"), STEP("chime", "tone_pip")])}); a.render(); return 1`);
    await s.page.waitForTimeout(300);
    await s.waitFor("return r.querySelectorAll('.ag-wf-main .ag-wf-step').length === 2");

    // ----- Auswahl im Editor -----
    await editStep(1);
    check(`${tag}: Alarmton: der eigene Ton ist gewählt, die Gruppe "${t.group}" enthält ihn und "${t.up}"`, await dlg(`const sel=d.querySelector('[data-key="sound"]'); const g=sel.querySelector('optgroup'); return sel.value === 'custom_0123456789ab' && g.label === ${JSON.stringify(t.group)} && [...g.querySelectorAll('option')].map((o) => o.textContent).join('|') === ${JSON.stringify(`Haustür-Sirene|${t.up}`)}`));
    check(`${tag}: Vorschau des eigenen Tons spielt seine Datei`, await dlg("return d.querySelector('[data-wf=\"pv-play\"]').dataset.url === '/alarmageddon_custom/custom_0123456789ab.wav'"));
    check(`${tag}: ohne Auswahl von "hochladen" kein Formular`, await dlg("return !d.querySelector('[data-cs=upload]')"));

    // ----- Hochladen im Editor -----
    await (await s.el('#ag-step [data-key="sound"]')).selectOption("__upload");
    await s.waitFor("return !!r.getElementById('ag-step').querySelector('[data-cs=upload]')");
    check(`${tag}: Formular unter dem Feld mit Name, Datei und Hinweis zu Formaten und Grenzen, der Ton bleibt gewählt`, await dlg("const u=d.querySelector('[data-cs=upload]'); return !!u.querySelector('[data-cs=name]') && !!u.querySelector('[data-cs=file]') && /30/.test(u.innerText) && d.querySelector('[data-key=\"sound\"]').value === 'custom_0123456789ab'"));
    check(`${tag}: die Dateiauswahl nennt nur Endungen, nie "audio/*", Bilder oder Videos (iPhone bietet sonst Fotomediathek und Videoaufnahme an)`, await dlg("const a=d.querySelector('[data-cs=file]').accept.split(','); return a.length >= 1 && a.every((x) => /^\\.[a-z0-9]+$/.test(x)) && !a.some((x) => /\\.(m4a|aac|mp4|mov|ogg|oga|ogv|jpe?g|png|heic|gif)$/.test(x)) && a.includes('.wav') && a.includes('.mp3')"));
    // 1.73.0 (Wunsch des Nutzers): "Name" und "Datei" sind Kapitel (fetter Titel mit Strich davor) wie im Fenster "Code hinzufügen"
    check(`${tag}: Formular in zwei Kapiteln (Name, Datei) mit Strich vor dem Titel, keine kleinen Beschriftungen`, await dlg("const u=d.querySelector('[data-cs=upload]'); const ts=[...u.querySelectorAll(':scope > .ag-chap > h3.ag-chap-t')]; return ts.length === 2 && !u.querySelector('.ag-ef-l') && ts.every((h) => getComputedStyle(h, '::before').width === '4px' && parseInt(getComputedStyle(h).fontWeight) >= 600) && u.querySelector('.ag-chap > input.ag-input').getBoundingClientRect().width > 150"));
    // 1.63.0 (Wunsch des Nutzers): Dateiwahl als Knopf im Stil des Panels statt des Browser-Felds ("Choose File", leeres Viereck auf dem iPhone)
    const pick = () => dlg(`const u=d.querySelector('[data-cs=upload]'); const b=u.querySelector('.ag-up-choose'); const i=u.querySelector('[data-cs=file]'); const bb=b.getBoundingClientRect(), ib=i.getBoundingClientRect();
      return { text: b.innerText.trim(), icon: b.querySelector('svg path')?.getAttribute('d') || '', isBtn: b.classList.contains('ag-btn'), hidden: getComputedStyle(i).opacity === '0', covers: Math.abs(ib.left - bb.left) <= 1.5 && Math.abs(ib.width - bb.width) <= 3 && Math.abs(ib.height - bb.height) <= 3,
        name: u.querySelector('[data-cs=\"file-name\"]').textContent.trim(), go: u.querySelector('[data-wf=\"cs-go\"]').innerText.trim(), inside: b.getBoundingClientRect().right <= u.getBoundingClientRect().right + 1 }`);
    const p0 = await pick();
    check(`${tag}: Dateiwahl: Knopf "${t.choose}" mit Upload-Symbol, das Feld des Browsers unsichtbar darüber, daneben "${t.noFile}"; unten "${t.save}"`, p0.text === t.choose && p0.icon === "M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" && p0.isBtn && p0.hidden && p0.covers && p0.name === t.noFile && p0.go === t.save && p0.inside, JSON.stringify(p0));
    await (await s.el('#ag-step [data-cs=file]')).setInputFiles({ name: "probe.wav", mimeType: "audio/wav", buffer: Buffer.from("RIFF0000WAVE") });
    check(`${tag}: Dateiwahl: nach der Wahl steht der Name neben dem Knopf`, (await pick()).name === "probe.wav", JSON.stringify(await pick()));
    await (await s.el('#ag-step [data-cs=file]')).setInputFiles([]);
    check(`${tag}: Dateiwahl: abgebrochen (Feld leer): wieder "${t.noFile}"`, (await pick()).name === t.noFile, JSON.stringify(await pick()));
    await s.tap('#ag-step [data-wf="cs-go"]');
    check(`${tag}: ohne Name: Hinweis`, await s.waitFor(`return r.getElementById('ag-step').querySelector('.ag-up-err').textContent.includes(${JSON.stringify(t.errName)})`));
    await s.ev("const i=r.getElementById('ag-step').querySelector('[data-cs=name]'); i.value='Garage'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1");
    await s.tap('#ag-step [data-wf="cs-go"]');
    check(`${tag}: ohne Datei: Hinweis`, await s.waitFor(`return r.getElementById('ag-step').querySelector('.ag-up-err').textContent.includes(${JSON.stringify(t.errFile)})`));
    await (await s.el('#ag-step [data-cs=file]')).setInputFiles({ name: "notiz.txt", mimeType: "text/plain", buffer: Buffer.from("Hallo Welt, kein Ton") });
    await s.tap('#ag-step [data-wf="cs-go"]');
    check(`${tag}: eine Textdatei wird vom Server abgelehnt, der Name bleibt im Feld`, await s.waitFor(`const e=r.getElementById('ag-step'); return e.querySelector('.ag-up-err').textContent.length > 5 && e.querySelector('[data-cs=name]').value === 'Garage'`));
    check(`${tag}: der Server nennt eine Textdatei beim Namen, nicht "fehlgeschlagen"`, await s.waitFor(`return r.getElementById('ag-step').querySelector('.ag-up-err').textContent.includes(${JSON.stringify(t.errText)})`));
    await (await s.el('#ag-step [data-cs=file]')).setInputFiles({ name: "foto.jpg", mimeType: "application/octet-stream", buffer: Buffer.from("0123456789abcdef0123") });
    await s.tap('#ag-step [data-wf="cs-go"]');
    check(`${tag}: ein Foto wird als Bild benannt (iPhone-Fotomediathek)`, await s.waitFor(`return r.getElementById('ag-step').querySelector('.ag-up-err').textContent.includes(${JSON.stringify(t.errImage)})`));
    await (await s.el('#ag-step [data-cs=file]')).setInputFiles({ name: "server.wav", mimeType: "application/octet-stream", buffer: Buffer.from("0123456789abcdef0123") });
    await s.tap('#ag-step [data-wf="cs-go"]');
    check(`${tag}: antwortet der Server ohne Fehlerschlüssel, steht der Statuscode da`, await s.waitFor(`return r.getElementById('ag-step').querySelector('.ag-up-err').textContent.includes(${JSON.stringify(t.errServer)})`));
    await (await s.el('#ag-step [data-cs=file]')).setInputFiles({ name: "network.wav", mimeType: "application/octet-stream", buffer: Buffer.from("0123456789abcdef0123") });
    await s.tap('#ag-step [data-wf="cs-go"]');
    check(`${tag}: kommt die Anfrage nicht an, sagt die Meldung, dass die Datei nicht gesendet werden konnte`, await s.waitFor(`return r.getElementById('ag-step').querySelector('.ag-up-err').textContent.includes(${JSON.stringify(t.errNet)})`));
    await s.ev("const i=r.getElementById('ag-step').querySelector('[data-cs=name]'); i.value='haustür-sirene'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1");
    await (await s.el('#ag-step [data-cs=file]')).setInputFiles({ name: "garage.wav", mimeType: "audio/wav", buffer: WAV });
    await s.tap('#ag-step [data-wf="cs-go"]');
    check(`${tag}: ein schon vergebener Name wird abgelehnt (${t.errTaken})`, await s.waitFor(`return r.getElementById('ag-step').querySelector('.ag-up-err').textContent.includes(${JSON.stringify(t.errTaken)})`));
    check(`${tag}: der Name wird vor dem Hochladen geprüft (nichts gesendet) und die Datei bleibt gewählt, nur der Name ist zu ändern`, await s.ev("const e=r.getElementById('ag-step'); return e.querySelector('[data-cs=\"file-name\"]')?.textContent.trim() === 'garage.wav'") && await s.sim("return window.__uploads.every((u) => u.name !== 'haustür-sirene')"));
    await s.ev("const i=r.getElementById('ag-step').querySelector('[data-cs=name]'); i.value='  Garage   Tor  '; i.dispatchEvent(new Event('input', { bubbles: true })); return 1");

    await s.tap('#ag-step [data-wf="cs-go"]');
    check(`${tag}: der Ton ist hochgeladen und im Schritt gewählt, das Formular ist zu`, await s.waitFor("const e=r.getElementById('ag-step'); const sel=e.querySelector('[data-key=\"sound\"]'); return sel.selectedOptions[0].textContent === 'Garage Tor' && !e.querySelector('[data-cs=upload]')"));
    check(`${tag}: der Server hat Name und Datei bekommen (Name bereinigt)`, await s.sim("return window.__uploads.at(-1).name === 'Garage Tor' && window.__uploads.at(-1).file === 'garage.wav'"));
    // 1.58.0: der Ton ist gespeichert, die Wahl im Schritt noch nicht: dezenter orange Hinweis am Ton
    check(`${tag}: nach dem Hochladen sagt ein dezenter orange Hinweis am Ton, dass der Schritt noch nicht gespeichert ist`, await dlg("const n=d.querySelector('.ag-unsaved-note'); if (!n) return false; const dot=getComputedStyle(n, '::before'); return n.textContent.trim().length > 10 && dot.width === '8px' && dot.borderRadius === '50%'"));
    await (await s.el('#ag-step [data-key="sound"]')).selectOption("siren");
    check(`${tag}: mit einem anderen Ton verschwindet der Hinweis`, await s.waitFor("return !r.getElementById('ag-step').querySelector('.ag-unsaved-note')"));
    await (await s.el('#ag-step [data-key="sound"]')).selectOption({ label: "Garage Tor" });
    await s.tap('#ag-step [data-wf="apply"]');
    check(`${tag}: die Karte nennt den Namen des Tons`, await s.waitFor("return r.querySelector('.ag-wf-main .ag-wf-step .ag-t2').textContent.includes('Garage Tor')"));

    // ----- derselbe Ton in einer anderen Art von Ton -----
    await editStep(2);
    check(`${tag}: auch der Aktivierungston bietet die eigenen Töne an`, await dlg("const g=d.querySelector('[data-key=\"sound\"] optgroup'); return [...g.querySelectorAll('option')].map((o) => o.textContent).slice(0, 2).join('|') === 'Garage Tor|Haustür-Sirene'"));
    await (await s.el('#ag-step [data-key="sound"]')).selectOption({ label: "Haustür-Sirene" });
    await s.tap('#ag-step [data-wf="apply"]');
    check(`${tag}: der Schritt verweist nur auf die Kennung`, await s.ev("return r.host.actions.steps()[1].sound === 'custom_0123456789ab'"));

    // ----- Verwalten unter Konfiguration › Anlage -----
    await s.tap('[data-sub="system"]');
    // Seit 1.56.0 zeigt die Seite nur eine Zusammenfassung und einen Knopf, die Liste steht im Fenster
    await s.waitFor("return !!r.querySelector('[data-sys=\"cs-open\"]')");
    check(`${tag}: Seite: nur Zusammenfassung "2 ${lang === "de" ? "eigene Töne" : "own sounds"}" und Knopf, keine Liste auf der Seite`, await s.ev(`const row=r.querySelector('.ag-sys-form .ag-rtsum [data-sys="cs-open"]')?.closest('.ag-rtsum'); return !!row && /2 /.test(row.innerText) && !r.querySelector('.ag-sys-form [data-cs=manage]') && !r.querySelector('.ag-sys-form .ag-csrow')`));
    // 1.58.0: Hochladen direkt von der Seite (Knopf nicht blau)
    check(`${tag}: Seite: Knopf "Ton hochladen" neben "Töne anzeigen", nicht blau`, await s.ev("const b=r.querySelector('.ag-sys-form .ag-rtsum [data-sys=\"cs-upload-page\"]'); return !!b && !b.classList.contains('primary') && !b.disabled"));
    await s.tap('[data-sys="cs-upload-page"]');
    check(`${tag}: der Knopf der Seite öffnet das Fenster gleich mit dem Formular zum Hochladen`, await s.waitFor("const d=r.getElementById('ag-cslist'); return d.open && !!d.querySelector('[data-cs=upload]')"));
    await s.tap('#ag-cslist [data-sys="cs-cancel"]');
    await s.tap('#ag-cslist [data-sys="cs-close"]');
    await s.waitFor("return !r.getElementById('ag-cslist').open");
    await s.tap('[data-sys="cs-open"]');
    await s.waitFor("return r.getElementById('ag-cslist').open && !!r.querySelector('#ag-cslist [data-cs=manage]')");
    check(`${tag}: Fenster: Fusszeile mit "Schliessen" und "Ton hochladen"`, await s.ev("const f=r.querySelector('#ag-cslist .ag-dlg-btns'); return [...f.querySelectorAll('button')].map((b) => b.dataset.sys).join() === 'cs-close,cs-upload-open'"));
    check(`${tag}: Kapitel "${lang === "de" ? "Eigene Töne" : "Your own sounds"}" listet beide Töne mit Grösse und Nutzung`, await s.ev(`const rows=[...r.querySelectorAll('[data-cs=manage] .ag-csrow')]; return rows.length === 2 && rows[0].textContent.includes('Garage Tor') && rows[0].textContent.includes(${JSON.stringify(t.used)}) && rows[1].textContent.includes('Haustür-Sirene') && rows[1].textContent.includes(${JSON.stringify(t.used)}) && /KB|MB/.test(rows[1].textContent)`));
    check(`${tag}: Nutzung: "Aktion" statt "Schritt", Einzahl und Mehrzahl richtig, keine Klammer "(en)"`, await s.ev(`const one=r.host._t('csUsed'), many=r.host._t('csUsedMany', { n: 3 }), del1=r.host._t('csDeleteUsed', { systems: 'A' }), delN=r.host._t('csDeleteUsedMany', { n: 3, systems: 'A' }); return many === ${JSON.stringify(t.many)} && ![one, many, del1, delN].some((x) => /\\(en\\)|\\(s\\)|Schritt|step/i.test(x))`));
    // Abspielen: der Knopf wird rot (wie der Stopp-Knopf eines Schritts) und danach wieder normal (1.40.0)
    await s.ev("const a=window.Audio; window.__realAudio=a; window.Audio = function () { const o = { play: () => Promise.resolve(), pause() {}, addEventListener() {}, set onended(f) { o._end = f; }, set src(v) {}, currentTime: 0 }; window.__fakeAudio = o; return o; }; return 1");
    await s.tap('[data-cs=manage] .ag-csrow [data-sys="cs-play"]');
    // Seit 1.89.1 steht der Hauptcode im Fenster "Codes anzeigen"; auf der Seite trägt die Zusammenfassung der Codes die Kachel
    check(`${tag}: alle Symbol-Kacheln der Seite (Modi, Codes, Tondatei) sind gleich gross (36 px)`, await s.ev("const els=[...r.querySelectorAll('.ag-moderow .ag-oav, .ag-codesum .ag-oav, .ag-csrow .ag-sndbadge')]; const sizes=els.map((e) => { const b=e.getBoundingClientRect(); return Math.round(b.width) + 'x' + Math.round(b.height); }); return els.length >= 6 && new Set(sizes).size === 1 && sizes[0] === '36x36' && els.some((e) => e.classList.contains('ag-sndbadge')) && els.some((e) => e.closest('.ag-codesum'))"));
    let m;
    check(`${tag}: Eigene Töne: jede Zeile trägt das Dateisymbol mit Wellenform, jeder Ton ein eigenes (aus der Kennung), Knöpfe rund (44 px, seit 1.66.1 wie überall) in einer Zeile (Handy: unter dem Namen, seit 1.56.0)`, (m = await s.ev("const rows=[...r.querySelectorAll('[data-cs=manage] .ag-csrow')]; const sig=rows.map((x) => [...x.querySelectorAll('.ag-wv')].map((b) => b.getAttribute('height')).join(',')); const b=rows[0].querySelector('.ag-sndbadge').getBoundingClientRect(); const t=rows[0].querySelector('.ag-settx').getBoundingClientRect(); const bx=rows[0].querySelector('.ag-csbtns'); const btn=bx.getBoundingClientRect(); const round=[...bx.querySelectorAll('.ag-iconbtn')].every((x) => Math.round(x.getBoundingClientRect().width) === 44 && getComputedStyle(x).borderTopStyle === 'solid'); return { ok: rows.every((x) => x.querySelectorAll('.ag-wv').length === 7 && !!x.querySelector('.ag-sf-page')) && new Set(sig).size === rows.length && b.right <= t.left + 1 && ("+ mobile +" ? btn.top >= t.bottom - 1 : Math.abs((btn.top + btn.bottom) / 2 - (b.top + b.bottom) / 2) < 6) && rows[0].getBoundingClientRect().height < 140 && round, round, sig, h: rows[0].getBoundingClientRect().height, b: [b.left, b.right, b.top, b.bottom], t: [t.left, t.right], btn: [btn.top, btn.bottom] }"), m.ok), JSON.stringify(m));
    check(`${tag}: Eigene Töne: beim Abspielen ist der Knopf rot (Stopp), wie beim Test eines Schritts`, await s.waitFor("const b=r.querySelector('[data-cs=manage] [data-sys=\"cs-stop\"]'); return !!b && (() => { const v = getComputedStyle(b).backgroundColor.match(/[\\d.]+/g).map(Number); const k = getComputedStyle(b).backgroundColor.startsWith('color(') ? 255 : 1; return v[0] * k > 150 && v[0] * k > 2 * v[1] * k && v[0] * k > 2 * v[2] * k; })() && getComputedStyle(b).color === 'rgb(255, 255, 255)'"));
    check(`${tag}: Eigene Töne: beim Abspielen schwingen die Balken des spielenden Tons`, await s.ev("const w=r.querySelector('[data-cs=manage] .ag-sndbadge.playing .ag-wv'); return !!w && getComputedStyle(w).animationName === 'ag-wave' && r.querySelectorAll('[data-cs=manage] .ag-sndbadge.playing').length === 1"));
    await s.tap('[data-cs=manage] [data-sys="cs-stop"]');
    check(`${tag}: Eigene Töne: nach dem Stopp ist der Knopf wieder normal`, await s.waitFor("const b=r.querySelector('[data-cs=manage] .ag-csrow [data-sys=\"cs-play\"]'); return !!b && !/^rgb\\(239, 83, 80\\)$/.test(getComputedStyle(b).backgroundColor) && getComputedStyle(b).animationName === 'none' && !r.querySelector('[data-cs=manage] [data-sys=\"cs-stop\"]')"));
    check(`${tag}: Eigene Töne: nach dem Stopp stehen die Balken still`, await s.ev("return !r.querySelector('[data-cs=manage] .ag-sndbadge.playing') && getComputedStyle(r.querySelector('[data-cs=manage] .ag-wv')).animationName === 'none'"));
    await s.ev("window.Audio = window.__realAudio; return 1");
    await s.tap('[data-cs=manage] [data-sound="custom_000000000002"] [data-sys="cs-rename"]');
    await s.ev("const i=r.querySelector('[data-cs=manage] [data-sys=cs-name-edit]'); i.value='Haustür-Sirene'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1");
    await s.tap('[data-cs=manage] [data-sys="cs-rename-ok"]');
    check(`${tag}: Umbenennen auf einen vergebenen Namen zeigt den Fehler (${t.errTaken})`, await s.waitFor(`return r.querySelector('[data-cs=manage] .ag-up-err').textContent.includes(${JSON.stringify(t.errTaken)})`));
    await s.ev("const i=r.querySelector('[data-cs=manage] [data-sys=cs-name-edit]'); i.value='Tor offen'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1");
    await s.tap('[data-cs=manage] [data-sys="cs-rename-ok"]');
    check(`${tag}: nach dem Umbenennen steht der neue Name da, die Schritte nennen ihn schon`, await s.waitFor("return r.querySelector('[data-cs=manage] [data-sound=\"custom_000000000002\"] b')?.textContent === 'Tor offen'"));
    // Löschen mit Rückfrage und Nennung der Nutzung
    await s.tap('[data-cs=manage] [data-sound="custom_0123456789ab"] [data-sys="cs-delete"]');
    check(`${tag}: Löschen fragt nach und nennt die Zahl der Aktionen, die den Ton nutzen`, await s.waitFor("const c=r.getElementById('ag-confirm'); return c.open && /1 (Aktion|action)/.test(c.innerText) && c.innerText.includes('Haustür-Sirene')"));
    await s.tap('#ag-confirm [data-c="yes"]');
    check(`${tag}: nach dem Löschen ist der Ton aus der Liste`, await s.waitFor("return r.querySelectorAll('[data-cs=manage] .ag-csrow').length === 1"));
    await s.tap('#ag-cslist [data-sys="cs-close"]');
    await s.waitFor("return !r.getElementById('ag-cslist').open");
    await s.tap('[data-sub="actions"]');
    await s.waitFor("return !!r.querySelector('.ag-wf-main .ag-wf-step')");
    check(`${tag}: Schritte mit dem gelöschten Ton zeigen "${t.missing}"`, await s.waitFor(`const x=[...r.querySelectorAll('.ag-wf-main .ag-wf-step .ag-t2')]; return x[1].textContent.includes(${JSON.stringify(t.missing)}) && !x[0].textContent.includes(${JSON.stringify(t.missing)})`));
    await editStep(2);
    check(`${tag}: im Editor bleibt "${t.missing}" sichtbar gewählt`, await dlg(`return d.querySelector('[data-key="sound"]').selectedOptions[0].textContent === ${JSON.stringify(t.missing)}`));
    await s.tap('#ag-step [data-wf="close"]');
    check(`${tag}: keine Fehler im Browser`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
  // Ohne ffmpeg nennt das Formular nur WAV
  const s = await open(browser, { lang, tab: "config", query: "&ffmpeg=0", prefs: { sub: "actions", trigger: "away" } });
  await s.ev(`const a=r.host.actions; a._setSteps(${JSON.stringify([STEP("sound", "siren")])}); a.render(); return 1`);
  await s.page.waitForTimeout(300);
  await s.tap('.ag-wf-main .ag-wf-step [data-wf="edit"]');
  await s.waitFor("return r.getElementById('ag-step').open");
  await (await s.el('#ag-step [data-key="sound"]')).selectOption("__upload");
  await s.waitFor("return !!r.getElementById('ag-step').querySelector('[data-cs=upload]')");
  check(`${lang}: ohne ffmpeg: Hinweis nennt nur WAV und die Dateiauswahl nimmt nur WAV an`, await s.ev(`const u=r.getElementById('ag-step').querySelector('[data-cs=upload]'); return u.innerText.includes(${JSON.stringify(T[lang].wavOnly)}) && u.querySelector('[data-cs=file]').accept.includes('.wav') && !u.querySelector('[data-cs=file]').accept.includes('mp3')`));
  await s.ctx.close();
}
await browser.close();
done();
