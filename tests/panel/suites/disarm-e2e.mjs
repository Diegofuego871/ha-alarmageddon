// 1.78.0: "Deaktivieren im Alarm" je Anlage (Wunsch des Nutzers 2026-11-22): senkrechte Reiterleiste mit Kapsel unter Konfiguration › Anlage › Zeiten und Verhalten,
// neben jeder Stellung Titel und Beschreibung; Standard "beendet den Alarm"; Entwurf mit "Speichern", gilt je Anlage und nicht je Modus (der Schalter "Einstellungen pro
// Modus" ändert nichts daran). Je Sprache, Desktop und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { title: "Deaktivieren im Alarm", end: "Deaktivieren beendet den Alarm", ack: "Deaktivieren quittiert nur", def: "Standard" },
  en: { title: "Disarming during an alarm", end: "Disarming ends the alarm", ack: "Disarming only acknowledges", def: "Default" },
};
const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" } });
    await s.waitFor("return !!r.querySelector('.ag-vseg')");
    const st = () => s.ev(`const v=r.querySelector('.ag-vseg'); const on=v.querySelector(':scope > button.on'); const pill=v.querySelector(':scope > .ag-pill'); const pr=pill?.getBoundingClientRect(), br=on?.getBoundingClientRect(); const chap=v.closest('.ag-chap');
      return { on: on?.dataset.val, titles: [...v.querySelectorAll('.ag-vopt b')].map((b) => b.textContent.trim()), tab: v.getAttribute('role'), pill: pr && br ? Math.abs(pr.top - br.top) < 2 && Math.abs(pr.height - br.height) < 2 : null, vertical: !!pr && pr.height > pr.width, inPm: !!v.closest('.ag-pmgroup'), chap: chap?.querySelector('.ag-chap-t')?.textContent, save: r.querySelector('[data-sys=save]').disabled, dot: !!r.querySelector('.ag-tab-dot, [data-dirty], .ag-dirty') }`);
    check(`${tag}: im Standard keine Warnung`, (await s.ev("return !r.querySelector('.ag-vwarn')")) === true);
    const a = await st();
    check(`${tag}: Standard "${t.end}" gewählt, beide Stellungen mit Titel (Standard-Marke an der ersten), Kapsel senkrecht am gewählten Knopf`, a.on === "end" && a.titles[0] === `${t.end} ${t.def}` && a.titles[1] === t.ack && a.pill && a.vertical && a.tab === "tablist", JSON.stringify(a));
    check(`${tag}: steht im Kapitel "Zeiten und Verhalten", aber nicht in der Gruppe je Modus (gilt je Anlage)`, !a.inPm && a.chap === (lang === "de" ? "Zeiten und Verhalten" : "Times and behaviour") && a.save === true, JSON.stringify(a));
    // Wahl: Text antippen oder Symbol antippen
    await s.tap('.ag-vopt[data-val="ack"]');
    await s.page.waitForTimeout(700);
    const b = await st();
    check(`${tag}: Antippen des Textes wählt "${t.ack}", die Kapsel fährt mit, "Speichern" wird frei`, b.on === "ack" && b.pill && b.save === false, JSON.stringify(b));
    const warn = () => s.ev("const w=r.querySelector('.ag-vwarn'); return w ? { text: w.textContent.trim(), vis: w.getBoundingClientRect().height > 0, icon: !!w.querySelector('svg') } : null");
    const w0 = await warn();
    const w1 = await warn();
    check(`${tag}: mit "${t.ack}" steht eine Warnung (weicht vom Standard ab, HomeKit zeigt weiter "Scharf") unter dem Schieber`, w0 && w0.vis && w0.icon && /HomeKit/.test(w0.text) && w1.text === w0.text, JSON.stringify(w0));
    // Der Schalter "Einstellungen pro Modus" ändert nichts an der Wahl
    await s.tap('[data-sys="permode"]');
    await s.page.waitForTimeout(300);
    check(`${tag}: der Schalter "Einstellungen pro Modus" ändert die Wahl nicht`, (await st()).on === "ack");
    await s.tap('[data-sys="permode"]');
    await s.tap('[data-sys="cancel"]');
    await s.page.waitForTimeout(400);
    check(`${tag}: Abbrechen stellt den Standard wieder her, die Warnung verschwindet`, (await st()).on === "end" && (await warn()) === null);
    await s.tap('.ag-vseg > button[data-val="ack"]');
    await s.tap('[data-sys="save"]');
    await s.page.waitForTimeout(900);
    const saved = await s.sim("return window.__disarmEnds");
    const c = await st();
    check(`${tag}: Speichern schickt disarm_ends_alarm=false, danach bleibt die Wahl und es gibt keine offene Änderung`, saved === false && c.on === "ack" && c.save === true, JSON.stringify([saved, c]));
    await s.tap('.ag-vseg > button[data-val="end"]');
    await s.tap('[data-sys="save"]');
    await s.page.waitForTimeout(900);
    check(`${tag}: zurück auf "${t.end}" und speichern`, (await s.sim("return window.__disarmEnds")) === true && (await st()).on === "end");
    check(`${tag}: keine Fehler im Panel`, s.errors.length === 0, s.errors.join("|"));
    await s.ctx.close();
  }
}
await browser.close();
done();
