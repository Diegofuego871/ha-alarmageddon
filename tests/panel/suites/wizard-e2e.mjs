// 1.69.0: Einrichtungsassistent (Wunsch und Entscheide des Nutzers 2026-11-19, 20:43 und 21:05). Je Sprache, Desktop und Handy, echte
// Klicks/Taps: erscheint nur bei fälligen Anlagen (neue Anlage, "später" ab dem Tag danach, genau beim Schritt), nie bei bestehenden; "Später"
// fragt "Morgen wieder anzeigen" / "Nicht mehr anzeigen"; jeder Schritt speichert mit "Weiter" über die Reiter; Zuordnung, Alarmaktionen und
// Überwachung sind die eingebetteten Ansichten; Überwachung nur mit passenden Sensoren; Kapitel unter Konfiguration › Anlage vor "Anlage löschen".
import { check, done, launch, open } from "../lib.mjs";

const T = {
  de: { welcome: "Willkommen bei Alarmageddon", welcomeShort: "Willkommen", title: "Einrichtungsassistent", start: "Los geht's", next: "Weiter", finish: "Fertig", skipCode: "Ohne Code weiter",
    askTitle: "Assistent später fortsetzen?", later: "Später", stepOf: (n, total) => `Schritt ${n} von ${total}`, chapter: "Einrichtungsassistent", del: "Anlage löschen",
    stDone: "Abgeschlossen", stLater: "Verschoben bis", stHidden: "Ausgeblendet, bei Schritt 3", run: "Assistent starten", resume: "Bei Schritt 3 fortsetzen", restart: "Von vorn",
    dirty: "Ungespeicherte Änderungen", chosen: (n, total) => `${n} von ${total} gewählt`, codeSome: "Codes dieser Anlage: Diego", codeAnna: "Codes dieser Anlage: Anna",
    siren: "Sirene 3 Minuten", sound: "Alarmton", sumZones: "3 Sensoren · Eingang: Haustür · Verlassen: 60 s · Deaktivieren: 45 s", sumNotify: "an diego · 6 von 7 Meldungen an",
    sumActions: "nur die Alarmmeldung", found: "Gefunden: 3 Sensoren", entry: "Eingangsverzögerung", modes: ["Anwesend", "Abwesend", "Nacht"] },
  en: { welcome: "Welcome to Alarmageddon", welcomeShort: "Welcome", title: "Setup assistant", start: "Let's go", next: "Next", finish: "Finish", skipCode: "Continue without code",
    askTitle: "Continue the assistant later?", later: "Later", stepOf: (n, total) => `Step ${n} of ${total}`, chapter: "Setup assistant", del: "Delete alarm system",
    stDone: "Completed", stLater: "Postponed until", stHidden: "Hidden, at step 3", run: "Start assistant", resume: "Continue at step 3", restart: "Start over",
    dirty: "Unsaved changes", chosen: (n, total) => `${n} of ${total} chosen`, codeSome: "Codes of this alarm system: Diego", codeAnna: "Codes of this alarm system: Anna",
    siren: "Siren 3 minutes", sound: "Alarm sound", sumZones: "3 sensors · entry: Haustür · leave: 60 s · disarm: 45 s", sumNotify: "to diego · 6 of 7 notifications on",
    sumActions: "only the alarm notification", found: "Found: 3 sensors", entry: "Entry delay", modes: ["Home", "Away", "Night"] },
};
const DOOR = "binary_sensor.haustuer";
const MOTION = "binary_sensor.bewegung_flur";
const SMOKE = "binary_sensor.rauchmelder_flur";

