// "Beim Scharfschalten umgehen" nur für offene Sensoren (1.89.0, Frage und Entscheid des Nutzers 2026-11-25: "Nur für offene"). Der Schalter steht
// eingerückt direkt unter "Muss beim Scharfschalten geschlossen sein" und erscheint nur, solange dieser an ist (sonst wirkt er nie); bei
// Bewegungsmeldern gibt es beide nicht. Die Erklärungen nennen "Umgehen" nicht mehr bei der Erreichbarkeit. In den Voreinstellungen steht "–",
// wo er nicht wirkt. Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { bypass: "Beim Scharfschalten umgehen", close: "Muss beim Scharfschalten geschlossen sein", word: "umgehen", short: "umgangen",
    hint: "verhindert er das Scharfschalten nicht, sondern wird bis zum Deaktivieren übergangen" },
  en: { bypass: "Bypass when arming", close: "Must be closed when arming", word: "Bypass", short: "bypassed",
    hint: "it does not prevent arming but is skipped until the alarm system is disarmed" },
};
const WINDOW = "binary_sensor.fenster_bad";
const MOTION = "binary_sensor.bewegung_flur";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const J = JSON.stringify;
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "sensors" } });
    const SHEET = mobile ? "#ag-sheet" : ".ag-side";
    const openSheet = async (id) => {
      await s.tap(`[data-sen="detail"][data-ent="${id}"]`);
      await s.waitFor(`return !!r.querySelector('${SHEET} [data-key="reachable"]')`);
    };
    const closeSheet = async () => {
      if (mobile) await s.tap('#ag-sheet .ag-dlg-btns [data-sen="close-detail"]');
      else await s.tap('.ag-side [data-sen="close-detail"]');
      await s.waitFor(mobile ? "return !r.getElementById('ag-sheet').open" : "return !r.querySelector('.ag-sheet')");
    };
    const rows = () => s.ev(`const sh=r.querySelector('${SHEET}'); const row=(k) => sh.querySelector('[data-key="' + k + '"]')?.closest('.ag-orow');
      const close=row('open_ok'), by=row('bypass'), reach=row('reachable');
      return { close: !!close, bypass: !!by, sub: !!by?.classList.contains('ag-osub'), next: !!close && close.nextElementSibling === by,
        indent: by && close ? Math.round(by.querySelector('.ag-toggle').getBoundingClientRect().left - close.querySelector('.ag-toggle').getBoundingClientRect().left) : null,
        line: close ? getComputedStyle(close).borderBottomWidth : null, title: by?.querySelector('b')?.textContent, hint: by?.querySelector('small')?.textContent,
        reachHint: reach?.querySelector('small')?.textContent, wide: sh.scrollWidth <= sh.clientWidth + 1 }`);

    // ----- Fenster: "Muss geschlossen sein" an (Voreinstellung) -----
    await openSheet(WINDOW);
    const on = await rows();
    check(`${tag}: Fenster: "${t.bypass}" direkt unter "${t.close}", eingerückt, ohne Linie dazwischen`,
      on.close && on.bypass && on.sub && on.next && on.indent >= 20 && on.line === "0px" && on.title === t.bypass && on.wide, J(on));
    check(`${tag}: Erklärung von "${t.bypass}" nur für offene Sensoren, "Muss erreichbar sein" nennt "${t.word}" nicht mehr`,
      on.hint.includes(t.hint) && !on.hint.toLowerCase().includes(lang === "de" ? "erreichbar" : "reachable") && !on.reachHint.includes(t.word), J({ hint: on.hint, reach: on.reachHint }));
    // "Muss geschlossen sein" aus: "Umgehen" verschwindet; wieder an: es ist zurück
    await s.tap(`${SHEET} [data-sen="opt"][data-key="open_ok"]`);
    check(`${tag}: "${t.close}" aus: "${t.bypass}" verschwindet`, await s.waitFor(`const sh=r.querySelector('${SHEET}'); return sh.querySelector('[data-sen="opt"][data-key="open_ok"]').getAttribute('aria-checked') === 'false' && !sh.querySelector('[data-key="bypass"]')`));
    // Ein eigener Wert "Umgehen" ohne "Muss geschlossen sein" zeigt in der Tabelle keinen Kurztext "umgangen"
    await s.ev(`const d=r.host.sensors.draft; d.opts["${WINDOW}"] = { ...(d.opts["${WINDOW}"] || {}), bypass: true }; r.host.sensors.render(); return 1`);
    const rowText = await s.waitFor(`return !(r.querySelector('tr[data-row="${WINDOW}"]')?.innerText || '').includes(${J(t.short)})`);
    check(`${tag}: Tabelle: "Umgehen" ohne "Muss geschlossen sein" ohne Kurztext "${t.short}"`, rowText);
    await s.tap(`${SHEET} [data-sen="opt"][data-key="open_ok"]`);
    check(`${tag}: "${t.close}" wieder an: "${t.bypass}" ist zurück (an), Kurztext "${t.short}" in der Tabelle`, await s.waitFor(`const sh=r.querySelector('${SHEET}'); const b=sh.querySelector('[data-sen="opt"][data-key="bypass"]');
      return !!b && b.getAttribute('aria-checked') === 'true' && b.closest('.ag-orow').classList.contains('ag-osub') && (r.querySelector('tr[data-row="${WINDOW}"]')?.innerText || '').includes(${J(t.short)})`));
    await closeSheet();
    await s.tap('[data-sen="cancel"]');

    // ----- Bewegungsmelder: weder "Muss geschlossen sein" noch "Umgehen" -----
    await openSheet(MOTION);
    const motion = await rows();
    check(`${tag}: Bewegungsmelder: weder "${t.close}" noch "${t.bypass}"`, !motion.close && !motion.bypass, J(motion));
    await closeSheet();

    // ----- Voreinstellungen: "–", wo "Umgehen" nicht wirkt -----
    await s.tap('[data-sen="presets"]');
    await s.waitFor("return r.getElementById('ag-presets').open");
    const pre = await s.ev(`const heads=[...r.querySelectorAll('#ag-presets th')].map((th) => th.textContent);
      return { order: heads.indexOf(${J(t.bypass)}) - heads.indexOf(${J(t.close)}), at: heads.indexOf(${J(t.bypass)}),
        door: !!r.querySelector('#ag-presets [data-kind="door"][data-key="bypass"]'), window: !!r.querySelector('#ag-presets [data-kind="window"][data-key="bypass"]'),
        motion: !!r.querySelector('#ag-presets [data-kind="motion"][data-key="bypass"]') }`);
    check(`${tag}: Voreinstellungen: Spalte "${t.bypass}" direkt nach "${t.close}", Tür mit Kästchen, Bewegung ohne`, pre.at > 0 && pre.order === 1 && pre.door && pre.window && !pre.motion, J(pre));
    await s.tap('#ag-presets [data-kind="door"][data-key="open_ok"]');
    check(`${tag}: Voreinstellungen: Tür "${t.close}" aus: "Umgehen" der Tür wird "–"`, await s.waitFor("return !r.querySelector('#ag-presets [data-kind=\"door\"][data-key=\"bypass\"]') && !!r.querySelector('#ag-presets [data-kind=\"window\"][data-key=\"bypass\"]')"));
    await s.tap('[data-sen="presets-cancel"]');

    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
