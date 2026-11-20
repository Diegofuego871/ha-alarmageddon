// 1.5.0: Empfänger je Meldungsart (Dropdown, Standard vorgewählt, überschreibbar), auch je Modus; seit 1.69.0 im Fenster der Meldung. Je Sprache,
// Desktop und Handy.
import { check, done, launch, open } from "../lib.mjs";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const s = await open(browser, { mobile, lang, tab: "config" });
    await s.tap('[data-sub="notify"]');
    await s.waitFor("return !!r.querySelector('.ag-nt [data-nt=\"target-add\"]')");
    // Seit 1.62.0 stehen "Eingangsverzögerung" und die anderen Meldungen des Ablaufs im Reiter Aktionen: hier dient der Sensorausfall im
    // scharfen Zustand als Beispiel (er hat als einzige Art weiterhin eigene Werte je Modus)
    const kind = "sensor_offline";
    // Seit 1.69.0 (Variante C) stehen die Empfänger einer Meldung im Fenster #ag-ntkind (Stift auf der Karte); "Übernehmen" ändert den Entwurf
    const box = "#ag-ntkind";
    const card = `.ag-ntk[data-ntk="${kind}"]:not([data-mode])`;
    const openKind = async (mode = false) => {
      await s.tap(`.ag-ntk[data-ntk="${kind}"]${mode ? "[data-mode]" : ":not([data-mode])"} [data-nt="edit"]`);
      await s.waitFor("return r.getElementById('ag-ntkind').open");
    };
    const applyKind = async () => {
      await s.tap(`${box} [data-nt="kind-apply"]`);
      await s.waitFor("return !r.getElementById('ag-ntkind').open");
    };
    const draftTargets = () => s.ev(`return JSON.stringify(r.host.notify.draft.types.${kind}.targets || [])`);

    if (!(await s.ev(`return r.host.notify.draft.types.${kind}.enabled`))) await s.tap(`${card} [data-nt="enabled"]`);
    const all = await s.ev(`const out=[]; for (const c of r.querySelectorAll('.ag-ntk:not(.off)')) { c.querySelector('[data-nt="edit"]').click(); const d=r.getElementById('ag-ntkind');
      out.push(d.open && !!d.querySelector('select[data-nt="kt-add"][data-kind="' + c.dataset.ntk + '"]')); d.querySelector('[data-nt="kind-cancel"]').click(); } return out`);
    check(`${tag}: jede aktive Meldung hat im Fenster ein Dropdown für die Empfänger`, all.length > 3 && all.every(Boolean), JSON.stringify(all));
    await openKind();
    await s.waitFor(`return !!r.querySelector('${box} select[data-nt="kt-add"]')`);
    check(`${tag}: Standard ist vorgewählt: die Empfänger der Gruppe stehen als Pillen, Herkunft "Standard"`, await s.ev(`const b=r.querySelector('${box}'); const o=b.querySelector('.ag-ntk-recip .ag-origin'); return o && !o.classList.contains('own') && b.querySelectorAll('.ag-ntk-pills .ag-rpill').length === r.host.notify.draft.alarm_targets.length && o.textContent.length > 5`));
    check(`${tag}: nichts geändert (Standard schreibt keine eigene Liste)`, (await draftTargets()) === "[]");

    // Überschreiben: weiteren Empfänger wählen -> eigene Liste (Standard plus Auswahl)
    await (await s.el(`${box} select[data-nt="kt-add"]`)).selectOption("notify.mobile_app_tablet");
    check(`${tag}: eigene Liste beginnt mit dem Standard und dem gewählten Empfänger`, await s.waitFor(`const t=r.host.notify.draft; return t.types.${kind}.targets.includes('notify.mobile_app_tablet') && t.types.${kind}.targets.length === t.alarm_targets.length + 1`));
    check(`${tag}: Herkunft "Eigene Empfänger" mit Zurücksetzen, Änderung zählt`, await s.ev(`const b=r.querySelector('${box}'); return b.querySelector('.ag-origin.own [data-nt="kt-reset"]') !== null && !r.querySelector('.ag-foot [data-nt="save"]').disabled`));
    // Pille entfernen
    await s.tap(`${box} [data-nt="kt-del"][data-target="notify.mobile_app_tablet"]`);
    check(`${tag}: Pille entfernt`, await s.waitFor(`return !r.host.notify.draft.types.${kind}.targets.includes('notify.mobile_app_tablet')`));
    // Der letzte Empfänger lässt sich entfernen (1.26.0, wie oben bei den Empfängern von Alarmen): Warnung; beim Speichern geht die Meldung aus
    const last = await s.ev(`return r.host.notify.draft.types.${kind}.targets[0] || null`);
    if (last) {
      await s.ev(`const d=r.host.notify.draft; d.types.${kind}.targets=[d.types.${kind}.targets[0]]; r.host.notify.render(); return 1`);
      await s.tap(`${box} [data-nt="kt-del"]`);
      check(`${tag}: der letzte Empfänger lässt sich entfernen: keine Pille, Warnung`, await s.waitFor(`const b=r.querySelector('${box}'); return b.querySelectorAll('.ag-ntk-pills .ag-rpill').length === 0 && !!b.querySelector('.ag-warntext')`));
      check(`${tag}: ohne Empfänger ist es eine offene Änderung (Speichern möglich, kein Fehler unten)`, await s.ev("return !r.querySelector('.ag-foot [data-nt=save]').disabled && !r.querySelector('.ag-foot .ag-err') && r.host.notify.dirtyCount() >= 1"));
      await applyKind();
      check(`${tag}: die Karte warnt "kein Empfänger"`, await s.ev(`return !!r.querySelector('${card} .ag-wf-text small.ag-warntext')`));
      await s.tap('.ag-foot [data-nt="save"]');
      await s.waitFor("return r.querySelector('.ag-foot').innerText.match(/Gespeichert|Saved/) !== null");
      const off = await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/save_notify').at(-1)");
      check(`${tag}: beim Speichern ohne Empfänger geht die Meldung aus, die eigene Liste zurück auf den Standard`, off?.notify?.types?.[kind]?.enabled === false && (off.notify.types[kind].targets || []).length === 0, JSON.stringify(off?.notify?.types?.[kind]));
      await s.tap(`${card} [data-nt="enabled"]`);
      await openKind();
      await (await s.el(`${box} select[data-nt="kt-add"]`)).selectOption("notify.mobile_app_tablet");
      await s.waitFor(`return r.host.notify.draft.types.${kind}.targets.includes('notify.mobile_app_tablet')`);
      await s.ev(`const d=r.host.notify.draft; d.types.${kind}.targets=[d.types.${kind}.targets[0]]; r.host.notify.render(); return 1`);
      await s.tap(`${box} [data-nt="kt-del"]`);
      await (await s.el(`${box} select[data-nt="kt-add"]`)).selectOption("notify.mobile_app_partnerin");
      check(`${tag}: ein neuer Empfänger hebt die Sperre auf`, await s.waitFor(`const b=r.querySelector('${box}'); return b.querySelectorAll('.ag-ntk-pills .ag-rpill').length === 1 && !b.querySelector('.ag-warntext') && !r.querySelector('.ag-foot [data-nt="save"]').disabled`));
      await s.ev(`const d=r.host.notify.draft; d.types.${kind}.targets=[d.types.${kind}.targets[0]]; r.host.notify.render(); return 1`);
      await s.tap(`${box} [data-nt="kt-del"]`);
      await s.waitFor(`return !!r.querySelector('${box} .ag-warntext')`);
      await s.tap(`${box} [data-nt="kt-reset"]`);
      check(`${tag}: "Zurücksetzen" nimmt die Warnung weg und kehrt zum Standard zurück`, await s.waitFor(`const b=r.querySelector('${box}'); return !b.querySelector('.ag-warntext') && b.querySelectorAll('.ag-ntk-pills .ag-rpill').length > 0 && r.host.notify.draft.types.${kind}.targets.length === 0`));
      await s.ev(`const d=r.host.notify.draft; d.types.${kind}.targets=[d.types.${kind}.targets[0] || 'notify.mobile_app_diego']; r.host.notify.render(); return 1`);
      await s.tap(`${box} [data-nt="kt-del"]`);
      await s.waitFor(`return !!r.querySelector('${box} .ag-warntext')`);
      await applyKind();
      await s.tap('.ag-foot [data-nt="cancel"]');
      check(`${tag}: Abbrechen verwirft auch die leere Auswahl`, await s.waitFor(`return r.host.notify._empty().size === 0 && !r.querySelector('${card} .ag-warntext') && r.querySelector('.ag-foot [data-nt=save]').disabled`));
      await s.tap(`${card} [data-nt="enabled"]`);
      await openKind();
      await (await s.el(`${box} select[data-nt="kt-add"]`)).selectOption("notify.mobile_app_tablet");
      await s.waitFor(`return r.host.notify.draft.types.${kind}.targets.includes('notify.mobile_app_tablet')`);
    }
    // Zurück zum Standard
    await s.tap(`${box} [data-nt="kt-reset"]`);
    check(`${tag}: zurück zum Standard (leere Liste)`, await s.waitFor(`return r.host.notify.draft.types.${kind}.targets.length === 0`));

    // Gespeichert
    await (await s.el(`${box} select[data-nt="kt-add"]`)).selectOption("notify.mobile_app_partnerin");
    await s.waitFor(`return r.host.notify.draft.types.${kind}.targets.includes('notify.mobile_app_partnerin')`);
    await applyKind();
    await s.tap('.ag-foot [data-nt="save"]');
    check(`${tag}: gespeichert und gesendet`, await s.waitFor("return r.querySelector('.ag-foot').innerText.match(/Gespeichert|Saved/) !== null"));
    const sent = await s.sim("return window.__calls.filter((c) => c.type === 'alarmageddon/save_notify').at(-1)");
    check(`${tag}: types.${kind}.targets gesendet`, sent?.notify?.types?.[kind]?.targets?.includes("notify.mobile_app_partnerin"), JSON.stringify(sent?.notify?.types?.[kind]));

    // Je Modus: eigener Wert nur für diesen Modus
    await s.tap('[data-nt="permode"]');
    await s.waitFor(`return !!r.querySelector('.ag-ntk[data-ntk="${kind}"][data-mode]')`);
    await openKind(true);
    await (await s.el(`${box} select[data-nt="kt-add"]`)).selectOption("notify.mobile_app_tablet");
    check(`${tag}: im Reiter eines Modus: eigener Wert nur für diesen Modus`, await s.waitFor(`const d=r.host.notify.draft; const m=Object.keys(d.modes); return m.length === 1 && d.modes[m[0]].${kind}.targets.includes('notify.mobile_app_tablet') && !(d.types.${kind}.targets || []).includes('notify.mobile_app_tablet')`));
    await s.tap(`${box} [data-nt="kt-reset"]`);
    check(`${tag}: Zurücksetzen entfernt den Wert des Modus`, await s.waitFor("return Object.keys(r.host.notify.draft.modes).length === 0"));
    await s.ctx.close();
  }
}
await browser.close();
done();