const browser = await launch();
for (const lang of ["de", "en"]) {
  for (const mobile of [false, true]) {
    const tag = `${lang}/${mobile ? "Handy" : "Desktop"}`;
    const t = T[lang];
    const J = JSON.stringify;
    const helpers = (s) => ({
      step: () => s.ev("return r.querySelector('.ag-wz')?.dataset.step || ''"),
      waitStep: (st, timeout = 12000) => s.waitFor(`return r.querySelector('.ag-wz')?.dataset.step === ${J(st)} && !r.querySelector('.ag-wz-next[disabled]')`, timeout),
      calls: () => s.sim("return JSON.parse(JSON.stringify(window.__wzCalls))"),
      sys: (id) => s.sim(`return JSON.parse(JSON.stringify(window.__systems.find((x) => x.entry_id === ${J(id)}) || null))`),
    });

    // ----- Bestehende Anlage: nie von selbst -----
    let s = await open(browser, { mobile, lang });
    await s.page.waitForTimeout(900);
    check(`${tag}: bestehende Anlage (eingerichtet): der Assistent öffnet sich nicht von selbst`, await s.ev("return !r.querySelector('.ag-wz') && !!r.querySelector('[data-seg=\"tabs\"]')"));
    check(`${tag}: und schreibt nichts an den Server`, (await helpers(s).calls()).length === 0);
    await s.ctx.close();

    // ----- Fällig: Willkommen, "Später" -----
    s = await open(browser, { mobile, lang, query: "&wizard=open" });
    let H = helpers(s);
    check(`${tag}: fällig: öffnet sich von selbst beim Willkommen, statt Kopf und Reitern des Panels`, await s.waitFor(`const w=r.querySelector('.ag-wz'); return w?.dataset.step === 'welcome' && !r.querySelector('[data-seg="tabs"]')
      && r.querySelector('.ag-wz-head h2').textContent === ${J(mobile ? t.welcomeShort : t.welcome)} && r.querySelector('.ag-wz-lead').textContent.includes('"Haus"')`));
    check(`${tag}: Willkommen: kein "Zurück", Knopf "${t.start}", Kacheln der sieben Schritte, Hinweis zu den Grenzen`, await s.waitFor(`return !r.querySelector('[data-wz="back"]') && r.querySelector('[data-wz="next"]').innerText.trim() === ${J(t.start)}
      && r.querySelectorAll('.ag-wz-grid .ag-wz-tile').length === 7 && !!r.querySelector('.ag-wz-info')`));
    if (mobile) {
      check(`${tag}: Handy: keine Schrittliste, oben "${t.title}" und "Später"`, await s.ev(`return !r.querySelector('.ag-wz-side') && r.querySelector('.ag-wz-kicker').textContent === ${J(t.title)} && r.querySelector('[data-wz="later"]').innerText.trim() === ${J(t.later)}`));
      check(`${tag}: Handy: Fusszeile am unteren Rand, Knöpfe gross genug`, await s.ev("const f=r.querySelector('.ag-wz-foot').getBoundingClientRect(); const b=r.querySelector('[data-wz=\"next\"]').getBoundingClientRect(); return Math.abs(f.bottom - innerHeight) <= 1 && b.height >= 40 && b.right <= innerWidth"));
    } else {
      check(`${tag}: Desktop: Schrittliste links mit allen Schritten (Überwachung: es gibt Messwerte), nur der aktuelle wählbar`, await s.waitFor(`const li=[...r.querySelectorAll('.ag-wz-steps li')]; return li.length === 9 && li[0].classList.contains('cur')
        && li.slice(1).every((x) => x.querySelector('button').disabled) && li.some((x) => x.querySelector('[data-step="monitor"]'))`));
    }
    check(`${tag}: Kachel "Überwachung" nicht abgeblendet (passende Sensoren vorhanden)`, await s.waitFor("return [...r.querySelectorAll('.ag-wz-tile')].filter((x) => x.classList.contains('dim')).length === 0"));
    check(`${tag}: von selbst geöffnet: kein Aufruf an den Server`, (await H.calls()).length === 0);

    await s.tap('[data-wz="later"]');
    check(`${tag}: "Später" fragt: "Morgen wieder anzeigen", "Nicht mehr anzeigen", "Weiter einrichten"`, await s.waitFor(`const d=r.getElementById('ag-wzask'); return d.open && d.innerText.includes(${J(t.askTitle)})
      && !!d.querySelector('[data-wz="ask-later"]') && !!d.querySelector('[data-wz="ask-hide"]') && !!d.querySelector('[data-wz="ask-close"]')`));
    if (mobile) check(`${tag}: Handy: das Fenster liegt ganz im Bild`, await s.ev("const d=r.getElementById('ag-wzask').getBoundingClientRect(); return d.left >= 0 && d.right <= innerWidth + 1 && d.bottom <= innerHeight + 1"));
    await s.tap('#ag-wzask [data-wz="ask-close"]');
    check(`${tag}: "Weiter einrichten" schliesst nur das Fenster`, await s.waitFor("return !r.getElementById('ag-wzask').open && r.querySelector('.ag-wz')?.dataset.step === 'welcome'"));
    await s.page.keyboard.press("Escape");
    check(`${tag}: Escape fragt ebenso`, await s.waitFor("return r.getElementById('ag-wzask').open"));
    await s.tap('#ag-wzask [data-wz="ask-later"]');
    check(`${tag}: "Morgen wieder anzeigen": Server merkt "später", der Assistent schliesst, das Panel ist wieder da`, await s.waitFor("return !r.querySelector('.ag-wz') && !!r.querySelector('[data-seg=\"tabs\"]') && !r.getElementById('ag-wzask').open")
      && J((await H.calls()).map((c) => c.action)) === J(["later"]));
    const haus = await H.sys("e_haus");
    const today = await s.sim("const d=new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)");
    check(`${tag}: … bis morgen, beim selben Schritt`, haus.wizard.state === "later" && haus.wizard.until > today && haus.wizard.step === "welcome", J(haus.wizard));
    check(`${tag}: keine Fehler im Browser (Später)`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    s = await open(browser, { mobile, lang, query: "&wizard=open" });
    H = helpers(s);
    await H.waitStep("welcome");
    await s.tap('[data-wz="later"]');
    await s.waitFor("return r.getElementById('ag-wzask').open");
    await s.tap('#ag-wzask [data-wz="ask-hide"]');
    check(`${tag}: "Nicht mehr anzeigen": Server merkt "ausgeblendet", der Assistent schliesst`, await s.waitFor("return !r.querySelector('.ag-wz')") && J((await H.calls()).map((c) => c.action)) === J(["hide"])
      && (await H.sys("e_haus")).wizard.state === "hidden");
    await s.ctx.close();

    // ----- Am nächsten Tag: genau beim Schritt -----
    s = await open(browser, { mobile, lang, query: "&wizard=later&wzuntil=2999-01-01&wzstep=notify" });
    await s.page.waitForTimeout(900);
    check(`${tag}: "später" vor dem Tag: kein Assistent`, await s.ev("return !r.querySelector('.ag-wz')"));
    await s.ctx.close();
    s = await open(browser, { mobile, lang, query: "&wizard=later&wzuntil=2000-01-01&wzstep=notify" });
    H = helpers(s);
    check(`${tag}: "später" ab dem Tag: der Assistent öffnet beim Schritt "Meldungen", ${t.stepOf(5, 7)}`, await H.waitStep("notify")
      && (await s.waitFor(`return r.querySelector('.ag-wz-kicker').textContent.startsWith(${J(t.stepOf(5, 7))})`)));
    if (mobile) {
      check(`${tag}: Handy: Fortschritt mit 7 Strichen, 4 fertig, 1 aktuell`, await s.ev("const p=[...r.querySelectorAll('.ag-wz-prog span')]; return p.length === 7 && p.filter((x) => x.classList.contains('done')).length === 4 && p[4].classList.contains('cur')"));
    } else {
      check(`${tag}: Desktop: Schritte davor erledigt und wählbar, danach gesperrt`, await s.ev("const li=[...r.querySelectorAll('.ag-wz-steps li')]; const i=li.findIndex((x) => x.classList.contains('cur')); return i === 5 && li.slice(0, 5).every((x) => x.classList.contains('done') && !x.querySelector('button').disabled) && li.slice(6).every((x) => x.querySelector('button').disabled)"));
    }
    check(`${tag}: Meldungen der Anlage vorgewählt: Empfänger der Alarme (diego), zwei Gruppen`, await s.waitFor("const g=r.querySelectorAll('.ag-recip'); return g.length === 2 && g[0].dataset.group === 'alarm_targets' && g[0].querySelector('.ag-rpill')?.innerText.includes('diego') && g[1].dataset.group === 'maintenance_targets'"));
    await s.ctx.close();

    // ----- Erneut starten: was eingerichtet ist, ist vorgewählt -----
    s = await open(browser, { mobile, lang, query: "&wizard=open&wzstep=modes" });
    H = helpers(s);
    await H.waitStep("modes");
    check(`${tag}: Modi: alle drei der Anlage an, "Rauch, Wasser und Gas" an`, await s.ev("return [...r.querySelectorAll('[data-wz=\"mode\"]')].every((b) => b.classList.contains('on')) && r.querySelector('[data-wz=\"always\"]').classList.contains('on')"));
    await s.tap('[data-wz="back"]');
    check(`${tag}: "Zurück" führt zum Willkommen, der Server merkt den Schritt`, await H.waitStep("welcome") && (await H.calls()).at(-1)?.step === "welcome");
    await s.tap('[data-wz="next"]');
    await H.waitStep("modes");
    await s.tap('[data-wz="next"]');
    check(`${tag}: Sensoren: alle 11 Ja/Nein-Sensoren der Anlage gewählt`, await H.waitStep("sensors") && (await s.waitFor(`return r.querySelector('.ag-wz-count')?.textContent === ${J(t.chosen(11, 11))}`)));
    await s.ctx.close();
    s = await open(browser, { mobile, lang, query: "&wizard=open&wzstep=code" });
    H = helpers(s);
    await H.waitStep("code");
    check(`${tag}: Code: die Codes der Anlage (Anna), Knopf "${t.next}"`, await s.ev(`return r.querySelector('.ag-wz-slot').innerText.includes(${J(t.codeAnna)}) && r.querySelector('[data-wz="next"]').innerText.trim() === ${J(t.next)}`));
    check(`${tag}: nie ein Code in der Seite`, await s.sim("return !document.getElementById('panel-frame').contentDocument.querySelector('alarmageddon-panel').shadowRoot.innerHTML.includes('2468')"));
    await s.ctx.close();

    // ----- Ohne passende Sensoren: keine Überwachung -----
    s = await open(browser, { mobile, lang, query: "&wizard=open&nomeasures=1" });
    H = helpers(s);
    await H.waitStep("welcome");
    await s.page.waitForTimeout(600);
    check(`${tag}: ohne Messwerte: Kachel "Überwachung" abgeblendet`, await s.ev("return [...r.querySelectorAll('.ag-wz-tile')].filter((x) => x.classList.contains('dim')).length === 1"));
    if (!mobile) check(`${tag}: ohne Messwerte: 8 Schritte, keine Überwachung`, await s.ev("return r.querySelectorAll('.ag-wz-steps li').length === 8 && !r.querySelector('.ag-wz-steps [data-step=\"monitor\"]')"));
    await s.tap('[data-wz="next"]');
    check(`${tag}: ohne Messwerte: ${t.stepOf(1, 6)}`, await H.waitStep("modes") && (await s.ev(`return r.querySelector('.ag-wz-kicker').textContent.startsWith(${J(t.stepOf(1, 6))})`)));
    // "Immer aktiv" aus: ein Rauchmelder kommt dann in jeden Modus (sonst löste er nie aus)
    await s.tap('[data-wz="always"]');
    await s.waitFor("return !r.querySelector('[data-wz=\"always\"]').classList.contains('on')");
    await s.tap('[data-wz="next"]');
    check(`${tag}: "Immer aktiv" aus gespeichert`, await H.waitStep("sensors") && (await H.sys("e_haus")).always_enabled === false);
    await s.waitFor(`return !!r.querySelector('[data-wz="pick"][data-ent="${SMOKE}"]')`);
    await s.tap(`[data-wz="pick"][data-ent="${SMOKE}"]`);
    await s.waitFor(`return r.querySelector('[data-wz="pick"][data-ent="${SMOKE}"]').getAttribute('aria-checked') === 'false'`);
    await s.tap(`[data-wz="pick"][data-ent="${SMOKE}"]`);
    check(`${tag}: ohne "Immer aktiv": Rauchmelder neu gewählt kommt in jeden Modus`, await s.waitFor(`const z=r.host.sensors.draft.zones; return r.querySelector('[data-wz="pick"][data-ent="${SMOKE}"]').getAttribute('aria-checked') === 'true'
      && ['home', 'away', 'night'].every((m) => z[m].has(${J(SMOKE)}))`));
    await s.ctx.close();

    // ----- Neue Anlage: von Anfang bis Ende -----
    s = await open(browser, { mobile, lang });
    H = helpers(s);
    await s.tap('.ag-headsys [data-act="add"]');
    await (await s.el("#ag-add-input")).fill("Ferienhaus");
    await s.waitFor("return !r.getElementById('ag-add').querySelector('button[type=submit]').disabled");
    await s.tap('#ag-add button[type="submit"]');
    check(`${tag}: neue Anlage: der Assistent öffnet sich gleich danach, für "Ferienhaus"`, await H.waitStep("welcome") && (await s.ev("return r.querySelector('.ag-wz-lead').textContent.includes('\"Ferienhaus\"')")));
    await s.tap('[data-wz="next"]');
    check(`${tag}: Modi: Anwesend und Abwesend an, Nacht aus (Standard der neuen Anlage); der Server merkt den Schritt`, await H.waitStep("modes")
      && (await s.waitFor("const b=[...r.querySelectorAll('[data-wz=\"mode\"]')]; return b.length === 3 && b[0].classList.contains('on') && b[1].classList.contains('on') && !b[2].classList.contains('on')"))
      && (await H.calls()).at(-1)?.action === "step" && (await H.calls()).at(-1)?.step === "modes");
    if (mobile) check(`${tag}: Handy: "${t.stepOf(1, 7)} · …" und Fortschritt`, await s.ev(`return r.querySelector('.ag-wz-kicker').textContent.startsWith(${J(t.stepOf(1, 7))} + ' · ') && r.querySelectorAll('.ag-wz-prog span').length === 7`));
    await s.tap('[data-wz="mode"][data-mode="night"]');
    check(`${tag}: Schalter "Nacht" geht an (Entwurf)`, await s.waitFor("return r.querySelector('[data-wz=\"mode\"][data-mode=\"night\"]').classList.contains('on')"));
    await s.tap('[data-wz="next"]');
    check(`${tag}: "Weiter" speichert die Modi (Nacht an)`, await H.waitStep("sensors") && J((await H.sys("e_ferienhaus")).modes) === J(["home", "away", "night"]), J((await H.sys("e_ferienhaus")).modes));

    // Sensoren
    check(`${tag}: Sensoren: alle 11 Ja/Nein-Sensoren des Hauses, keiner gewählt`, await s.waitFor(`return r.querySelectorAll('.ag-wz-list [data-wz="pick"]').length === 11 && r.querySelector('.ag-wz-count').textContent === ${J(t.chosen(0, 11))}`));
    const rows = () => s.ev("return [...r.querySelectorAll('.ag-wz-list [data-wz=\"pick\"]')].map((b) => b.dataset.ent)");
    for (const [f, n] of [["openings", 6], ["motion", 3], ["safety", 2]]) {
      await s.tap(`[data-wz="filter"][data-f="${f}"]`);
      check(`${tag}: Filter "${f}": ${n} Sensoren`, await s.waitFor(`return r.querySelectorAll('.ag-wz-list [data-wz="pick"]').length === ${n} && r.querySelector('[data-wz="filter"][data-f="${f}"]').classList.contains('on')`), J(await rows()));
    }
    await s.tap('[data-wz="filter"][data-f="all"]');
    const search = await s.el('[data-wz="q"]');
    await search.fill("flur");
    check(`${tag}: Suche "flur": drei Sensoren, das Feld behält den Fokus`, await s.waitFor(`return r.querySelectorAll('.ag-wz-list [data-wz="pick"]').length === 3 && r.activeElement === r.querySelector('[data-wz="q"]')`), J(await rows()));
    for (const id of [DOOR, MOTION, SMOKE]) await s.tap(`[data-wz="pick"][data-ent="${id}"]`);
    check(`${tag}: drei gewählt (Kästchen, Zähler)`, await s.waitFor(`return [...r.querySelectorAll('.ag-wz-list [data-wz="pick"]')].every((b) => b.getAttribute('aria-checked') === 'true') && r.querySelector('.ag-wz-count').textContent === ${J(t.chosen(3, 11))}`));
    await (await s.el('[data-wz="q"]')).fill(""); // nach dem Wählen neu gezeichnet: das Feld neu holen
    await s.waitFor("return r.querySelectorAll('.ag-wz-list [data-wz=\"pick\"]').length === 11");
    await s.tap('[data-wz="next"]');
    let sys = (await H.waitStep("zones")) && (await H.sys("e_ferienhaus"));
    check(`${tag}: gespeichert: die drei Sensoren, Vorschlag nach Art (Tür in jedem Modus, Bewegung bei Abwesend, Rauch in keiner Zone)`, !!sys && J([...sys.sensors].sort()) === J([MOTION, DOOR, SMOKE].sort())
      && J(sys.zones.home) === J([DOOR]) && J([...sys.zones.away].sort()) === J([MOTION, DOOR].sort()) && J(sys.zones.night) === J([DOOR]), J(sys && { sensors: sys.sensors, zones: sys.zones }));

    // Zuordnung und Eingang: die echte Tabelle, ohne Suche, Filter und Knöpfe je Zeile; darunter die Zeiten
    check(`${tag}: Zuordnung: die Tabelle der Sensoren mit den drei Sensoren, ohne Werkzeugleiste und Knöpfe je Zeile`, await s.waitFor(`const slot=r.querySelector('.ag-wz-slot'); const t=slot.querySelector('table.ag-table');
      const hidden=(sel) => [...slot.querySelectorAll(sel)].every((x) => !x.offsetParent); return !!t && t.querySelectorAll('tr[data-row]').length === 3 && hidden('.ag-acts') && hidden('.ag-tools, .ag-cfg, .ag-foot')`));
    check(`${tag}: Kästchen nach dem Vorschlag gesetzt`, await s.ev(`const on=(id, m) => r.querySelector('.ag-wz-slot [data-box][data-ent="' + id + '"][data-mode="' + m + '"]')?.getAttribute('aria-checked') === 'true';
      return on(${J(DOOR)}, 'home') && on(${J(DOOR)}, 'night') && on(${J(MOTION)}, 'away') && !on(${J(MOTION)}, 'home') && !on(${J(SMOKE)}, 'away')`));
    const entrySel = mobile ? `.ag-wz-post [data-wz="entry-sensor"][data-ent="${DOOR}"]` : `.ag-wz-slot [data-sen="entry"][data-ent="${DOOR}"]`;
    if (mobile) {
      check(`${tag}: Handy: Kapitel "${t.entry}" unter der Tabelle, Schalter links, Rauch nicht wählbar`, await s.waitFor(`const p=r.querySelector('.ag-wz-post'); const rows=[...p.querySelectorAll('.ag-wz-entry')];
        return p.innerText.includes(${J(t.entry)}) && rows.length === 2 && !p.querySelector('[data-ent="${SMOKE}"]') && rows.every((x) => x.querySelector('.ag-toggle').getBoundingClientRect().left < x.querySelector('.ag-settx').getBoundingClientRect().left)`));
      // Eine Zeile antippen öffnet im Assistenten kein Blatt
      await s.tap(`.ag-wz-slot tr[data-row="${DOOR}"] .ag-nm`);
      await s.page.waitForTimeout(300);
      check(`${tag}: Handy: Zeile antippen öffnet im Assistenten kein Blatt`, await s.ev("return !r.querySelector('.ag-sheet.open, dialog[open]')"));
    }
    await s.tap(entrySel);
    check(`${tag}: Haustür als Eingang gewählt`, await s.waitFor(`return r.querySelector(${J(entrySel)})?.classList.contains('on')`));
    check(`${tag}: Zeiten: Verlassen 60 s (Abwesend), Deaktivieren 30 s`, await s.ev("return r.querySelector('[data-wz=\"exit\"]').value === '60' && r.querySelector('[data-wz=\"entry\"]').value === '30'"));
    if (mobile) {
      // Bewegung aus "Abwesend" nehmen: der Eingangsschalter der Bewegung wird gesperrt (folgt der Tabelle)
      await s.tap(`.ag-wz-slot [data-box][data-ent="${MOTION}"][data-mode="away"]`);
      check(`${tag}: Handy: Sensor in keiner Zone: sein Eingangsschalter folgt der Tabelle und ist gesperrt`, await s.waitFor(`return r.querySelector('.ag-wz-post [data-wz="entry-sensor"][data-ent="${MOTION}"]')?.disabled === true`));
      await s.tap(`.ag-wz-slot [data-box][data-ent="${MOTION}"][data-mode="away"]`);
      await s.waitFor(`return r.querySelector('.ag-wz-post [data-wz="entry-sensor"][data-ent="${MOTION}"]')?.disabled === false`);
    }
    // Ins Feld tippen: es behält den Fokus (kein Neuzeichnen beim Klick)
    await s.tap('input[data-wz="entry"]');
    await s.page.waitForTimeout(200);
    check(`${tag}: Feld "Zeit zum Deaktivieren" behält beim Antippen den Fokus`, await s.ev("return r.activeElement === r.querySelector('input[data-wz=\"entry\"]')"));
    await (await s.el('input[data-wz="entry"]')).fill("45");
    await s.tap('[data-wz="next"]');
    sys = (await H.waitStep("code")) && (await H.sys("e_ferienhaus"));
    check(`${tag}: gespeichert: Eingang Haustür, Deaktivieren 45 s in allen Modi, Verlassen 60 s`, !!sys && J(sys.entry_sensors) === J([DOOR]) && ["home", "away", "night"].every((m) => sys.mode_settings[m]?.entry_delay === 45) && sys.mode_settings.away.exit_delay === 60,
      J(sys && { entry: sys.entry_sensors, ms: sys.mode_settings }));
    check(`${tag}: Zuordnung: Bewegung bleibt bei Abwesend`, !!sys && sys.zones.away.includes(MOTION));

    // Code (freiwillig)
    check(`${tag}: Code: noch keiner, Knopf "${t.skipCode}"`, await s.waitFor(`return r.querySelector('[data-wz="next"]').innerText.trim() === ${J(t.skipCode)} && !!r.querySelector('[data-wz="code-add"]')`));
    await s.tap('[data-wz="code-add"]');
    check(`${tag}: "Code hinzufügen" öffnet das Fenster der Codes, mit dem eigenen Benutzer und Namen vorbelegt`, await s.waitFor("const d=r.getElementById('ag-codes'); return d.open && d.querySelector('[data-key=\"name\"]').value === 'Diego' && d.querySelector('select[data-key=\"user_id\"]').value === 'u_diego'"));
    await (await s.el("#ag-cf-code")).fill("4826");
    await (await s.el("#ag-cf-code2")).fill("4826");
    await s.tap('#ag-codes [data-sys="code-save"]');
    check(`${tag}: Code gespeichert: Fenster zu, der Schritt nennt ihn, Knopf "${t.next}"`, await s.waitFor(`return !r.getElementById('ag-codes').open && r.querySelector('.ag-wz')?.dataset.step === 'code' && r.querySelector('.ag-wz-slot').innerText.includes(${J(t.codeSome)})
      && r.querySelector('[data-wz="next"]').innerText.trim() === ${J(t.next)}`, 8000) && (await H.sys("e_ferienhaus")).codes.length === 1);
    check(`${tag}: der Code steht nirgends in der Seite`, await s.sim("return !document.getElementById('panel-frame').contentDocument.querySelector('alarmageddon-panel').shadowRoot.innerHTML.includes('4826')"));
    await s.tap('[data-wz="next"]');

    // Meldungen: zwei Empfängergruppen, Schalter je Meldung
    check(`${tag}: Meldungen: Empfänger der Alarme und der Wartung, Alarmmeldung immer an, sechs Schalter (mit HealthCheck)`, await H.waitStep("notify") && (await s.waitFor(`const g=r.querySelectorAll('.ag-recip'); return g.length === 2 && !!g[1].querySelector('.ag-warntext')
      && !!r.querySelector('.ag-wz-lock') && r.querySelectorAll('[data-wz="kind"]').length === 6`)));
    await (await s.el('.ag-recip[data-group="maintenance_targets"] select')).selectOption("notify.mobile_app_partnerin");
    check(`${tag}: Empfänger der Wartung hinzugefügt (Kapsel), Warnung weg`, await s.waitFor("const g=r.querySelector('.ag-recip[data-group=\"maintenance_targets\"]'); return g.querySelector('.ag-rpill')?.innerText.includes('partnerin') && !g.querySelector('.ag-warntext')"));
    await s.tap('[data-wz="kind"][data-kind="battery_low"]');
    check(`${tag}: "Batterie schwach" aus`, await s.waitFor("return !r.querySelector('[data-wz=\"kind\"][data-kind=\"battery_low\"]').classList.contains('on')"));
    check(`${tag}: Schalter links, Text rechts`, await s.ev("return [...r.querySelectorAll('[data-wz=\"kind\"]')].every((b) => b.getBoundingClientRect().right <= b.closest('.ag-mt-head').querySelector('.ag-settx').getBoundingClientRect().left)"));
    await s.tap('[data-wz="next"]');
    const nt = (await H.waitStep("actions")) && (await s.sim("return JSON.parse(JSON.stringify(window.__notify))"));
    check(`${tag}: gespeichert: Wartung an partnerin, "Batterie schwach" aus, Alarme weiter an diego`, !!nt && nt.maintenance_targets.includes("notify.mobile_app_partnerin") && nt.types.battery_low.enabled === false && J(nt.alarm_targets) === J(["notify.mobile_app_diego"]), J(nt && { m: nt.maintenance_targets, b: nt.types.battery_low }));

    // Alarmaktionen: der echte Editor, Schnellwahl ohne Licht
    check(`${tag}: Alarmaktionen: der Editor der Aktionen ist eingebettet (Ablauf des Alarms, nicht Überwachung), Schnellwahl Sirene und Alarmton`, await s.waitFor(`const slot=r.querySelector('.ag-wz-slot'); const q=[...slot.querySelectorAll('[data-wz="quick"]')].map((b) => b.innerText.trim());
      return !!slot.querySelector('.ag-wf-head') && JSON.stringify(q) === ${J(J([t.siren, t.sound]))} && ['home', 'away', 'night'].includes(r.host.actions.trigger)`));
    check(`${tag}: kein Reiter "Überwachung" in diesem Schritt`, await s.ev("const b=r.querySelector('.ag-wz-slot [data-trigger=\"monitor\"]'); return !b || !b.offsetParent"));
    await s.tap('[data-wz="quick"][data-q="siren"]');
    check(`${tag}: "${t.siren}" öffnet den Editor des Schritts: Gerät der Art Sirene, nach 3 Minuten zurück`, await s.waitFor("const f=r.host.actions.edit?.form; return r.getElementById('ag-step').open && f?.kind === 'device' && f.domain === 'siren' && f.undoOn === true && f.undoSeconds === 180"));
    await s.tap('#ag-step [data-wf="close"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    await s.tap('[data-wz="quick"][data-q="sound"]');
    check(`${tag}: "${t.sound}" öffnet den Editor: Ton, 3 Minuten`, await s.waitFor("const f=r.host.actions.edit?.form; return r.getElementById('ag-step').open && f?.kind === 'sound' && f.playSeconds === 180"));
    await s.tap('#ag-step [data-wf="close"]');
    await s.waitFor("return !r.getElementById('ag-step').open");
    await s.tap('[data-wz="next"]');

    // Überwachung: Schalter und Sensoren gelten sofort
    check(`${tag}: Überwachung: ${t.found}, aus, noch keine Sensoren`, await H.waitStep("monitor") && (await s.waitFor(`return r.querySelector('.ag-wz-pre').innerText.includes(${J(t.found)}) && !r.querySelector('[data-wz="mon-use"]').classList.contains('on') && !r.querySelector('[data-wz="mon-sensor"]')`)));
    await s.tap('[data-wz="mon-use"]');
    const wzState = () => s.ev("const w=r.host.wizard; return JSON.stringify({ step: w.step, busy: w.busy, error: w.error, wait: r.host._wait, dirty: [r.host.sensors, r.host.systemUi, r.host.actions, r.host.notify].map((u) => u.dirtyCount()) })");
    check(`${tag}: einschalten gilt sofort, danach die drei Messwerte zur Wahl und die Regeln darunter`, await s.waitFor("return r.querySelector('[data-wz=\"mon-use\"]').classList.contains('on') && !r.querySelector('[data-wz=\"mon-use\"]').disabled && r.querySelectorAll('[data-wz=\"mon-sensor\"]:not([disabled])').length === 3 && !!r.querySelector('.ag-wz-slot .ag-wf-head')", 15000)
      && (await H.sys("e_ferienhaus")).monitor_enabled === true, await wzState());
    await s.tap('[data-wz="mon-sensor"][data-ent="sensor.kuehlschrank_temperatur"]');
    check(`${tag}: Sensor der Überwachung gewählt, sofort gespeichert`, await s.waitFor("const b=r.querySelector('[data-wz=\"mon-sensor\"][data-ent=\"sensor.kuehlschrank_temperatur\"]'); return b?.classList.contains('on') && !b.disabled && !r.querySelector('[data-wz=\"next\"]').disabled", 15000)
      && J((await H.sys("e_ferienhaus")).monitor_sensors) === J(["sensor.kuehlschrank_temperatur"]), await wzState());
    await s.tap('[data-wz="next"]');

    // Fertig
    check(`${tag}: Fertig: Zusammenfassung mit sechs Zeilen und "Ändern"`, await H.waitStep("done") && (await s.waitFor("return r.querySelectorAll('.ag-wz-sum .ag-setrow').length === 6 && r.querySelectorAll('.ag-wz-sum [data-wz=\"goto\"]').length === 6")));
    const sum = await s.ev("return [...r.querySelectorAll('.ag-wz-sum .ag-setrow small')].map((x) => x.textContent)");
    check(`${tag}: Zusammenfassung: Modi, Sensoren mit Eingang und Zeiten, Code, Meldungen, Aktionen`, sum[0].includes(t.modes[2]) && sum[1] === t.sumZones && sum[2] === "Diego" && sum[3] === t.sumNotify && sum[4] === t.sumActions, J(sum));
    check(`${tag}: Ausprobieren: Test der Aktionen, Testmeldung, Bereit zum Scharfschalten je Modus`, await s.ev("return !!r.querySelector('[data-wz=\"wf-test\"]') && !!r.querySelector('[data-wz=\"nt-test\"]') && r.querySelectorAll('.ag-wz-readyrow .ag-rchip').length === 3"));
    if (mobile) await s.tap('.ag-wz-sum [data-wz="goto"][data-step="code"]');
    else await s.tap('.ag-wz-side [data-wz="goto"][data-step="code"]');
    check(`${tag}: ${mobile ? '"Ändern"' : "Schrittliste"} führt zurück zum Code`, await H.waitStep("code"));
    for (const st of ["notify", "actions", "monitor", "done"]) {
      await s.tap('[data-wz="next"]');
      await H.waitStep(st);
    }
    check(`${tag}: ohne Änderung durch die Schritte zurück zu "Fertig"`, (await H.step()) === "done" && (await s.ev(`return r.querySelector('[data-wz="next"]').innerText.trim() === ${J(t.finish)}`)));
    await s.tap('[data-wz="next"]');
    check(`${tag}: "Fertig": Server merkt "abgeschlossen", das Panel zeigt die Übersicht der neuen Anlage`, await s.waitFor("return !r.querySelector('.ag-wz') && r.querySelector('[data-seg=\"tabs\"] [data-tab=\"overview\"]')?.classList.contains('on') && r.querySelector('select[data-act=\"system\"]')?.value === 'e_ferienhaus'", 8000)
      && (await H.sys("e_ferienhaus")).wizard.state === "done" && (await H.calls()).at(-1)?.action === "done");
    check(`${tag}: keine Fehler im Browser (Ablauf)`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();

    // ----- Konfiguration › Anlage: Kapitel vor "Anlage löschen" -----
    s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" }, query: "&wizard=later&wzstep=zones&wzuntil=2999-01-01" });
    H = helpers(s);
    check(`${tag}: Kapitel "${t.chapter}" direkt vor "${t.del}"`, await s.waitFor(`const c=r.querySelector('.ag-wzrow')?.closest('.ag-chap'); return !!c && c.querySelector('.ag-chap-t').textContent === ${J(t.chapter)} && c.nextElementSibling?.querySelector('.ag-chap-t')?.textContent.startsWith(${J(t.del)})`));
    check(`${tag}: verschoben: Stand, "${t.restart}" und "${t.resume}"`, await s.ev(`const row=r.querySelector('.ag-wzrow'); const b=[...row.querySelectorAll('[data-wz="run"]')].map((x) => x.innerText.trim());
      return row.innerText.includes(${J(t.stLater)}) && JSON.stringify(b) === ${J(J([t.restart, t.resume]))}`), await s.ev("return r.querySelector('.ag-wzrow')?.innerText"));
    await s.tap('.ag-wzrow [data-wz="run"][data-step="zones"]');
    check(`${tag}: "${t.resume}" öffnet beim Schritt "Zuordnung und Eingang"`, await H.waitStep("zones") && J((await H.calls()).at(-1)) === J({ entry_id: "e_haus", action: "start", step: "zones" }));
    await s.tap('[data-wz="later"]');
    await s.waitFor("return r.getElementById('ag-wzask').open");
    await s.tap('#ag-wzask [data-wz="ask-hide"]');
    check(`${tag}: zurück unter Konfiguration › Anlage, Stand "${t.stHidden}"`, await s.waitFor(`return !r.querySelector('.ag-wz') && r.querySelector('.ag-wzrow')?.innerText.includes(${J(t.stHidden)})`));
    await s.tap('.ag-wzrow [data-wz="run"][data-step="welcome"]');
    check(`${tag}: "${t.restart}" beginnt beim Willkommen`, await H.waitStep("welcome") && J((await H.calls()).at(-1)) === J({ entry_id: "e_haus", action: "start", step: "welcome" }));
    await s.ctx.close();

    // Abgeschlossen: ein Knopf; offene Änderungen fragen vorher
    s = await open(browser, { mobile, lang, tab: "config", prefs: { sub: "system" } });
    H = helpers(s);
    check(`${tag}: abgeschlossen: "${t.stDone}", nur "${t.run}"`, await s.waitFor(`const row=r.querySelector('.ag-wzrow'); const b=[...(row?.querySelectorAll('[data-wz="run"]') || [])]; return !!row && row.innerText.includes(${J(t.stDone)}) && b.length === 1 && b[0].innerText.trim() === ${J(t.run)}`));
    await s.tap('[data-sys="mode"][data-mode="night"]');
    await s.waitFor("return r.host.systemUi.dirtyCount() > 0");
    await s.tap('.ag-wzrow [data-wz="run"]');
    check(`${tag}: ungespeicherte Änderungen: Rückfrage "${t.dirty}" statt Start`, await s.waitFor(`const d=r.getElementById('ag-wzask'); return d.open && d.innerText.includes(${J(t.dirty)}) && !r.querySelector('.ag-wz')`));
    await s.tap('#ag-wzask [data-wz="ask-close"]');
    check(`${tag}: "Abbrechen": nichts gestartet, die Änderung bleibt`, await s.waitFor("return !r.getElementById('ag-wzask').open && !r.querySelector('.ag-wz') && r.host.systemUi.dirtyCount() > 0") && (await H.calls()).length === 0);
    await s.tap('.ag-wzrow [data-wz="run"]');
    await s.waitFor("return r.getElementById('ag-wzask').open");
    await s.tap('#ag-wzask [data-wz="dirty-go"]');
    check(`${tag}: "Verwerfen und starten": Entwurf verworfen, Assistent beim Willkommen`, await H.waitStep("welcome") && (await s.ev("return r.host.systemUi.dirtyCount() === 0")) && (await H.calls()).at(-1)?.action === "start");
    await s.tap('[data-wz="next"]');
    check(`${tag}: Modi zeigen den gespeicherten Stand (Nacht an)`, await H.waitStep("modes") && (await s.ev("return r.querySelector('[data-wz=\"mode\"][data-mode=\"night\"]').classList.contains('on')")));
    check(`${tag}: keine Fehler im Browser (Kapitel)`, s.errors.length === 0, s.errors.join(" | "));
    await s.ctx.close();
  }
}
await browser.close();
done();
