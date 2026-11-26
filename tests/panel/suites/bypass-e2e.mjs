// "Beim Scharfschalten umgehen" gibt es seit 1.92.0 nicht mehr (Frage des Nutzers 2026-11-26: "Haben wir diese Option nicht gestrichen? ... das
// widerspricht sich doch", Entscheid "Ja mach es so"). Bis 1.91.x stand der Schalter eingerückt unter "Muss beim Scharfschalten geschlossen sein"
// (1.89.0). Jetzt: kein Schalter im Blatt, keine Spalte in den Voreinstellungen, kein Kurztext "umgangen" in der Tabelle, auch nicht für einen Rest im
// Entwurf; die Erklärung von "Muss geschlossen sein" sagt, was "aus" bedeutet (darf offen sein, ein neues Öffnen zählt). Die Umstellung des Bestands
// rechnet der Server (tests/test_bypass_removed.py). Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { bypass: "Beim Scharfschalten umgehen", close: "Muss beim Scharfschalten geschlossen sein", word: "umgeh", short: "umgangen",
    hint: "Ist er beim Scharfschalten offen, ist Scharfschalten nicht möglich. Aus: er darf offen sein; erst ein neues Öffnen nach dem Scharfschalten zählt." },
  en: { bypass: "Bypass when arming", close: "Must be closed when arming", word: "bypass", short: "bypassed",
    hint: "If it is open when arming, arming is not possible. Off: it may be open; only opening it again after arming counts." },
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
    const sheet = () => s.ev(`const sh=r.querySelector('${SHEET}'); const row=(k) => sh.querySelector('[data-key="' + k + '"]')?.closest('.ag-orow');
      const close=row('open_ok'), reach=row('reachable'), text=sh.innerText;
      return { close: !!close, title: close?.querySelector('b')?.textContent, hint: close?.querySelector('small')?.textContent, reachHint: reach?.querySelector('small')?.textContent,
        bypass: !!sh.querySelector('[data-key="bypass"]'), sub: !!sh.querySelector('.ag-osub'), named: text.includes(${J(t.bypass)}), wide: sh.scrollWidth <= sh.clientWidth + 1 }`);
    const rowText = () => s.ev(`return r.querySelector('tr[data-row="${WINDOW}"]')?.innerText || ''`);

    // ----- Fenster: nur "Muss geschlossen sein", mit der neuen Erklärung -----
    await openSheet(WINDOW);
    const on = await sheet();
    check(`${tag}: Fenster: "${t.close}" mit Erklärung, kein "${t.bypass}"`,
      on.close && on.title === t.close && on.hint === t.hint && !on.bypass && !on.sub && !on.named && on.wide, J(on));
    check(`${tag}: "Muss erreichbar sein" nennt "${t.word}" nicht`, !on.reachHint.toLowerCase().includes(t.word), on.reachHint);
    // "Muss geschlossen sein" aus: es erscheint nichts darunter (bis 1.91.x kam hier "Umgehen" weg und wieder)
    await s.tap(`${SHEET} [data-sen="opt"][data-key="open_ok"]`);
    check(`${tag}: "${t.close}" aus: kein "${t.bypass}"`, await s.waitFor(`const sh=r.querySelector('${SHEET}'); return sh.querySelector('[data-sen="opt"][data-key="open_ok"]').getAttribute('aria-checked') === 'false'
      && !sh.querySelector('[data-key="bypass"], .ag-osub')`));
    await s.tap(`${SHEET} [data-sen="opt"][data-key="open_ok"]`);
    check(`${tag}: "${t.close}" wieder an: kein "${t.bypass}"`, await s.waitFor(`const sh=r.querySelector('${SHEET}'); return sh.querySelector('[data-sen="opt"][data-key="open_ok"]').getAttribute('aria-checked') === 'true'
      && !sh.querySelector('[data-key="bypass"], .ag-osub')`));
    // Ein Rest "Umgehen" im Entwurf (gibt es vom Server nicht mehr, er stellt beim Laden um) zeigt weder Schalter noch Kurztext
    await s.ev(`const d=r.host.sensors.draft; d.opts["${WINDOW}"] = { ...(d.opts["${WINDOW}"] || {}), bypass: true }; r.host.sensors.render(); return 1`);
    await s.page.waitForTimeout(300);
    const rest = await sheet();
    check(`${tag}: Rest "Umgehen" im Entwurf: kein Schalter, kein Kurztext "${t.short}" in der Tabelle`, !rest.bypass && !rest.named && !(await rowText()).includes(t.short), J({ rest, row: await rowText() }));
    await closeSheet();
    await s.tap('[data-sen="cancel"]');

    // ----- Bewegungsmelder: kein "Muss geschlossen sein" (darf immer offen sein) -----
    await openSheet(MOTION);
    const motion = await sheet();
    check(`${tag}: Bewegungsmelder: weder "${t.close}" noch "${t.bypass}"`, !motion.close && !motion.bypass && !motion.named, J(motion));
    await closeSheet();

    // ----- Voreinstellungen: keine Spalte "Umgehen" -----
    await s.tap('[data-sen="presets"]');
    await s.waitFor("return r.getElementById('ag-presets').open");
    const pre = await s.ev(`const heads=[...r.querySelectorAll('#ag-presets th')].map((th) => th.textContent);
      return { close: heads.includes(${J(t.close)}), bypass: heads.includes(${J(t.bypass)}), boxes: r.querySelectorAll('#ag-presets [data-key="bypass"]').length,
        text: r.getElementById('ag-presets').innerText.includes(${J(t.bypass)}) }`);
    check(`${tag}: Voreinstellungen: Spalte "${t.close}", keine Spalte und kein Kästchen "${t.bypass}"`, pre.close && !pre.bypass && pre.boxes === 0 && !pre.text, J(pre));
    await s.tap('[data-sen="presets-cancel"]');

    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
