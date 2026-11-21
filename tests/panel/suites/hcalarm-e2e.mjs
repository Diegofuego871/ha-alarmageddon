// 1.73.0: Alarm-Aufruf der HealthCheck-Dienste (Wunsch des Nutzers 2026-11-20): ein zweiter Knopf "Alarm senden" in der Liste und im Kopf des Protokolls,
// nur bei einem Dienst mit Alarm-Zusatz; die Knöpfe, die eine Aktion auslösen, sind leicht eingefärbt ("Lebenszeichen senden" grün, "Fehler senden" und
// "Alarm senden" orange; Stift und Papierkorb neutral); im Kopf des Protokolls sind das X und die runden Knöpfe gleich gross und auf einer Höhe (iPad,
// Handy, Computer). Je Sprache, Desktop, iPad (1180 px) und Handy, echte Klicks/Taps.
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { testFail: "Fehler senden", testAlarm: "Alarm senden", testOk: "Lebenszeichen senden", edit: "Bearbeiten", alarmSent: "Alarm gesendet" },
  en: { testFail: "Send failure", testAlarm: "Send alarm", testOk: "Send life sign", edit: "Edit", alarmSent: "Alarm sent" },
};
const CRON = "b2c3d4e5f6a1"; // erfundener Dienst mit Fehler- und Alarm-Zusatz (?hc=sample)
const HC = "a1b2c3d4e5f6"; // ohne Alarm-Zusatz

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mode of ["Desktop", "iPad", "Handy"]) {
    const mobile = mode === "Handy";
    const tag = `${lang}/${mode}`;
    const t = T[lang];
    const s = await open(browser, { mobile, lang, theme: "dark", tab: "config", prefs: { sub: "system" }, query: "&hc=sample", size: mode === "iPad" ? { width: 1180, height: 820 } : null });
    await s.waitFor("return !!r.querySelector('.ag-hcsum [data-hc=\"open\"]')");
    await s.tap('.ag-hcsum [data-hc="open"]');
    await s.waitFor("return r.getElementById('ag-hclist').open && r.querySelectorAll('#ag-hclist [data-hc-row]').length === 3");

    // ----- Liste: der Alarm-Knopf nur beim Dienst mit Alarm-Zusatz, in der Reihenfolge Protokoll, Fehler, Alarm, OK, Stift, Papierkorb -----
    const rows = await s.ev(`const f=(id) => [...r.querySelectorAll('#ag-hclist [data-hc-row="' + id + '"] .ag-wf-btns .ag-iconbtn')].map((b) => b.dataset.hc); return { cron: f('${CRON}'), hc: f('${HC}') }`);
    check(`${tag}: Liste: Dienst mit Alarm-Zusatz hat "${t.testAlarm}" zwischen Fehler und OK, der ohne Zusatz nicht`,
      JSON.stringify(rows.cron) === JSON.stringify(["log", "test-fail", "test-alarm", "test-ok", "edit", "delete"]) && JSON.stringify(rows.hc) === JSON.stringify(["log", "test-fail", "test-ok", "edit", "delete"]), JSON.stringify(rows));
    // ----- Farben: grün, orange, neutral -----
    const tones = await s.ev(`const c=(sel) => { const b=r.querySelector('#ag-hclist [data-hc-row="${CRON}"] ' + sel); const st=getComputedStyle(b); const rgb=(x) => { const v=x.match(/[\\d.]+/g).map(Number); return /^color\\(/.test(x) ? [...v.slice(0, 3).map((n) => n * 255), v[3] ?? 1] : v; }; return { color: rgb(st.color), bg: rgb(st.backgroundColor), label: b.getAttribute('aria-label') }; };
      return { ok: c('[data-hc="test-ok"]'), fail: c('[data-hc="test-fail"]'), alarm: c('[data-hc="test-alarm"]'), edit: c('[data-hc="edit"]'), log: c('[data-hc="log"]') }`);
    const greenish = (x) => x.color[1] > x.color[0] && x.color[1] > x.color[2] && (x.bg[3] ?? 1) > 0 && (x.bg[3] ?? 1) < 0.4;
    const orangish = (x) => x.color[0] > x.color[2] + 30 && x.color[1] > x.color[2] && (x.bg[3] ?? 1) > 0 && (x.bg[3] ?? 1) < 0.4;
    check(`${tag}: "${t.testOk}" leicht grün, "${t.testFail}" und "${t.testAlarm}" leicht orange, Stift und Protokoll neutral`,
      greenish(tones.ok) && orangish(tones.fail) && orangish(tones.alarm) && !greenish(tones.edit) && !orangish(tones.edit) && !greenish(tones.log) && !orangish(tones.log), JSON.stringify(tones));

    // ----- Test "Alarm senden" in der Liste -----
    await s.tap(`#ag-hclist [data-hc-row="${CRON}"] [data-hc="test-alarm"]`);
    check(`${tag}: "${t.testAlarm}" ruft den Dienst mit kind "alarm" auf, die Zeile zeigt "${t.alarmSent}"`,
      await s.waitFor(`return r.querySelector('#ag-hclist [data-hc-row="${CRON}"]')?.innerText.includes(${JSON.stringify(t.alarmSent)})`)
      && await s.sim("return window.__hcCalls.some((c) => c.type === 'alarmageddon/healthcheck_ping' && c.kind === 'alarm' && c.check_id === arg)", CRON), "");

    // ----- Protokoll: Kopf -----
    await s.tap(`#ag-hclist [data-hc-row="${CRON}"] [data-hc="log"]`);
    await s.waitFor("const d=r.getElementById('ag-hclog'); return d.open && !d.querySelector('.ag-sv[data-busy]')");
    const head = await s.ev(`const d=r.getElementById('ag-hclog'); const x=d.querySelector('.ag-dlg-x').getBoundingClientRect(); const bs=[...d.querySelectorAll('.ag-sv-head .ag-hl-acts .ag-iconbtn')];
      const box=(e) => { const b=e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), cy: Math.round(b.top + b.height / 2) }; };
      return { acts: bs.map((b) => b.dataset.sv), labels: bs.map((b) => b.getAttribute('aria-label')), boxes: bs.map(box), x: box(d.querySelector('.ag-dlg-x')), narrow: d.getRootNode().host.hasAttribute('narrow') }`);
    check(`${tag}: Kopf des Protokolls: Fehler, Alarm, OK, Stift (mit Alarm-Zusatz)`,
      JSON.stringify(head.acts) === JSON.stringify(["test-fail", "test-alarm", "test-ok", "edit"]) && JSON.stringify(head.labels) === JSON.stringify([t.testFail, t.testAlarm, t.testOk, t.edit]), JSON.stringify(head));
    // Gleich gross und auf einer Höhe: die Knöpfe untereinander immer; das X am Computer und auf dem iPad ebenso (auf dem Handy steht es in der Kopfzeile des Fensters)
    const same = head.boxes.every((b) => b.w === head.boxes[0].w && b.h === head.boxes[0].h && b.cy === head.boxes[0].cy);
    check(`${tag}: Knöpfe im Kopf gleich gross (44 px) und auf einer Höhe${mobile ? "" : ", das X ebenso"}`,
      same && head.boxes[0].w === 44 && (mobile || (head.x.w === 44 && head.x.h === 44 && Math.abs(head.x.cy - head.boxes[0].cy) <= 1)), JSON.stringify(head));
    const hdr = await s.ev(`const d=r.getElementById('ag-hclog'); const tone=(a) => { const x=getComputedStyle(d.querySelector('.ag-hl-acts [data-sv="' + a + '"]')).color; const v=x.match(/[\\d.]+/g).map(Number); return /^color\\(/.test(x) ? v.slice(0, 3).map((n) => n * 255) : v.slice(0, 3); };
      return { ok: tone('test-ok'), fail: tone('test-fail'), alarm: tone('test-alarm'), edit: tone('edit') }`);
    check(`${tag}: Kopf: Farben wie in der Liste (OK grün, Fehler und Alarm orange, Stift neutral)`,
      JSON.stringify(hdr.ok) === JSON.stringify(tones.ok.color.slice(0, 3)) && JSON.stringify(hdr.fail) === JSON.stringify(tones.fail.color.slice(0, 3)) && JSON.stringify(hdr.alarm) === JSON.stringify(tones.alarm.color.slice(0, 3)) && JSON.stringify(hdr.edit) === JSON.stringify(tones.edit.color.slice(0, 3)), JSON.stringify(hdr));
    // Alarm im Kopf: ein Aufruf, danach steht der Test im Protokoll
    await s.tap('#ag-hclog .ag-hl-acts [data-sv="test-alarm"]');
    check(`${tag}: "${t.testAlarm}" im Kopf: ein Aufruf mit kind "alarm", der Test steht danach im Protokoll`,
      await s.waitFor("const d=r.getElementById('ag-hclog'); return !d.querySelector('.ag-sv[data-busy]') && !d.querySelector('.ag-hl-acts [data-sv=\"test-alarm\"]:disabled')", 8000)
      && (await s.sim("return window.__hcCalls.filter((c) => c.type === 'alarmageddon/healthcheck_ping' && c.kind === 'alarm').length", null)) >= 2, "");
    // Ohne Alarm-Zusatz kein Alarm-Knopf im Kopf
    await s.tap("#ag-hclog [data-sv=\"menu\"]");
    await s.tap(`#ag-hclog [data-sv="pick"][data-id="${HC}"]`);
    await s.waitFor(`const d=r.getElementById('ag-hclog'); return d.open && !d.querySelector('.ag-sv[data-busy]') && d.querySelector('.ag-sv-head .ag-hl-pick b')?.textContent === 'Healthchecks Haus'`);
    check(`${tag}: ohne Alarm-Zusatz: nur Fehler, OK, Stift im Kopf`, JSON.stringify(await s.ev("return [...r.getElementById('ag-hclog').querySelectorAll('.ag-sv-head .ag-hl-acts .ag-iconbtn')].map((b) => b.dataset.sv)")) === JSON.stringify(["test-fail", "test-ok", "edit"]));
    check(`${tag}: keine Fehler der Seite`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
