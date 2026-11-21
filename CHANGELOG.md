# Changelog

[Deutsch](https://github.com/Diegofuego871/ha-alarmageddon/blob/main/CHANGELOG.de.md)

All notable changes to this integration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.74.1] - 2026-11-21

### Changed

- **HealthCheck form:** the title "On alarm (optional)" is now "On alarm"; both suffixes are optional. For a service Alarmageddon recognizes, both are filled in for you (as long as you have not touched them); you can empty them or save without them. Without a failure or alarm suffix the matching test button ("Send failure", "Send alarm") is not shown, in the list and in the head of the log.
- **Setup assistant wand:** wand, stars and shooting star start at the same moment, without a gap: while the wand swings the stars wiggle and the shooting star sets off from the dot, slowly at first and faster and faster (a short acceleration curve) once around the button; when the wand comes to rest the dot flashes briefly and stays.

### Fixed

- **Setup assistant, "More features":** after jumping to a window in the configuration and closing it, the last step now stays where you left it (it used to jump back to the top). On the phone "Start assistant" (Configuration › Alarm system) is left-aligned and as wide as "Delete alarm system" below it, not across the whole width.
- **New routine:** the field "Name" was red and an error about the number of characters was shown as soon as the window opened, as if saving had already been tried. The form now starts quiet: the name turns red only after you have touched it, the message appears after the first change in the form, and "Save" stays disabled as long as something is missing. The focus and the position of the window stay as they were.

## [1.74.0] - 2026-11-21

Includes the changes from 1.72.0 and 1.73.0 (neither was released as such).

### Fixed

- **Update from the build published as "1.73.0":** a release under the tag `1.73.0` (without "v") was published by mistake on an intermediate state of that day. The version number was already in use, so Home Assistant did not offer the finished state as an update. 1.74.0 carries the finished state of 1.73.0 under a new number.

## [1.73.0] - 2026-11-21

Not released; included in 1.74.0.

### Added

- **Alarm call for HealthCheck services:** besides the failure suffix (self-test has problems) a service can have an **alarm suffix** (optional). When an alarm system is triggered, Alarmageddon calls the service with it at once (seen within 10 seconds, never held up by the minimum gap), so the service reports "Alarm triggered" instead of "Self-test failed". When the alarm ends, the normal life sign goes out. An alarm has precedence over a self-test failure. Services without an alarm suffix behave as before. A hanging service never holds up an alarm.
- **Second button "Send alarm"** in the list of services and in the head of the log, only for a service with an alarm suffix; the log records the call as its own kind of event.
- **Suggestions with a message in English:** for Cronitor (`?state=fail&message=…`) and Uptime Kuma (`?status=down&msg=…`) the failure suffix and the alarm suffix carry a short message; for Healthchecks.io and Better Stack (the message can only be sent with POST there) `/fail` and, for the alarm, `/2`. The alarm suffix is only suggested ("Use"), never filled in by itself.
- **Setup assistant wand:** it repeats after a pause of 30 seconds and ends with a shooting star around the button, like in Device Panel; the shooting star starts the moment the wand stops moving.

### Changed

- **HealthCheck form in chapters:** Service, On self-test failure, On alarm (optional), Interval, each with a title with a bar before it.
- **Log of HealthCheck services:** the 90-day chart is now a **6-month** chart (more filled in); 90 days is replaced.
- **Action buttons tinted:** "Send life sign" slightly green, "Send failure" slightly orange, "Send alarm" slightly red; pencil and log stay neutral. The cross and the round buttons in the head of the log are the same size and on one line on the iPad.
- **"Use" next to a suggestion** (failure and alarm suffix) is a bold button with a tinted background and a border instead of a faint link, so it is not overlooked.
- **Setup assistant, "More features":** a round arrow in each row jumps straight to the feature (Routines, Codes per person, Your own sounds, HealthCheck): Configuration › Alarm system opens with its window. Closing the window brings you back to the assistant on the same step; nothing is completed on the way. The dashboard card has no jump (it lives in the Home Assistant dashboard).
- **Time range of the sensor view and of the HealthCheck log** (3 hours to 1 year) is a tab bar with a gliding capsule like everywhere else; it used to be a static bar without a capsule, so nothing moved when switching.
- **Add code:** user, name and code are chapters (bold title with a bar before it, like "Add routine"); the setup assistant uses the same window. The focus goes straight into the field "Name" so you can start typing, but the window no longer scrolls down for it (on the iPhone the title used to disappear).
- **Small windows with a name field look the same everywhere:** "Create backup", "Add alarm system", rename and delete carry the field title as a chapter (bold title with a bar before it), like "Add code" and "Upload a sound". The delete window gets the chapter "Confirmation". The focus in these windows no longer scrolls the window.
- **Self-test intervals** (Configuration › Alarm system › HealthCheck): the symbols in front of "Not armed" and "Armed" are green and red, in the same tones as on the card of the alarm system; the text stays neutral.
- **Upload a sound** (window "Your own sounds" and the action step): "Name" and "File" are chapters like in "Add code", with the same font and size.

### Fixed

- **Table corners on the phone:** the sticky head row of the tables in the windows HealthCheck services and Backups covered the rounded corners of the card; the corners are round now. The six buttons of a service fit in the row on the phone.

## [1.72.0] - 2026-11-20

Not released; included in 1.74.0.

### Added

- **Status card with HealthCheck:** once HealthCheck services are set up, the status card on a dashboard shows them next to the self-test, like the status tile of the panel (all OK, failure reported, failed). The status entity carries the numbers as attributes (`healthcheck`, `healthcheck_ok`, `healthcheck_report`, `healthcheck_fail`), never an address.
- **Setup assistant, "More features":** "Your own sounds" is listed too.

### Changed

- **Filters for sensors** (Configuration › Sensors and "Add sensors"): a filter of its own for water sensors; with monitoring on, measurements are filtered by kind, temperature, humidity, brightness and air quality, instead of one filter "Measurements". "Other" holds everything that has no filter of its own (smoke, gas, heat, vibration, tamper, sound, glass break and the like, air pressure). Only the filters for which there are sensors appear.
- **Setup assistant, "More features":** the symbols have the colour of their chapter under Configuration › Alarm system.

## [1.71.0] - 2026-11-20

### Added

- **Button for the setup assistant in the header:** as long as the setup assistant of an alarm system is not finished ("Later", "Don't show again" or not yet started), a round button with a magic wand stands next to the pencil, in every tab. It continues exactly at the step where you stopped (the tooltip names it); with open changes it asks first. Once per loading of the panel, five seconds after it appears, the wand swings briefly. After "Finish" the button is gone; "Start over" stays under Configuration › Alarm system.
- **Setup assistant, two test messages:** the step "Notifications" and "Try it" at the end offer a test for the recipients of alarms and one for the recipients of maintenance notifications (they can differ). Each button is available as soon as its group has a recipient; open changes of the page are saved by themselves, as before.

### Changed

- **Setup assistant on the phone:** "Back" and "Next" share the width of the footer equally.
- **Setup assistant on wide screens:** "Later" at the top and "Next" at the bottom stand at the right edge of the content instead of at the edge of the window.

### Fixed

- **Lists in windows on the phone:** in "Add measurements" of the setup assistant, long names ran into the next row (the rows were squeezed to fit the height of the list). Every row now keeps the height of its content; the measurement rows also have more space and the areas stand out as headings. The same applies to the other lists of the same kind ("Add sensors", the choice of devices and sensors in rules and routines).

## [1.70.0] - 2026-11-20

### Changed

- **Setup assistant, step "Monitoring":** the measurements no longer appear all at once as buttons (with many sensors a very long list that pushed the rules far down). The list starts empty; "Add measurements" opens a window like "Add sensors" with a search and filters (temperature, humidity, brightness, air quality, other; only those that exist), where you tick the measurements you want. The chosen ones stand in a list of fixed height with their current value, a search, the same filters and a bin to remove one. Adding and removing apply at once, as before.
- **Setup assistant, "Done":** "If you want more" is now "More features", a list for information instead of tiles that looked clickable: routines, codes per person, HealthCheck and the dashboard card, each with where to find it. Below it "Open configuration" finishes the assistant like "Finish" and opens Configuration › Alarm system.
- **Setup assistant, test message in the step "Notifications":** the hint no longer says "(saves this step first)". The button saves open changes of the page by itself, as before, so nothing needs to be saved separately.

### Fixed

- **Setup assistant:** whoever chose "Later" at the step "Monitoring" landed at "Done" the next day instead of at "Monitoring", because the step was hidden while the measurements were still loading. It now continues exactly there.

## [1.69.0] - 2026-11-20

### Added

- **Setup assistant:** a new alarm system opens a setup assistant by itself, once, the first time the panel shows it (added in the panel or under Settings › Devices & services). It asks only for the essentials and explains on the way: **Modes** (Home, Away, Night, and smoke, water and gas always active), **Sensors** (all suitable sensors of Home Assistant with filters and search), **Assignment and entry** (the sensor table of Configuration › Sensors, filled in by sensor type: doors and windows in every mode, motion only when away, smoke, water and gas always; the entry door, the time to leave and the time to disarm), **Code** (optional; with your own user filled in), **Notifications** (recipients of alarm and of maintenance notifications, a switch per notification, a test message), **Alarm actions** (the editor of Configuration › Actions with "Siren 3 minutes" and "Alarm sound" to add quickly) and **Monitoring** (only when there are suitable measuring sensors). "Done" sums everything up with "Change" per step, a test of the alarm actions, a test message and "Ready to arm" per mode.
  - Every step is saved with "Next", through the same saving as the tabs of the configuration. On the computer a step list on the left shows what is done; on the phone a progress bar.
  - "Later" asks "Show again tomorrow" (the next day it opens exactly at the step where you stopped) or "Don't show again".
  - A new chapter "Setup assistant" under Configuration › Alarm system, just before "Delete alarm system", shows where it stands and starts it again, at that step or from the start, with everything that is set up preselected.
  - Alarm systems that existed before this update and alarm systems restored from a backup do not get it by themselves. Its state is not part of backups and is removed with the alarm system.

### Changed

- **Adding an alarm system in the panel** now opens the setup assistant of the new alarm system (before: Configuration › Sensors). "Later" leads there as before.
- **Configuration › Notifications, new design:** every notification under "Fault messages" and "Maintenance messages" is a card like the fixed notifications under Configuration › Actions: switch, symbol in the colour of its chapter (fault messages red, maintenance messages orange, switched off grey), title, a short summary (to whom, critical, the own settings such as "below 20 % · after 3 checks"), play (test message) and pencil. The pencil opens a window with all settings of the notification: "Send the message", recipients, delivery (critical with volume, "stays in Home Assistant") and the own settings of the notification. Numbers are uniform: label on the left, field and unit on the right in one line, the hint below. "Apply" takes the changes over to the page; saved is as before only with "Save" at the bottom. A changed card shows "Not saved yet" with the orange dot, as everywhere in the panel; "Cancel", X and Escape ask before discarding changes made in the window. On the computer the cards stand in two columns, on the phone in one. "Settings per mode" stays at the top of "Fault messages".
- **Messages of the HealthCheck services:** now one maintenance message "HealthCheck service not answering" under Configuration › Notifications › Maintenance messages, set up like "Self-test": switch, recipients (default: the maintenance recipients), critical with volume, "stays in Home Assistant", test message, plus "Message after … failed attempts" (1 to 10, default 2) and "Message when it answers again" (on by default; same recipients, never critical, replaces the message "not answering"). The texts are fixed; the chapter "HealthCheck services" with its own texts and tap target is gone. Settings from 1.68.0 are taken over (on/off, recipients, critical, volume, "stays in Home Assistant", the number and on/off of "answers again").
- **Log of the HealthCheck services:** the header shows the round buttons of the list instead of "Edit": "Send failure", "Send life sign" and the pencil, with the same symbols and in the same order. After sending, the log reloads with the new call.

## [1.68.0] - 2026-11-19

### Added

- **Log of the HealthCheck services:** a new round button "Log" as the first button in every row of the HealthCheck services opens the log of that service, built like the sensor view. At the top the name as a dropdown to switch between the services (each with the colour of its state and since when), the state and "Edit". Three tiles: **History**, **Response time** and **Service**; the period runs from 3 hours to 1 year.
  - **History:** up to 1 day a "heartbeat" with one bar per call or section (height: response time, colour: life sign, failure reported, failed, test; grey where there is no data because Home Assistant was off) and a band below that shows the state without a break. 7 days show a time line per day, 30 days a grid of days and hours like motion sensors, 90 days and 1 year a grid of months and days (one cell per day, grey for a gap of more than 30 minutes) with the number of days with a failure, a failure report or a gap. Figures: successful in percent, life signs, failed, failures reported, mean response time.
  - **Response time:** a line with the zones fast (up to 300 ms), slow and very slow (over 1 s) and a dashed red mark for every failed call; figures now, on average, slowest call, without answer.
  - **Service:** name, recognized service, the full ping URL, failure suffix, call on failure, interval, state, last call and since when the log records, each with a copy button.
  - **Lists "Events" and "All calls":** events are failed (consecutive failures as one event with their number), failure reported because of the self-test (with the number of problems), test, OK again and the first life sign after a start; all calls show result, response time and trigger. Both follow exactly the period chosen above, and the number on the tab is the number of the list. Single calls are kept for 24 hours; from 7 days on the list says that it shows the last 24 hours. Search and sorting by every column.
  - Kept: single calls 24 hours, hourly values 30 days, daily values and events one year (at most 1000 events per service); usually about 60 KB per service at a 5-minute interval, at most about 160 KB. Written at most 10 minutes after a call and when Home Assistant stops. The log never contains the URL, is not part of backups and is removed with the service. It starts with this update.
- **Status tile with the HealthCheck services:** once services are set up, the self-test row at the bottom of the status tile is split in the middle, without making the tile taller: on the left the self-test, on the right the services, each with a coloured symbol (green all OK, orange failure reported, red failed); a tap opens the self-test or the list of services. Without services the tile stays as before.
- **Messages of the HealthCheck services:** a new chapter "HealthCheck services" under Configuration › Notifications, always shown: "Message after … failed calls" (1 to 10 in a row, default 2; every automatic call counts (interval, after saving, change of the self-test), never the test button) and the messages "Service is not answering" (once per outage, also across a restart) and "Service answers again" (only after "not answering" went out). Each is set up like the fixed messages in the Actions tab: switch, test message, own title and text with {name}, {host}, {reason}, {count} and {since} (never the URL), recipients (default: the maintenance recipients), critical with volume, "stays in Home Assistant" and the target of a tap (default: the list of the services).

### Changed

- **Low battery only after several checks:** the message "Low battery" goes out only when the battery is below the threshold at several checks of the maintenance in a row ("Message after … checks", 1 to 10, default 3; maintenance checks every 15 minutes, so at least 30 minutes by default). A value above the threshold starts again. A single wrong value of a device, such as "Battery 1 %" for a battery at 61 %, no longer sends a message. The status entity and the overview still show the current value at once.
- **Self-test message:** a failed life sign of a HealthCheck service no longer goes out via the message "Self-test" (it has its own messages now); it stays a problem of the self-test and counts in the status tile.
- **Window of the HealthCheck services:** the column of the buttons is wider, so that all five round buttons keep their full size on the computer.
- **What is in a backup?** names the log of the HealthCheck services among what is not included.

### Fixed

- **Sensor view, battery and signal:** the column "Change" of the list showed decimals with a point in German ("+0.8 %"); it now uses the notation of the language ("+0,8 %").

## [1.67.0] - 2026-11-19

### Added

- **Self-test every few minutes:** "Self-test every" under Configuration › Alarm system › HealthCheck now takes minutes or hours for both intervals (not armed, armed), from 5 minutes to 24 hours, for example every 5 minutes while an alarm system is armed. The defaults stay 6 hours and 1 hour; intervals saved in hours are taken over. Alarmageddon now looks every minute whether a check is due (before every 5 minutes).
- **What are HealthCheck services?** The window of the services has an unfolding explanation below the list, like the self-test: what these services do, how the failure suffix works and how to set up a check, with Healthchecks.io, Cronitor, Better Stack and Uptime Kuma as examples.

### Changed

- **Window titles with the symbol of their chapter:** Routines, Your own sounds, Codes per person, HealthCheck services, Self-test, Checked and Backups, and their forms, show the same tinted symbol in the title as their row under Configuration › Alarm system, a little larger.
- **Self-test intervals one below the other:** "Not armed" and "Armed" stand below the text on the computer too, as on the phone, each with its field and unit.
- **Forms as wide as the other windows:** adding or editing a HealthCheck service or a code and creating or restoring a backup use the standard width of the windows on the computer (before narrower than the list behind them). Questions such as "Remove?" stay narrow; on the phone everything stays full screen.

### Fixed

- **Sensor view, "since" in the tile "History":** after a restart of Home Assistant it showed the time of the restart ("ok since 13:23", "clear since 13:23"), because Home Assistant resets the time of the last change then. Now it shows the last real change between open and closed (for motion the end of the last motion, for smoke, water and similar the end of the last alert), for all kinds of sensors. "Unavailable" and "unknown" in between (restart, lost connection) no longer count. If the sensor is unreachable, the time is the start of the outage, also across a restart. If no real change is known (a smoke detector that never went off), only the state is shown, without a time.

## [1.66.1] - 2026-11-19

### Changed

- **The same buttons in every list window:** Codes per person, Your own sounds and Backups now have round buttons per row like routines and the HealthCheck services; on the phone the buttons of the backups get a row of their own below name and date. The "Close" button of the backups window is white like in every other window.
- **Codes per person:** the column "Code" is gone. It only showed "••••••"; a code is stored as a hash and can never be shown.
- **Sensor table (Configuration › Sensors):** a round pencil at the end of each row opens the settings of the sensor (before: an arrow), on the computer the round bin next to it removes the sensor. On the phone only the pencil is shown, as before without the bin.

### Fixed

- **Sensor view, number of events:** the number on the tab "Events" always counts the events of the period chosen above, the same as the list. With more than 300 events in the period it showed 300 (the length of the list); now it shows the real number, and the note below the list says "The newest 300 of N events in this period are shown".

## [1.66.0] - 2026-11-19

### Added

- **Self-test: shorter interval while armed.** Besides the interval for "not armed" (default every 6 hours), the self-test has a second one that applies as long as an alarm system is not disarmed (exit delay, armed, entry delay, alarm): default every hour. Both can be set from 1 to 24 hours under Configuration › Alarm system › HealthCheck. The window of the self-test names the interval that applies. If the self-test finds a problem, the HealthCheck services get the failure call at once, so they keep one interval.
- **Self-test: list of everything checked.** A round arrow in the self-test window (in "No problems found", or below the problems) opens a list of everything the last check looked at: every entity with its name (sensors of the alarm systems and of the monitoring, devices in the actions, speakers, devices that trigger routines), every action and every recipient, grouped, green when in order, with search. "Close" closes only the list.
- **Backup: "What is in a backup?"** An info row above the backup card opens a list of what a backup contains and what it does not: codes, the log (alarms, events, alarm recordings), sensor history, states and results are not included; the backup of Home Assistant itself saves everything.
- **HealthCheck: a name for every service.** Each service now has a name (required, up to 60 characters), shown first in the list with the URL shortened below it (in full in the tooltip and the form). Services from 1.65.0 are named after the host of their URL until you change the name.

### Changed

- **HealthCheck list:** round buttons as in routines and sounds; on the phone they get a row of their own below the entry. "Close" stands next to "Add service" on the right, as in all windows with a list. The list is sorted by name.
- **Self-test window:** "Close" and "Check now" stand next to each other on the right, as in all windows.
- **Chapters under Configuration › Alarm system:** the icons of Routines, Codes per person, Your own sounds, the HealthCheck services and Backup each have their own light colour, so the chapters stand apart. Only the icon changes; an empty chapter stays grey, and the self-test keeps its colour by result.
- **Notification of a failed life sign:** names the service by its name and host (never the URL).
- **Timing of the life signs:** a life sign goes out at most 10 seconds after its interval has passed. A life sign postponed after a change of the self-test is dropped when the regular one goes out first, so there are never two calls in a row.

### Fixed

- **Battery forecast in the sensor list.** Some sensors showed "–" in the column "Forecast" although the sensor view showed a forecast (for example "~16 months" with "1 year"). Two causes: the forecast only covered the sensors of the zones and "always active", so measured values of the monitoring and sensors only in the list never got one; and it only used the history of the recorder, which Home Assistant keeps for 10 days by default, so a battery that had not changed for weeks or rose slightly at the end got no forecast. The list now covers all its sensors and calculates like the sensor view with "1 year", from the long-term statistics since the last battery change.

## [1.65.0] - 2026-11-18

Includes the changes from 1.64.0.

### Added

- **Self-test.** Alarmageddon now checks itself regularly: are all devices, speakers, actions (services), recipients and custom sounds that the actions, the monitoring rules, the routines and the notifications use still there and reachable, do the sensors of the alarm systems still exist, and is there an address for the speakers? During operation it also records steps that failed or did not answer, notifications that did not go out, parts that did not start, a failed automatic backup and life signs to the HealthCheck services that did not go out. A device that a step switches (siren, switch, speaker) counts as soon as it has been unreachable for five minutes; unreachable sensors are still reported by the maintenance messages (no double message). The self-test only reads: it never switches anything, plays no sound and sends no test message, and it never holds up an alarm.
  - **When:** a few minutes after Home Assistant starts, shortly after every save, every 6 hours (adjustable from 1 to 24 hours under Configuration › Alarm system › HealthCheck) and with "Check now".
  - **Where:** the status tile of the overview always shows a row with the last check; problems count towards "N need attention". A click opens a window with every problem, grouped by alarm system: what is wrong, where (with "Open", which jumps there), what it means, possible causes and how to fix it. Each alarm system gets a new entity "Self-test" (problem, diagnostic), the status entity and the dashboard card count the problems, and Home Assistant shows them under Repairs (one message per alarm system and one for all of them).
  - **Notification:** new maintenance message "Self-test", switchable and adjustable like the others (recipients, critical, in Home Assistant); each problem is reported once, again only when it comes back after it was fixed.
  - **Clearing:** a setup problem disappears by itself once it is fixed. A problem during operation disappears as soon as the same call works again (in an alarm or a test), or with "Done" in the window.
- **HealthCheck: life signs to external services.** New chapter under Configuration › Alarm system, for all alarm systems: the self-test (last check, "Check now", "Show problems", interval) and up to five services such as Healthchecks.io, Cronitor, Better Stack or Uptime Kuma that Alarmageddon calls regularly. If Home Assistant fails or loses its internet connection, the life signs stop and the service alerts you, independently of Home Assistant.
  - **Generic:** each entry has a ping URL (http or https), an optional failure suffix and an interval from 1 minute to 24 hours (number and unit, or a quick choice). As long as the self-test has problems, Alarmageddon calls the URL with the failure suffix instead ("/…" extends the path, "?…" or "&…" sets parameters); without a suffix only the life sign goes out. A change of the self-test is reported at once, at most once a minute per service.
  - **Suggestions, never a choice made for you:** for well-known services (Healthchecks.io, Better Stack, Cronitor, Uptime Kuma) the form recognizes the URL and suggests the failure suffix. It is only filled in while you have not touched the field; otherwise the suggestion stands next to it with "Use". A preview shows the exact failure call.
  - **List in a window** like sounds, routines and codes: a table with search and sorting (URL, last, interval, status), per row "Send failure" and "Send life sign" as a test, edit and remove. The row in the chapter shows how many services are set up and whether a life sign failed.
  - **Security:** the ping URL is shown in full in the panel and stored in backups (it is your setting); the log, notifications and self-test problems only name the host. A life sign waits at most 10 seconds and never holds anything up. A life sign that does not go out becomes a self-test problem ("Open" leads to the list); it does not count as a failure for the next life sign.
- **Sensor view: tabs "Events" and "Rules" for every sensor of the monitoring.** Measured values and yes/no sensors that appear in a monitoring rule show two tabs below the chart. "Rules" lists the monitoring rules with this sensor (all alarm systems) with the condition in words and the state "Active", "Off" or "Outside". Both lists can be searched and sorted by every column. The arrow of a rule opens it under Configuration › Actions › Monitoring, unfolded and briefly marked; unsaved changes in another alarm system are asked about first.

### Changed

- **Every limit is visible in the chart.** Until now a limit far from the values was left out without notice (a fridge at 5 °C showed no line for a limit of 14 °C); now the chart always reaches up to it.

### Fixed

- **Hint of the chapter "Maintenance messages".** It still named updates, which Alarmageddon has no longer checked since 0.27.0; it now names the self-test.

## [1.64.0] - 2026-11-18

Not released; included in 1.65.0.

### Added

- **Codes per person: "Add code" directly on the page.** Like routines and your own sounds, the row shows "Add code" on the left and "Show codes" on the right. It opens the same window as "Add code" in the list; with 20 codes it is disabled.
- **Add alarm system: copy the entity ID.** A button right next to the alarm entity (for example `alarm_control_panel.garage`) copies it to the clipboard, with a check mark as feedback. It is the same button as in the sensor view, where values could already be copied.

### Changed

- **Every "Show …" button has its own icon.** Routines keep the list, your own sounds the speaker, codes get a key and backups an archive box; until now routines, codes and backups had the same list icon. The plus of "Add …" stays the same everywhere.
- **The rows "Routines", "Your own sounds" and "Codes per person" are built the same.** On the phone both buttons of a row are equally wide when they fit next to each other.
- **Chapter "Backup" like the others.** At the top "Last backup" with "Create backup" and "Show backups" next to each other in one row, below it the automatic backup; the hint stands above the card. Until now the two buttons were in two rows.
- **German says "Backup" throughout.** The German panel mixed "Sicherung" and "Backup" until now; it now says "Backup" everywhere, also in the windows, hints, error messages and when deleting an alarm system. English is unchanged.
- **The mode tabs look the same everywhere.** In the Sensors, Notifications and Alarm system tabs, and in the Actions tab without monitoring, the tabs of the modes now look like those of the Actions tab with monitoring: icons in the dark red of the alarm zone ("Monitoring" orange), the selected tab with a red border, the text neutral instead of blue.

### Fixed

- **Sensor view: the value of a monitoring event in the format of the language.** German showed "9.2 °C" instead of "9,2 °C".

## [1.63.0] - 2026-11-17

### Added

- **Play button on every fixed message.** The cards "Armed", "Silent alarm", "Entry delay", "Disarmed" and the closing message have a play button before the pencil: it sends a test message with the values of the card, unsaved ones too. When the message is switched off, it is disabled.
- **The closing message can be switched off.** Its switch now sits on the card like with the other fixed messages; in the window it is called "Send the message". Off: when the alarm ends, no message goes out, and the alarm message stays on the phone. Until now "Alarm ended" always went out.
- **Codes per person: edit a code.** The pencil opens the same window as "Add code", with name and user filled in. Left empty, the code fields keep the current code; a new code replaces it. The same rules apply as when adding (no code, name or user of another person).
- **Codes per person: an eye in the code fields** shows the code you are typing and hides it again. Saved codes cannot be shown: only a hash is stored.
- **Codes per person: a warning for codes that are easy to guess.** Red and bold with a warning sign below the code fields: sequences (1234, 2468), only one digit (0000), repeated patterns (1212, 1122), three equal digits in a row, mirrored numbers (1221), lines on the keypad (2580), years (1987) and dates (24121990); while typing fewer than 4 digits "Too short". Saving stays possible; codes with fewer than 4 or more than 8 digits are refused as before.

### Changed

- **Every play button behaves the same.** When pressed it turns red and becomes a stop button, everywhere in the panel: test a step, "Test" at the bottom, fixed messages, test in the window of a message, sound preview, your own sounds, monitoring step, test message in the Notifications tab. Until now the sound preview turned blue, the monitoring test stayed a play button, and the test messages showed nothing at all. A test message is already on its way once sent: its button stays red until the server has answered, at least 1.5 seconds; there, stop only ends the display.
- **The closing message is built like the other fixed messages.** "Message: closing message", below it the recipients, critical and "own text", the same bell icon. The window no longer has a second switch "own message": title and text are shown right away, left empty the standard text applies. Existing settings stay as they are.
- **"Messages" is now called "Fault messages".** Since 1.62.0 the chapter in the Notifications tab only holds "Arming not possible" and "Sensor unreachable while armed"; "Maintenance messages" follows below.
- **Your own sounds: a button "Upload" for the file.** Instead of the browser's field ("Choose File", on the iPhone with an empty square before the name) there is a button in the panel's style with an upload icon, the file name next to it. The button at the bottom is called "Save".
- **Windows "Routines", "Your own sounds", "Backups" and "Codes per person": title and search field stay at the top while scrolling.** The list runs underneath, the distance from the search field to the list always stays the same. Until now the search field scrolled away and was cut in half at the top edge on the phone.
- **Codes per person in a window.** The page keeps the summary with "Show codes", the main code and "Acknowledging asks for the code". The window (full screen on the phone) shows a table with name, user and code, sortable by name and user, with a search field that stays at the top; the code appears only as "••••••". "Add code" sits in the footer, pencil and bin in every row. Below 360 pixels width the code column is left out.
- **"Monitoring" tab: the switch "Settings per mode" is shown here too.** Until now an empty space kept its place. The tab row sits at the same place in every tab; switching it in the "Monitoring" tab keeps you there.
- **Action group: "Repeat until disarmed" stands out more.** How the group repeats is shown in its header slightly larger and bold.
- **Adding an alarm system in Home Assistant: a name that is taken is refused like in the panel.** Upper and lower case and double spaces no longer make a different name ("haus" next to "Haus" was possible); the dialog shows the error at the name instead of ending.
- **The main code can no longer be the same as a person's code.** In the options of the integration a new main code that belongs to a person is refused; "changed by" would otherwise stay empty. Adding a person's code already refused the main code.
- **Saving the zones keeps the zone of a mode that is missing in the request.** The panel always sends all modes; only other callers were affected.
- **Dashboard card: less work on every state change in the house.** The card looks up the entities of its alarm system only when the entity registry changes.
- **A button that sends something takes no second press until the answer has arrived.** "Save" when adding or editing a code, "Save" for a backup, "Restore" and renaming your own sound. A double click sent everything twice until now (two identical backups, a second import).
- **Fewer requests after a lost connection.** The panel tries again every 5 seconds, with one request. Until now every failed request planned its own retry: after an hour without connection around 120 ran side by side, and they all reached Home Assistant at the same moment when the connection returned.
- **Error messages of number fields name the right unit.** Reminder of a monitoring rule in hours, the "Wait" step of monitoring in minutes or seconds (up to 60 minutes or 3600 seconds), the number of automatic backups as a number. Until now every message said "seconds", for the wait step "from 0 to 60".
- **The device selection of routines and monitoring loads with the three dots** like everywhere else in the panel, instead of the text "Loading devices ...".
- **Screen readers name the number fields in the Alarm system tab by their title** ("Exit delay") instead of the internal key ("exit_delay").

### Fixed

- **Phone: rows "Routines" and "Your own sounds" in the Alarm system tab.** The buttons squeezed the summary to zero width, the text ran word by word under the buttons ("3 Ro…", also with "Changes not saved yet"). On the phone the buttons now sit below the text.
- **Phone: play and pencil of the fixed messages** sit below the text like with the steps; next to it there was too little room for "Message: closing message".
- **Notifications tab: the note about the new place of the messages stuck** to the card above and to the next chapter. It now has room.
- **A damaged routine no longer stops the alarm system from loading.** Until now only some errors were caught; a trigger that was not readable left the whole alarm system unloaded. The other routines run.
- **A damaged history of the reception or of the sensor statistics no longer stops the recording.** Until now nothing was recorded until Home Assistant restarted, and the sensor view showed an error for every sensor.
- **Restoring a backup into a new alarm system whose setup failed** no longer stops with an error halfway.
- **Backups created or deleted at the same time no longer lose a change** (automatic backup and the panel).
- **Two sounds uploaded at the same time** can no longer get the same name or exceed the limit.
- **Double click on "Save" when adding a code created the code twice** (the same person with the same code twice). Adding, editing and removing codes now run one after another for each alarm system; editing and removing at the same time no longer bring back a removed code.
- **Sensor view, "Device" tab: "Always active" only where it applies.** It was shown for every alarm system whose sensor type has "Always active" as preset, also when the sensor did not belong to that alarm system or "Always active" was switched off there. The view now counts like the list of the overview.
- **Keyboard after dragging over the boxes in the Sensors tab:** the first Space or Enter on a box did nothing.

## [1.62.0] - 2026-11-17

### Added

- **Fixed messages in the Actions tab.** "Armed", "Disarmed", "Entry delay" and "Silent alarm" now sit as a fixed element at their point in the flow, like the closing message under "Alarm ends": always there, with a switch to turn them on and off and a pencil for the settings. They apply per alarm system and, with "Settings per mode", per mode; the "Always active" tab only has "Silent alarm". The standard recipients from the notifications are preselected, and each message can have its own recipients.
- **Own title and text for these messages.** In the window of the message: title and text with placeholders, among them the new {person} (who armed or disarmed) and {delay} (the time of the entry delay), with a preview. Left empty, the previous standard text applies. As before, critical with volume and "keep in Home Assistant"; new are the tap target and a test message with the values from the window.
- **New chapter "On a silent alarm" with its own actions.** Before the chapter "On an alarm". When a sensor with the option "Silent alarm" responds, the message goes out and the actions below it run: arming tone, switch a device, wait, scene, custom action, also in a group. There is never an alarm, so there is no siren and no alarm message either. They run at most once per sensor and minute, for the mode the alarm system is armed in; for always-active sensors the list in the "Always active" tab applies. An alarm, a test and a running entry or exit delay have priority; an alarm or disarming ends them at once. Devices are not restored.
- **Preview of a routine.** In the "Routines" window every row has an eye. It shows the routine the way the editor shows it at the very bottom (trigger, check of the state, action), read-only, in the same window and full screen on the phone. "Close" leads back to the list (the search stays), "Edit" opens the editor.
- **A group shows that it repeats.** To the left of the actions of a group, a thin dashed arc leads from the last step back to the first.

### Changed

- **The four messages are no longer in the Notifications tab.** A note there names the new place. Your previous settings still apply: as long as an alarm system has not saved anything of its own for a mode, it sends these messages exactly as before the update (on/off, critical, volume, own recipients, also the values per mode). The Actions tab shows this state. Only what you save there applies to this alarm system and this mode.
- **"Recipients" is now called "Standard recipients".** The chapter in the Notifications tab; the messages in the Actions tab use the same name.
- **"Copy actions from …" takes the fixed messages and the actions on a silent alarm along.** From a mode to "Always active" and back only the message "Silent alarm".
- **The backup contains the fixed messages and the actions on a silent alarm.** An older backup can be restored as before; its alarm systems then send according to the shared settings.

### Fixed

- **Window of a message on the phone: the select field "Tap target" stuck out over the edge.** In German it was wider than its card (in the window of the closing message and of the alarm message). It now stays inside the card.

## [1.61.0] - 2026-11-17

### Changed

- **Times look the same everywhere.** From 60 seconds on a time is shown in minutes and seconds, from one hour with hours; parts that are zero are left out ("45 s", "1 min 30 s", "2 min", "1 h 5 min"). Before, the same time could read "120 s" on one card and "2 min" on the next, and an hour of group time read "60 min". It applies to the cards of the actions (wait, tone length, "undo after", group), the quick-pick buttons in the editor, the delays, the summary of the monitoring rules (hold time, reminder, formerly "30 Min." and "2 Std." in German), the routines, the length of an uploaded sound, the timeline of an alarm and the push message "Alarm in 2 min" during the entry delay. Input fields keep counting in seconds.

## [1.60.0] - 2026-11-17

### Added

- **"Undo after a time" in an action group as well.** The option of "Switch device" (for example a socket with a siren: on, off after 2 minutes) did not exist in a group. Now it exists there as everywhere. In a group only one pending switch-back counts per device, and every round starts the time anew: if the round is longer than the time, the device switches back after the time in every round. If it is shorter, the device only switches back once no round switches it any more, so after the last round. Disarming, acknowledging and "Silence alarm sound" switch back at once as before. The window of the step says so inside a group.
- **Search field in the windows "Routines", "Your own sounds" and "Backups".** A search field stands above each list. It finds everything the row shows (name, trigger and effect in words, tags such as "Bypasses the code", length and size of a sound, date and alarm systems of a backup), for routines also the entity IDs of the devices, for example "lock.haustuer". Several words must all occur, upper and lower case do not matter. The buttons of a found row work as usual.
- **Filter "Automatic only" for the backups.** Next to the search field; it shows only the automatic backups and can be combined with the search.

### Changed

- **The overview no longer stops Home Assistant.** On newer versions of Home Assistant (measured on 2026.10.4 and 2026.11.1) all of Home Assistant stood still on every request of the overview: about 1.4 seconds on a real installation with 151 sensors, when the panel opens and every 30 seconds after that. Cause: Alarmageddon read a field of the device registry twice per sensor that Home Assistant only keeps there as a deprecated bridge, and every access to it costs several milliseconds. With monitoring switched on every temperature and humidity of the house counted as well, which is why it became noticeable with the measurements. Now the new field is read, and signal and hardware only once per device. In the test with 151 sensors the request drops from about 250 to about 6 milliseconds. The same hit the recording of the signal once a minute.
- **The response for the overview is smaller.** It only lists the sensors of the alarm systems. The list of all matching sensors of the house is fetched only when you open "Add sensors" (briefly with the loading indicator there). In a house with 400 devices that is about 14 kB instead of 475 kB, every time the overview opens and every 30 seconds after that.
- **Changing measurements no longer rebuild the list all the time.** Since 1.58.0 the panel takes over new states four times a second; every change of any matching sensor of the house then rebuilt the whole sensor list. Now only sensors that are shown count. States (door open, motion, alarm) still appear at once; measurements, battery and signal are collected and redrawn at most every 2 seconds. Measured with 20 measurements and 10 changes per second, the list is rebuilt 4 times instead of 40 times in 10 seconds.
- **Tested against a current version of Home Assistant.** The tests only ran against 2026.2.3 so far; the defects of this version could not be seen there. Now they also run against 2026.10.4, and a test fails as soon as Home Assistant reports a deprecated use by Alarmageddon.

### Fixed

- **The setting "Undo after a time" was lost when a step was dragged into a group.** It was dropped without any notice: the device would have stayed on until someone disarms. It is now kept.
- **Sensor view of a measurement: "Battery" and "Signal" only showed "The history could not be loaded".** The server rejected both tabs for every measurement sensor (for example a temperature sensor). They now show the history as for door and window sensors.
- **A backup with an unknown entry is rejected as a whole again on newer versions of Home Assistant.** There an unknown entry in the settings per mode or in the actions was silently left out and the rest was imported. Nothing of it was stored; the rule "a backup with an invalid value is rejected" now holds with every version again.
- **No deprecated interfaces of Home Assistant any more.** Renaming an alarm system and the preview of the entity ID used functions that Home Assistant removes in 2027 (a warning in the log so far).

## [1.59.0] - 2026-11-17

Includes the changes from 1.58.0.

### Added

- **Action group.** A new element under Configuration › Actions: a group repeats its actions in their order, for example "light on, wait 2 seconds, light off, wait 2 seconds" as a flashing light, or a siren in a rhythm. You choose for how long: a **number** of rounds (1 to 100), a **duration** (1 to 3600 seconds) or **until disarmed** (only in the flow of the alarm; ends with disarming, acknowledging or "Silence alarm sound"). The group is a frame with a header in the colour of its area (red for the alarm, light red when armed, orange for the delays, green after acknowledging and when disarming); inside, the actions are the same cards as everywhere. Actions get into the group with the plus or by dragging, and out again the same way; with the keyboard an action moves into a group, through it and out of it with the arrow keys. The group exists in all lists of the actions (not in the monitoring rules), each with the actions that are possible there; a group has at most 10 actions, which count towards the limit of 40 per list.
- **"Wait until the action has finished" for the group as well.** As for the other actions: off (default) the group runs alongside and the following actions start at once, on the flow waits for its end. A group "until disarmed" cannot be waited for.
- **A question when a group moves to another area.** When you drag a group, for example, from the alarm to arming, a window names the actions that do not exist there (such as push notification or alarm sound) and removes them only after you confirm; "until disarmed" becomes a number of rounds there. "Cancel" leaves the group where and as it is.
- **As safe as the other alarm actions.** Every action in the group is under the same limits (a device that does not answer is skipped after 10 seconds, a failure never stops the others). Every round takes at least 1 second, so that a group without "Wait" does not cause a flood of switching commands and notifications. With "duration" a round only starts if it still fits into the time completely: the group never runs longer than set and never ends in the middle of a round (the light does not stay on). After a restart of Home Assistant in the middle of an alarm a group "until disarmed" starts again; a group that is waited for goes on with the remaining rounds or the remaining time. A device with "Undo" returns to its previous state when disarming, also when disarming happens in the middle of a round.

### Changed

- **The recording of an alarm has a hard limit.** Actions and notifications used to be added to the timeline always. From 600 entries on only state changes and the end are added: a group that sends a notification every round until disarmed can no longer make the recording grow without end. The actions of a group appear on the timeline only for the first round.

## [1.58.0] - 2026-11-17

Not released; included in 1.59.0.

Result of a full code review (logic, stability, speed) and requests for the interface.

### Added

- **"Upload sound" directly on the page Alarm system.** The chapter "Your own sounds" has the button "Upload sound" next to "Show sounds" (a normal button, not blue); it opens the window with the form right away. When you upload a sound in the editor of a step, a subtle orange note below the selection says: "Uploaded and selected for this step. The step is not saved yet." The sound itself is stored at once; only the step is still open.
- **"Add routine" directly on the page Alarm system.** The chapter "Routines" has the button "Add routine" next to "Show routines" (not blue); it opens the editor right away. A new or changed routine carries the orange mark "Not saved yet" in the list, and the summary on the page says "Changes not saved yet" until you save the page.
- **Own storage for the state of the alarm system.** Every change (armed, delay, alarm, disarmed) is written at once. Home Assistant itself stores states only every 15 minutes and on a clean shutdown: after a crash or power loss the system used to come back with a state up to 15 minutes old (for example disarmed although it was armed). At startup the newer of the two states wins; the storage is removed together with the system.

### Changed

- **The overview loads faster.** The 15 files of the panel were fetched one after the other, each only after the previous one; now the browser loads all of them at once (measured with 120 ms delay per request: 2.7 s before, 1.0 s now until the overview is ready; on a local network 0.4 s before, 0.27 s now). The response with the data lists the measurement sensors of the house only when a system has monitoring switched on, and the first response after a restart waits at most 1.5 seconds for the history behind "Last change" (the rest follows).
- **States appear in the panel at once.** The panel took over the state of Home Assistant only every 5 seconds: an alarm or an open sensor showed up to 5 seconds late, and after arming the loading indicator kept spinning for up to 4 seconds. It now checks every 250 ms whether there is a new state.
- **New icon for "Show backups":** a list, as for "Show routines". The previous icon (arrow with an eye) read as "create a backup" or "restore".
- **The tab row under Configuration › Actions stays at the same height when switching to "Monitoring".** The place of the switch "Settings per mode" stays empty there instead of the row jumping up.
- **Restart in the middle of an alarm without a stored run:** the alarm actions start from the beginning instead of staying silent (when in doubt, sound the alarm). An alarm silenced with "Silence alarm sound" stays silent after a restart. A test or the actions after acknowledging are no longer resumed as an alarm run after a restart.
- **Less work per sensor event.** The check for "Always active" and the status entity searched all sensors and the registry on every event of a sensor; an alarm sound was built separately for every speaker. Both now happen once.

### Fixed

- **Alarm without siren after a restart.** When the entry delay ran out during a restart of Home Assistant, the system did change to "alarm", but alarm actions, push message, log and recording stayed out: they were not listening yet at that moment. The alarm now begins as soon as all parts are ready.
- **Damaged stored data made the system "unavailable".** An unreadable point in time or a wrong type in the stored state aborted loading. Every value is now checked on its own; what cannot be read is skipped and the state is kept.
- **The mode the system is armed in could be switched off.** In the dialog "Configure" of the integration and when restoring a backup: the system was disarmed afterwards without any message. Both are now refused, with the note to disarm first.
- **Sensor view over 7 and 30 days froze after the clock change in autumn.** On the day with 25 hours the calculation of the day rows ran forever ("Invalid string length") as long as that day was within the period, so for up to 30 days.
- **Adding or deleting a system got stuck in the panel** while a long task was running in Home Assistant (for example an automation with a delay): the command waited for all tasks of Home Assistant instead of only its own.
- **The message "Entry delay" named the time of the mode,** also when the triggering sensor has its own delay. It now names the time that is really running.
- **Monitoring: the step "Wait" ended its waiting time from a foreign thread.** That is not allowed in Home Assistant and could delay or lose the following steps.
- **Recording of an alarm: writing was postponed again and again during many events.** It is now written at the latest 2 seconds after the first event.

### Security

- **The lock after five wrong codes could be bypassed with simultaneous attempts.** Checking a code takes a moment; attempts arriving during that time were all checked before the counter rose. Codes are now checked strictly one after the other.

## [1.57.0] - 2026-11-17

### Added

- **Test button on every step of a monitoring rule.** Each step card of a rule ("Outside the limits" and "Back to normal") has a play button in first place, like the alarm actions. It runs only this step once, also when the rule is not saved yet: a push message goes out with the title "Test: ..." and the current values of the rule in the placeholders, a device step switches the device. "Wait" has nothing to test and its button is locked. While a test runs the buttons are locked; afterwards a message says "Step tested." or why the test failed (for example a device that does not answer, after at most 10 seconds). A test never triggers the siren or the alarm, and only administrators can run it.

## [1.56.0] - 2026-11-16

Not released; included in 1.57.0.

### Changed

- **Your own sounds open in their own window.** On the Plant page, the chapter "Your own sounds" shows only a summary ("1 own sound") and a button "Show sounds". The list (play, rename, delete) and the upload form are in the window (full screen on the phone), like the routines. With no sound yet, a card with a centred button "Upload sound" invites you to add one, otherwise the button sits in the footer. Changes are still saved at once. On the phone the buttons of a sound stand under its name, so the name has room.
- **The upload form stays inside its card** in a narrow window (the fields no longer reach past the edge).

## [1.55.1] - 2026-11-16

Not released; included in 1.56.0.

### Changed

- **The button "Back up" is now "Create backup".** "Back up" suggested that it saves the settings of the page. The button, the window "Create backup" and the hints now say plainly that a backup copy is created (message: "Backup created.").
- **New icon for "Show backups".** The restore arrow now carries an eye in its centre, so the button reads as "look at the backups" and not as "restore".
- **"Export" and "Import" moved into the footer of the window "Show backups".** They no longer sit on the page next to "Create backup"; the hint on the page says where they are. The hint is shorter and separates your own backups (up to 10) from the automatic ones, which do not count towards that limit. "Create backup" is a plain button now (not blue, with a plus instead of a check mark), so it does not look like "Save". On the phone the three footer buttons (Export, Import, Close) stay in one row.

## [1.55.0] - 2026-11-16

### Changed

- **Routines and the backup list open in their own window.** On the Plant page, routines show only a summary ("3 routines · 3 active") and a button "Show routines"; backups show "Last backup: date, name" and a button "Show backups". The list and the editor of a new routine are in the window (full screen on the phone). The overview of the routines looks as before; a new routine is created in the window; with no routine yet, a card with a centred button invites you to add one, otherwise the button sits in the footer. Changes to routines stay a draft and are saved with "Save" of the page. The buttons for backup settings, "Back up now", "Export" and "Import" stay on the page. The scroll area of the backup list (from seven rows) now lives in the window.
- **Automatic backup is saved with the page.** Switch, number of backups and interval are part of the page draft like every other setting: orange dot, "1 change", "Cancel" discards them, an invalid number blocks "Save". Before, changing the number saved at once.
- **Same buttons for rules and routines.** The rule cards of the monitoring and the routine rows use the round 44 px buttons (edit, copy, delete) in the same order as the actions.
- **Key lines of a monitoring rule larger and bold.** "Triggers" and "Back to normal" stand out in the card.

## [1.54.0] - 2026-11-16

### Added

- **Measured sensors in the panel overview and in the sensor view.** With monitoring switched on, the temperature, humidity and CO2 sensors of the monitoring appear in the overview with their value and unit (instead of a state word). A tap opens the same view as for the other sensors: tab "History" with the course of the values as a clean chart (nice axis in the unit of the sensor, the limits of the rules as dashed lines, the current value as a dot), the key figures (current, average, lowest, highest), the periods 3 hours to 30 days, plus battery, signal and device with the same charts as for the other sensors. Below the chart there are only the events of the monitoring ("Outside the limits", "Back to normal", with value and rule), never the single values. A rule that is running marks the sensor yellow and counts under "Problems". There is a filter "Measurements" in the type selection.
- **Return margin explained with your values.** Below the field the rule editor shows, live while you type: at which values the rule triggers, from which value it is back to normal, the buffer zone in between (the rule keeps its state there) and the current value of the sensor, as bars in the colours of the monitoring. The card of the rule also names the value from which it is back to normal.

### Changed

- **Backups on the phone scroll from seven rows** (ten on the computer); all rows are equally high there.
- **Cursor at the end of the text.** When you tap a field that already has content, the cursor stands after the last character, not before it (text, numbers and text areas in the whole panel).

## [1.53.0] - 2026-11-16

### Changed

- **Routines: only "Disarmed" needs no confirmation.** The "Safety" card ("I understand this") now appears for every routine, above the states. Every state except "Disarmed" (arming, armed, entry delay, alarm) can only be switched on after the confirmation, for disarming and for arming alike, because a routine in these states could otherwise bypass a code (switching from Home to Away, interrupting an entry delay). A new routine starts with just "Disarmed". Turning the confirmation off drops the other states again. The server checks the same rule for new and changed routines. Routines and backups saved before keep working unchanged; the list shows "Confirmation missing" on them until they are saved again, and changing them needs the confirmation. The texts of the card, the states and the error message were adjusted.
- **Monitoring: the rule you edited stays open.** After tapping the pencil and coming back (also after "Cancel"), the card is expanded.

### Added

- **Monitoring: volume for critical notifications.** With "Critical notification" switched on, the push step shows a volume slider (default 100 %), like the alarm notifications.
- **Groundwork for measured sensors in the panel (server).** The sensor view command now also serves the value history of temperature, humidity and CO2 sensors that the monitoring lists, with the events of the monitoring and the limits of the rules; events of the monitoring carry value and unit. The panel uses it from 1.54.0.

## [1.52.1] - 2026-11-16

Not released; included in 1.53.0.

### Changed

- **The tab bar of the actions is no longer tinted; only the icons carry colour.** The track and text stay neutral. The icons of the tabs that can trigger an alarm (Home, Away, Night, Always active) are dark red, the same red as the "Alarm" zone of the flow; the icon of "Monitoring" is orange. Tabs you have not selected are slightly muted; the selected tab gets a fine border in the colour of its group and a full icon. On the phone with five tabs (Night on), "Monitoring" now spans the full width below the others instead of overflowing its cell.

## [1.52.0] - 2026-11-16

### Added

- **Monitoring rules are collapsed by default.** Open the ones you want; "Expand all" / "Collapse all" still opens or closes everything.
- **Filter the log by routine.** In Log › All events there is a new pill "Routines" (everything a routine did or skipped) and, always visible below the pills, a drop-down over the full width to pick one routine by its title; then only the events of that routine show. The drop-down lists all routines with the number of their events.

## [1.51.2] - 2026-11-16

Not released; included in 1.52.0.

### Changed

- **Monitoring rules: the arrow to collapse is at the top right**, away from the switch. The colour of a rule starts at the top left like a sunrise and fades out quickly, so an open rule is only coloured in its upper part.

## [1.51.1] - 2026-11-16

Not released; included in 1.52.0.

### Fixed

- **The tinted tab bar of the actions on the phone.** When the tabs wrap into two columns, only the cell of "Monitoring" is orange and the rest red, instead of an orange gradient running across the other tabs.

## [1.51.0] - 2026-11-16

### Changed

- **The tab bar of the actions is tinted.** The tabs that can trigger an alarm (Home, Away, Night, Always active) sit on a light red track, "Monitoring" on a light orange one, with a soft transition only near the end of "Always active". You see the difference before you choose a tab.

## [1.50.0] - 2026-11-16

Not released; included in 1.51.0.

### Added

- **Monitoring rules can be collapsed and searched.** A round arrow at every rule collapses it to its header (the view only, nothing is saved), "Collapse all / Expand all" does it for all. The search field above filters by the name of the rule and by name and entity ID of the sensors and devices used in it.
- **Preview of the message.** The window of a push step shows the notification as it arrives on the phone, with the placeholders resolved by the current values of the rule's first sensor; it follows every keystroke and shows the default text when yours is empty.
- **A colour for every monitoring rule.** In the rule window, chapter "Appearance": one of ten colours or none; the card of the rule then takes the colour as a soft gradient. Only the look; the colour is part of the backup.
- **The list of backups fits the phone.** There the column "Alarm systems" is dropped and the systems stand under the name.
- **The list of backups is sortable and has its own date column.** Click a column header to sort by backup, date or alarm system; the default is by date, newest first. From ten rows on, the table scrolls on its own and the header stays visible.

## [1.49.0] - 2026-11-16

Not released; included in 1.50.0.

### Added

- **Choose how many automatic backups are kept.** A field next to "Weekly" in Configuration › Alarm system › Backup: 1 to 50, default 5. Your own backups (up to 10) are counted separately.

## [1.48.1] - 2026-11-16

### Added

- **Every rule sits in its own framed card** (header, "Outside the limits" and "Back to normal" together), so it is clear which flows belong together.
- **Placeholders are tappable pills.** Under the title and under the text of a push step each field has its own row of pills ({rule}, {sensor}, {value}, {unit}, {limit}, {since}, {name}); a tap inserts the placeholder at the cursor of that field.

### Changed

- **A rule can only choose measured values from the sensor list** (Configuration › Sensors › Add sensors, filter "Measurements"), not every sensor of Home Assistant.

## [1.48.0] - 2026-11-16

### Added

- **Monitoring: measured values and yes/no sensors, independent of the alarm.** A new area next to Home, Away, Night and Always active, with its own tab under Configuration › Actions › Monitoring. It is switched on under Configuration › Alarm system › Modes (**off by default**). Typical cases: a fridge above 8 °C for 30 minutes, or its door open for 5 minutes. Every rule is a chapter with its flow in the colours of the actions: "Outside the limits" (orange) and "Back to normal" (green). A rule has:
  - a **condition**: measured value above, below or outside limits, device state (door, switch, lock ...), time window, and "alarm system is armed" (in chosen modes), combined with And/Or and groups as in routines;
  - a **duration**: the condition must hold that long before the first flow runs;
  - a **return margin**: a value only counts as normal again this far inside the limit, so a value flapping around the limit does not report again and again;
  - **steps**: push notification (own title and text with `{rule}`, `{sensor}`, `{value}`, `{unit}`, `{limit}`, `{since}`, `{name}`, own recipients, optionally critical), switch device, wait;
  - an optional **reminder** every N hours while it lasts (repeats only the push steps).
- **Measured values in the sensor list.** With monitoring on, "Add sensors" also offers temperature, humidity, CO2 and other measured values (new filter "Measurements"). They stand in the table greyed out: no zone, never always active, no entry delay. The alarm never sees them; the maintenance check (battery, unreachable) covers them. They are part of the backup, like the rules.
- **Safe by design.** A sensor that does not respond never counts: it neither triggers a rule nor ends it, so a radio loss never reports "back to normal". A running rule does not report again after a restart, a reload or when the page is saved. Monitoring runs also while the alarm system is disarmed and never triggers the siren or the alarm; critical events like fire or water stay with "Always active". A device that hangs holds nothing back (each call waits at most 10 seconds), and a failing step never stops the others.

### Changed

- **The titles of the action cards are bold** (same size), so they stand out more.

## [1.47.0] - 2026-11-16

Not released; included in 1.48.0.

### Added

- **Automatic backup.** In Configuration › Alarm system › Backup a switch "Back up automatically" (on by default) and a choice "Daily / Weekly / Monthly" (weekly by default). The integration then stores the configuration of all alarm systems by itself, checked every night at 03:17 and shortly after Home Assistant starts (a missed backup is made up). The last 5 automatic backups are kept, in addition to your 10 own ones; in the list they carry the tag "Automatic". If nothing changed since the last automatic backup, no identical copy is stored, so the five show different states. Like every backup they never contain codes; the setting itself is not part of a backup. A failing automatic backup never disturbs the alarm systems.

### Changed

- **The preview of a routine says it in plain words.** "As soon as this happens" instead of "When the device newly matches", and "Only on a real change: not after a restart and not when a device comes back online".

## [1.46.1] - 2026-11-16

### Fixed

- **The orange dot on the Alarm system tab stayed after saving routines.** The server fills in defaults (for example the modes of "Armed") and orders the values differently, so the saved list no longer looked like the draft. Both sides are now brought into the same form before comparing, so saved routines (also old ones, copied or deleted ones) leave nothing open.
- **The device picker of a routine is no longer far too tall on the phone.** The search field had grown to fill the whole window; it has its normal height again.

### Changed

- **The states in the preview of a routine are tidier.** The pills have the same size and are no longer broken in the middle of a word ("Ausgangsverzö-gerung"); the chosen ones carry a tick. On the phone they stand one below the other and the tile grows downwards, on the computer they fill the row evenly.

## [1.46.0] - 2026-11-16

### Added

- **Armed in chosen modes only.** Under "Armed" the routine has one switch per mode of the alarm system: it then applies only when the alarm system is armed in one of the chosen modes (for example only "Away"). Otherwise it is skipped and the log says so.
- **Duplicate a routine.** A button next to the pencil copies a routine (switched off, with a free name "… (copy)"); the copy counts once you save the page.

### Changed

- **The preview of the flow is calmer and uses the colours of the actions.** Three steps on one line with numbered circles; the cards carry the zone colours of the actions with their gradient (arming light red, disarming dark green). The "No" branch is gone: a note says that in every other state the routine is skipped and the log says so.
- The name of a routine may have up to 45 characters (was 40).

## [1.45.0] - 2026-11-16

### Added

- **Buttons as triggers.** A routine by device can now use a button press: every button of a remote or dimmer (for example a Hue dimmer switch; they are the "event" entities of Home Assistant) with each kind of press (short, long, double ...). In the device picker use the filter "Buttons". A press counts only at the moment it happens, never a restored old one (after reloading an integration the old time comes back and never triggers), and it cannot be combined with "must hold for N seconds".
- **Preview of the flow.** At the end of the routine editor a graphic shows what happens: 1 trigger (with the and/or tree or the times), 2 check (the five alarm states, the chosen ones green), then YES to the action (red with the tag "Bypasses the code" when disarming) and NO to "Skipped, it is in the log". It follows the draft while you edit and is display only.

### Removed

- **The switch "Allow disarming by routine" is gone.** The confirmation "I understand this" in the routine is enough. A routine that disarms now always runs (it was skipped while the switch was off); check your routines that disarm. Stored values and backups of 1.44.0 stay usable.

### Changed

- In the routine editor the trash button of a group sits next to "all (and) / any of them (or)" and the notes below the condition tree have more space.

## [1.44.0] - 2026-11-16

### Added

- **Routines: by time or by device.** In Configuration › Alarm system the chapter "Schedule" becomes "Routines". A routine switches the alarm system (arm Home, Away or Night, or disarm) when its trigger fires. The trigger is a **schedule** (one or more times, each with its own weekdays) or a **device** of Home Assistant, for example a smart lock that locks. Device conditions are "device is state" (lock, switch, light, cover, door or motion sensor, person ...) and "time of day from–to" (also past midnight, with weekdays). They are combined with "all (and)" or "any of them (or)", with one level of groups, as with Magic Push in Device Panel (up to 10 conditions in up to 3 groups), and can be required to hold for N seconds. The device picker searches by name, area and entity ID (the entity ID is never shown) and filters by kind and area.
- **The states in which a routine applies.** Five switches per routine: exit delay, armed, entry delay, during the alarm, disarmed (only the last is on by default). The state of the alarm system at the moment of triggering decides; otherwise the routine is skipped and the log says so ("Routine … skipped: not allowed in this state: …").
- **"Allow disarming by routine"** in Configuration › Alarm system (off by default, like disarming by push action). A routine that disarms bypasses the code: it carries the tag "Bypasses the code", needs the confirmation "I understand this" in the routine, and in an entry delay or alarm it only applies if you choose these states explicitly (with a red warning).

### Changed

- **A routine runs only on a real change.** It runs when its conditions newly come true: not while they stay true, not after a restart of Home Assistant, and not on the return from "unavailable" or "unknown" (a radio outage never switches the alarm system). A routine never runs twice within 10 seconds and never triggers another routine (entities of Alarmageddon are not accepted as triggers). Arming never applies during an entry delay or an alarm.
- **Schedules became routines.** On the first start of this version every schedule is converted into a routine with the trigger "Schedule", the same target and the states exit delay, armed and disarmed (what a schedule did before: never in an entry delay or an alarm). If a schedule disarmed, "Allow disarming by routine" was turned on for that alarm system so it keeps running. Old backups are converted when restored.
- The log names the routine ("Routine: Leaving the house") as the origin of arming and disarming.

## [1.43.5] - 2026-11-15

### Fixed

- **The plus button and its lines in the actions look clean.** The lines are thinner (1.5 px like the ring), all in the blue of the button (the short piece above the closing marker was grey-green), and they meet the ring exactly in the middle at the top and at the bottom: the dashed ring now consists of 12 equal dashes, one of them lies right at the top and right at the bottom, so there is no gap where the line arrives.

## [1.43.4] - 2026-11-15

### Changed

- **The lines to the plus button have the colour of the button.** In the actions the short lines above and below a plus button are no longer coloured like the zone but have the blue of the button, and they meet it exactly in the middle at the top and at the bottom.

## [1.43.3] - 2026-11-15

### Changed

- **Tabs of the sensor window on the tablet and the computer: symbol above label and value.** The four tabs now look like on the phone (symbol on top, centred), with label and value in two lines below, so nothing gets lost where there is room. Only the phone keeps the short form.

## [1.43.2] - 2026-11-15

### Fixed

- **The chosen file is kept when the name of a new sound is taken.** The name is checked before uploading (capitals and extra spaces do not count). If it is taken, the form stays as it is, the file remains chosen ("Chosen: …") and you only change the name. The same holds after any other error of the upload.

### Changed

- **The fixed block "Closing message" is coloured like the actions after acknowledging.** It carries the same light green gradient and connecting line as the steps of its zone.
- **Tabs of the sensor window on the phone: symbol plus short text.** Each tab shows its symbol with a short text below: "History" and "Device" with the word, "Battery" and "Signal" with the value (for example "72 %" and "-58 dBm"). Nothing is cut off any more. On the computer and the tablet nothing changes.

## [1.43.1] - 2026-11-15

### Changed

- **All symbol tiles on the page "Alarm system" are equally big.** The symbols of the modes, of the main code, of the codes per person and of your own sounds (the sound-file symbol) are now the same size (36 px, the symbol inside 20 px), a little bigger than before, and the same on all pages with such tiles (for example the options of a sensor).

### Fixed

- **File choice for your own sounds on the iPhone, second attempt.** The file dialog still offered the photo library and video recording. The list of allowed files now consists of plain endings only (".wav", ".mp3", ".flac") and no longer names "audio/*", which the iPhone also treats as a request for media. M4A and OGG files are not named on purpose (the iPhone treats M4A as video); if the iPhone greys them out, choose "All files" in the file dialog or tell us.
- **The two tabs of the log are equally wide.** "Alarms" and "All events" share the bar exactly, also on the phone, instead of the right one being wider.

## [1.43.0] - 2026-11-15

### Changed

- **MP3, OGG, FLAC and M4A no longer need the program ffmpeg.** Alarmageddon now converts these formats with PyAV, which Home Assistant brings along for the integration "stream" (it contains the FFmpeg libraries). So uploading works on any installation with the default configuration, without installing anything. The conversion runs in a separate process with a fixed format, a time limit and the same limits as before (30 seconds, 8 MB), so a damaged file can at most stop that process, never Home Assistant. If PyAV cannot be used, the program ffmpeg is the fallback as before; only without both, the upload form offers WAV only.

## [1.42.0] - 2026-11-15

### Added

- **Signal strength of Thread devices.** Devices that talk over Thread (Matter) now show their signal strength like Bluetooth devices: a value in the list and the tab "Signal" with the history, nothing about routers or technology. Home Assistant shows this value nowhere; Alarmageddon reads it from the neighbour table of the device (the strongest neighbour counts, for an end device that is its parent), ignores invalid values, and shows no value (but keeps the tab) while Matter cannot reach the device. The history is recorded like the one of Bluetooth devices. Matter devices on Wi-Fi have no such table and stay with their signal sensor. If your Matter server does not provide the table, the signal stays empty as before.

## [1.41.0] - 2026-11-15

### Added

- **Signal strength of Bluetooth and ZHA devices.** Devices that report their signal only inside Home Assistant (Bluetooth devices, ZHA) now show a value and a history, even without a signal sensor. You see just the value (dBm or LQI) in the list and the tab "Signal" with the history, nothing about receivers or technology. With several Bluetooth adapters or proxies the **strongest** receiver counts; the value does not jump back and forth between two almost equally strong ones (the previous receiver stays unless another is more than 2 dB stronger; only receivers that heard the device recently count; invalid values such as 0 dBm are ignored). The value follows the median of the last minutes. The panel records the history itself (every minute for monitored devices that are alive: 5-minute blocks for a day, hours for 31 days), because Home Assistant does not store these values. A device that is not heard right now keeps the tab and shows "–". Devices with a signal sensor work as before.

### Changed

- **"Actions" instead of "steps" for your own sounds.** In Configuration › System › Your own sounds the usage reads "used in 1 action" or "used in 3 actions" (and the same in the question before deleting), with the correct singular and plural instead of "step(s)".

## [1.40.0] - 2026-11-15

### Added

- **Zone colours in the actions.** Each of the six zones has its own colour, so you see at a glance where a step belongs: exit delay light orange, entry delay dark orange, armed light red, alarm dark red, after acknowledging light green, on disarming dark green. The steps run from the zone colour to neutral, the connecting line carries the colour, and a small pill on every step names the zone in words (so it also works without telling colours apart). Light and dark theme, desktop and phone; the pill text keeps a contrast of at least 3:1.
- **A sound-file symbol for your own sounds.** Every sound in Configuration › System › Your own sounds has a small file symbol with a waveform in front. The waveform is derived from the sound, so every sound looks different, and the bars move while the sound plays.

### Changed

- **Play button of your own sounds** (Configuration › System › Your own sounds): while a sound plays, the button is red and pulses, exactly like the stop button of a tested step, and turns normal again when the sound ends or is stopped. The "Test" button at the bottom of the actions page already behaved this way; a test now covers it.

### Fixed

- **File choice for your own sounds on the iPhone.** The file dialog no longer offers the photo library and video recording, only files. The list of allowed endings no longer names ".m4a", ".aac" and ".ogg" (the iPhone treats them as video); "audio/*" still covers all audio files.
- **Clear error messages when uploading a sound.** Instead of "The upload failed" the panel now says what is actually wrong: "This is a picture, not a sound" (also for iPhone photos in HEIC), "a document", "a text file", "The file has no sound track", "could not be read as a sound (damaged, or not a supported audio format)", or, when the request does not arrive, "The file could not be sent" with the hint to check the connection and that the file is on the device and not only in the cloud. If Home Assistant answers unexpectedly, the message names the status code and points to the Home Assistant log, where the cause is now written. A file that cannot be read never ends as a server error.
- **Validation by Home Assistant (hassfest).** The integration declares ffmpeg as an optional dependency (`after_dependencies`); without it the validation of 1.39.0 failed. A new test checks every imported integration against the manifest, so this cannot happen again unnoticed.

## [1.39.0] - 2026-11-15

### Added

- **Your own sounds.** Wherever a sound is chosen (alarm tone, pre-alarm, arming tone, disarming tone) the list ends with "Upload your own sound …": give it a name, choose a file, done. The sound is then in the list of every step and every alarm system; a step only refers to it, copying a step never copies the file. In Configuration › System the new chapter "Your own sounds" lists them with play, rename and delete. Formats: WAV always; MP3, OGG, FLAC and M4A when ffmpeg is available in Home Assistant (otherwise the form says so). Limits: 20 sounds, 8 MB per file, 30 seconds, 12 MB in total. Only administrators upload. The format is detected from the content, never from the ending. Own sounds are part of the backup and come back with a restore.
- **A deleted sound never silences an alarm.** The window asks before deleting a sound that is in use and names the number of steps and the alarm systems. Afterwards these steps play the standard sound of their kind (alarm tone, pre-alarm, arming tone, disarming tone) and show "Own sound deleted (standard sound plays)".

### Changed

- **Preview note.** It now reads "Preview plays on this device, not on the real alarm system." instead of naming phone or computer.
- **Tabs of the sensor window** are always equally wide and fill the whole bar, also with only two tabs and on the phone. Text that does not fit is shortened with "…" instead of being cut off.
- **Title of the window "View"** is slightly larger than the chapter titles below it, not bold. The same goes for the titles of other windows.

## [1.38.0] - 2026-11-15

### Added

- **Copy button for every detail of a device.** In the window of a sensor, the tab "Device" shows a small button behind each detail (manufacturer, model, firmware, integration, area, entity). It copies the whole value, also the long entity name that the row cuts off, and shows a check mark. Where the browser does not allow the clipboard (companion app without HTTPS), a fallback is used.

### Changed

- **The tabs of the sensor window look like all other tabs.** "History", "Battery", "Signal" and "Device" at the top are one connected bar with a sliding capsule under the chosen tab, like everywhere else in the panel, instead of single tiles with a blue frame. Size and the two lines (label above, value below) stay.

## [1.37.0] - 2026-11-15

### Added

- **Reverse a device step after a time.** The step "Switch device" has a new optional setting "Reverse after a time": after the set time (1 second to 1 hour) the opposite is done, for example a socket with a siren: on, off after 2 minutes; also open and close, lock and unlock; "Toggle" toggles again. The card of the step shows it ("Turn off after 2 min"). The time is yours alone, it counts from the call and across a reload or a restart of Home Assistant (after a restart only the rest runs; if the time has passed meanwhile, it switches back at once). Disarming, acknowledging and the end of a test switch back at once, so a socket with a siren never stays on longer than the alarm. The opposite call is bounded like every call (10 seconds), a device that does not answer holds nothing up. Steps without an opposite (set position, set temperature, scene, your own service) do not offer it.

## [1.36.1] - 2026-11-15

### Changed

- **More room for the sensors on a tablet.** On a tablet (an iPad in landscape, with or without the sidebar of Home Assistant; panel narrower than 1200 pixels) the overview now scrolls like on the phone: the header and the cards of the alarm system and the status scroll away, only the search and the filters stay at the top, and the gaps stay the same while scrolling. From about 14 inches (panel 1200 pixels and wider) nothing changes: header, cards and filters stay in place.

## [1.36.0] - 2026-11-15

### Added

- **Duplicate a step.** Every step in the actions has a new button with two squares, between "Edit" and "Delete". It creates an identical copy right below the step, in the same list (during the delays, when arming, in the alarm, after acknowledging, when disarming). The copy is independent of the original. Like every change it is a draft until you save. A list holds at most 40 steps; at that number the button is switched off.

## [1.35.5] - 2026-11-15

### Fixed

- **Volume of a tone: the card and the window disagreed.** If a tone step had its own volume for each media player and all of them were the same (for example 80 %), the card in the list still showed the old common value (75 %) that is no longer visible in the window, and saving kept that old value. The card now shows the value that really plays, and when applying the window the equal values become the common volume. Steps saved before this fix show the right value at once.

## [1.35.4] - 2026-11-15

### Fixed

- **A test of a tone ends when the tone is over.** The stop button of a tested step stayed visible until the time window of a test (60 seconds) was over, even if a short tone had ended long before. A test that only plays tones now ends with the tone, and the panel asks every few seconds, so the button disappears by itself. A test with a device action (a light, a siren switch) still stays until the end of the window, so you can see the effect before everything is put back.

### Changed

- **The stop button of a running test is red and pulses,** on the step and at the bottom ("Stop test"). You see at a glance that something is running and where to stop it. With "reduce motion" set on the device, it does not pulse.

## [1.35.3] - 2026-11-14

### Changed

- **The "View" window is wider on the computer** (680 instead of 420 pixels): the choice "Group by" fits in one row and the columns have room. On the phone the window still fills the screen.

## [1.35.2] - 2026-11-14

### Fixed

- **Testing a tone "as long as the delay runs" plays the whole delay.** The test button of a step such as the arming tone (or the pre-alarm) beeped only for a few seconds, because no delay is running during a test. It now plays as long as the delay that is set for the mode (exit delay for the arming tone, entry delay for the pre-alarm), but at most as long as a test lasts (60 seconds). Stop ends it earlier. If no delay is set for the mode, the duration of the step counts, as before.

## [1.35.1] - 2026-11-14

### Changed

- **A clearer symbol for "View":** the button next to the search field (on the phone only the symbol is shown) is an eye with a cogwheel instead of three columns, so it is clear that it opens the settings of the view. The button also has a name for screen readers and a tooltip.

## [1.35.0] - 2026-11-14

### Changed

- **The panel starts on the overview again after 30 minutes away.** Until now it remembered where you were last (a configuration page, a mode of the actions) for ever. Now that only holds for 30 minutes: if you come back later, you land on the overview, with "Sensors" as the page of the configuration. This holds when you open the panel again and when the panel stayed open in the background (phone). Unsaved changes come first: if you were in the middle of editing, the panel stays there. The chosen alarm system, the view of the list and the log filters are kept as before.

## [1.34.4] - 2026-11-14

### Changed

- **"View" looks like the settings:** the sections of the dialog (Display, Group by, Sort by, Columns, Details on the cards, Names) now have the same bold title with the blue bar as the chapters of the configuration, in the same size, instead of small grey capital letters.

## [1.34.3] - 2026-11-14

### Fixed

- **"Deactivated since 08:26" no longer jumps at a restart of Home Assistant.** The time next to the state ("since …", also in the alarm band: "… at …") came from `last_changed` of the entity, and Home Assistant sets that to the time of the restart. The alarm system now keeps the time of its last change of state itself, stored with its state, and shows it in the panel and on the cards. New attribute `state_since` of the alarm entity. If the state changed during the restart (an entry delay ran out), the time of the restart counts, as it should. Stored states from before this version have no time: they show the one from Home Assistant until the next change.

## [1.34.2] - 2026-11-14

Texts no longer assume that everyone uses Apple Home or Sonos.

### Changed

- **Neutral wording:** the texts of the panel and the README name Apple Home only as an example of a connected system ("also in connected systems, for example Apple Home"), and no longer mention Sonos at all: sounds play on "media players", and players that can save their whole playback (source, title, group) use that. The section "Apple HomeKit" of the README stays, as a how-to for those who use it. Nothing changes in the behaviour.

## [1.34.1] - 2026-11-13

The dashboard cards look right in a dark theme, and the README says what to do when a card does not show up.

### Fixed

- **Dark theme on the cards:** the cards did not know that the dashboard is dark, so the alarm band was drawn in the light style. They now follow the theme of Home Assistant.

### Changed

- **README:** the section "Dashboard cards" lists what to do when the card does not appear in the card picker (restart Home Assistant, reload the page or reset the frontend cache of the app, test with YAML).

## [1.34.0] - 2026-11-13

Two dashboard cards: the control tile and the status tile of the side panel, for any dashboard and any user.

### Added

- **Card "Alarmageddon":** the control tile of the side panel as a dashboard card. It shows the state, the modes to arm, "Ready for" and, during an alarm, the alarm band with "Acknowledge" and "Disarm". It looks like the side panel (light and dark, English and German).
- **Card "Alarmageddon status":** the info tile as a card: alarm, sensors that are not reachable and weak batteries, with the names of the sensors.
- **Adding the cards:** both cards appear in the card picker ("Add card" › "Alarmageddon") and are registered by the integration itself, without a resource entry. The card editor offers the alarm system, a name and which parts are shown.
- **Service `alarmageddon.acknowledge`:** silences a running alarm for any user who can use the card, not only for administrators. Without a running alarm it is refused.
- **Setting "Acknowledging needs the code":** in Configuration › Alarm system (and in the Home Assistant options dialog). Off by default; when on, "Acknowledge" asks for a code. Needs a programmed code; it is reset when the code is removed.
- **Status entity per alarm system** (`sensor.<name>_status`): the number of open problems (alarm, unreachable sensors, weak batteries); the attributes name the sensors. The status card reads it.

### Changed

- **Codes on the card:** when a code is programmed, the card asks for it to disarm (and to arm if arming needs the code), exactly like the entity. The code is never kept in the page after the dialog closes.
- **The side panel stays for administrators only.** The cards can be given to any user; they only use the entities and services of Home Assistant.

## [1.33.1] - 2026-11-13

A full code review of everything built recently: one safety fix in the state machine, a more robust start and stop, and tidying that changes nothing for you.

### Removed

- **Leftovers without a function:** five unused constants and one unused method in the integration; unused style rules, three unused texts, a few unused variables and a click branch that nothing triggered in the panel. Nothing changes for you.

### Fixed

- **A pending timer could fire a second time (safety).** When a second sensor tripped during the entry delay, or smoke, water, gas or "Panic" went off during the entry or the exit delay, the alarm started at once, but the timer of the running delay was not cancelled, and "Disarm" did not find it. So after disarming, the old timer could trigger an alarm on a disarmed alarm system, and at the end of an exit delay an alarm that was already running turned silently into "armed". Every change of state now cancels the pending timer. If you acknowledge an alarm that began in the exit delay (the alarm system was never armed), the tile now also shows since when it is armed.
- **A fault in the statistics could have held up the alarm.** The hourly counters of the sensor view and the "last change" of the list were written before the alarm logic ran; if that failed, the alarm logic did not run. Now it always runs, and the fault is written to the log.
- **A failing extra part no longer takes the alarm system with it.** If loading the statistics, the event log or the alarm recordings, starting the alarm actions or starting the maintenance check fails (for example an unreadable file), the alarm system still starts, listens to its sensors and notifies; the fault is written to the log. When unloading, a failure while saving the event log, the recordings or the actions no longer leaves the alarm system without its entity until Home Assistant restarts.
- **Damaged code entries:** a main code without a salt, or a salt that is not hex text, no longer makes arming and disarming fail with every code. The entry is skipped and the other codes keep working.
- **Delete an alarm system:** the state is checked again after the backup was made. If the alarm system was armed or in an alarm in the meantime, it is not deleted.
- **Placeholders in texts:** `{name}`, `{sensor}` and the others are replaced in one pass. Before, a value that itself contained a placeholder (an alarm system named "House {sensor}") was replaced a second time, in the notification and in the preview of the panel.
- **Two alarm systems starting together** could lose a few hourly counters of the sensor view at startup: the second one worked with statistics that were not loaded yet.
- **Steps of the alarm actions** shared one empty default value for "data" and for the targets; every step now has its own (no known effect, changed as a precaution).
- **CSV export of the log:** cells that begin with a tab or a line break are quoted like cells that begin with a formula sign (recommendation of OWASP).
- **Testing an action:** the play button of an action could stay blocked for up to a minute after another test, even if its sound had long ended, because a test kept the alarm actions "running" until its time window ran out. Now a new test ends the running one and starts (the devices of the old test return), so only one test runs at a time and no play button stays blocked. A real alarm is never replaced: during an alarm nothing can be tested.
- **"Take over actions from …"** did nothing when the actions of the two modes were the same and only a detail inside a step differed (for example the volume of one speaker), or when only "When arming", the delays or "When disarming" differed. The comparison looked at the main list, "Alarm ends" and "After" only, and at the actions, not at the settings inside. Now everything is compared, including all lists and the details of every step.
- **Deleting the last alarm system** shows the empty page at once. Before, the panel waited up to 30 seconds with the loading indicator and the already deleted alarm system, as if it were reloading.
- **The alarm system selection in the header** (with several alarm systems) is no longer redrawn on every refresh, so an open dropdown does not fold shut every 30 seconds.
- **Recipients for alarms and maintenance** are checked like the lists per kind and per step: only valid names of notify services (`notify.` and letters, digits, underscore). Invalid entries drop out; there is no upper limit, so no recipient is ever lost silently.
- **Tests:** new tests for the pending timers (`tests/test_stale_timers.py`), the bookkeeping, the start and the stop, damaged codes, the delete race, the placeholders and the panel; the mutation check has new lines for each of these safeguards.

### Security

- **A typed code never stays in a closed dialog.** The code fields of "Add code" and of the dialog for arming and disarming are emptied as soon as the dialog closes, however it closes. Before, the typed code stayed in the hidden dialog of the page until the next time it opened.

## [1.33.0] - 2026-11-13

Restore a backup onto any alarm system, whatever its name.

### Changed

- **Restoring chooses the target for each alarm system of the backup; the name does not matter any more.** Until now a backup could only be applied to an alarm system with the same name. The settings have nothing to do with the name, so the restore window now shows one card for each alarm system in the backup, with a choice: **apply to an existing alarm system** (any one, also one with another name), **add as a new alarm system** (with a name you can change; it is created without a code and gets the saved settings) or **do not restore**. The proposal stays the old one: the alarm system with the same name, and a new alarm system where there is none. An alarm system you deleted can therefore come back straight from its backup. "Restore" stays blocked while two alarm systems of the backup have the same target, a new name is empty, already used or used twice. A switch decides whether the **shared settings** (presets per sensor type, messages, how names are shown) are restored too; it is on by default as before. Codes are still never part of a backup and stay as they are. The server checks the whole choice before it changes anything.
- **The warning when deleting an alarm system** no longer says that a backup cannot bring it back: with the backup you can restore its settings later, as a new alarm system or onto another one.

## [1.32.0] - 2026-11-13

Delete an alarm system in the panel.

### Added

- **Delete an alarm system.** At the very bottom of Configuration › Alarm system, below the backups, there is a new chapter "Delete alarm system" with a red text button. It opens a warning dialog that says what goes away (the device and all its entities, its sensors, actions, schedules and codes, its log and recordings) and what stays (the other alarm systems, the presets per sensor type, the recipients of the messages, backups), and reminds you that automations, scenes, dashboards and Apple Home that use the alarm entity have to be adjusted by yourself. "Delete for good" is only released once you have typed the exact name of the alarm system. A switch "Make a backup first" is on by default; it uses one of the 10 backup places. A backup does not bring a deleted alarm system back by itself, but if you add an alarm system with the same name and restore the backup, its settings return.
- **Only when disarmed.** An armed alarm system, one in the exit or entry delay and one in an alarm cannot be deleted; the button is blocked and says so, and the server refuses it too (it never disappears silently while it protects the house). Codes are not asked for.
- **New command for administrators:** `delete_system`. Anyone without administrator rights cannot delete an alarm system. It checks the state and the typed name on the server, not only in the panel, and makes the backup only if both are right.

## [1.31.0] - 2026-11-13

Add an alarm system in the panel.

### Added

- **The button "Add alarm system" is back in the header, and it now opens a dialog of its own in the panel** instead of Home Assistant. On the desktop it reads "+ Add alarm system" next to "Open integration in HA"; on the phone it is only a small round plus, the same size and shape as the button to Home Assistant. The dialog has a short explanation, a field for the name and a **preview of the identity**: the name of the device and the entity ID that Home Assistant will give the alarm entity (for example `alarm_control_panel.garage_nord`, with umlauts and taken IDs worked out by the server). An empty name and a name that is already used (capitals do not matter) are refused before you press "Add". Afterwards the panel jumps to the new alarm system, to Configuration › Sensors, so you can choose its sensors right away; unsaved changes on the current alarm system are asked about first. Modes, actions and the code you set up afterwards in the configuration; the code is never entered in this dialog. The empty page without any alarm system uses the same dialog. Adding an alarm system in Home Assistant still works as before.
- **Two new commands for administrators:** `create_system` and `preview_system`. Anyone without administrator rights can neither add an alarm system nor ask for the preview.

## [1.30.0] - 2026-11-13

No more "+ Alarm system" button in the header.

### Removed

- **The button "+ Alarm system" at the top right of the overview on the desktop is gone.** It led to the same place as the button "Open integration in HA" next to it: Home Assistant's page of the integration, where you add an alarm system. The button "Open integration in HA" stays. On the phone the button was already absent. Only without any alarm system does the empty page still offer the button to set one up.

## [1.29.0] - 2026-11-13

All sensor cards are the same height.

### Changed

- **Sensor cards in the overview are always the same height,** in the grid on the desktop and one below the other on the phone, whatever the sensor. Until now a card was as tall as its content: a long name, a mains-powered device without a battery or a missing value made the cards uneven. Now every card has room for **three lines of name**; a longer name is cut with "…" (the full name is in the tooltip and in the options of the sensor). The row with battery, forecast, signal and firmware has a fixed height (two lines from three entries on), and every entry you switch on in "View" (model, integration, last change) is always there, with "–" where there is no value. If you switch entries off in "View", all cards become equally lower.

## [1.28.0] - 2026-11-13

Push messages that name what happened: new placeholders and fitting default texts.

### Added

- **Three new placeholders for your own push text:** `{type}` (the kind of sensor in words, for example "Smoke detector" or "Window"), `{area}` (the room or area of the sensor) and `{alarm}` (the kind of alarm: "Fire alarm", "Water alarm", "Gas alarm", "Heat alarm", "Intrusion alarm", otherwise "Alarm"). They work in the same fields as `{name}`, `{sensor}`, `{time}` and `{mode}`: in the push step of the alarm actions and in the own message of "Alarm ends". The panel shows them as buttons and fills the preview with the first sensor of the mode. For a manual alarm there is no sensor, so `{type}` and `{area}` stay empty and `{alarm}` reads "Alarm".
- **Fitting default text for smoke, water, gas and heat.** Without your own text, a smoke detector now sends "🔥 Fire alarm: …" with "… detected smoke at …", a water sensor "💧 Water alarm", a gas or CO sensor "⚠️ Gas alarm" and a heat detector "🌡️ Heat alarm". Doors, windows and motion detectors keep the default text as before. A text you write always wins.

### Fixed

- **"Alarm ends" now knows the sensor that triggered the alarm.** The placeholder `{sensor}` in the own message of "Alarm ends" was empty when the alarm was ended by disarming or acknowledging, because the alarm system had already forgotten the sensor. The notifier now remembers it for the running alarm (also across a restart of Home Assistant).

## [1.27.0] - 2026-11-12

Actions when disarming, with a disarming tone.

### Added

- **New chapter "When disarming" at the very bottom of the actions page.** Under the fixed point "Alarm system disarmed" there is a list of its own with a plus, like for arming. Whatever you put there **always runs when the alarm system is disarmed**: from an armed system, in the middle of the exit delay or the entry delay, and during an alarm (then after the actions after acknowledging). It is set per mode, for the mode that was armed; "Always active" has none. You can add a disarming tone, a device, a wait, a scene or your own action. Arming again or an alarm ends it at once, and the alarm never waits for it (also a hanging speaker holds up nothing).
- **New kind of tone: the disarming tone,** the counterpart to the arming tone. It is short, has a duration you choose, never runs endlessly and puts the speaker back afterwards (on by default, switchable per step). It has **five sounds of its own** that match the arming tones, but fall instead of rise: "Triad falling", "Closing, two tones", "Deep bell", "Soft, fading" and "Double beep, falling". You can preview each one in the panel.
- **In the backup and "Copy actions from".** The list belongs to the settings that are saved and restored, and it is copied with the other lists.

### Changed

- **Drag and drop knows the new list.** A step moves into "When disarming" like into the other lists, but only what belongs there (device, wait, scene, own action, disarming tone); the disarming tone does not go into other lists.

## [1.26.0] - 2026-11-12

Not released; included in 1.27.0.

Every tone puts the speaker back afterwards.

### Added

- **"Put the speaker back afterwards" for every kind of tone.** Arming tone, pre-alarm and the alarm sound in the lists outside the alarm flow (when arming, during the delays, after acknowledging) remember before they start how the speaker was: on or off, volume, mute, and for Sonos the whole playback with source and group. They play at the chosen volume and afterwards put the speaker back, also switch it off again if it was off. **On by default**, and every step can switch it off (switch in the step). Steps saved before 1.26.0 without the setting also put the speaker back.
- **Also when someone disarms in the middle of the tone**, and for a pre-alarm in the alarm flow, which now also returns with the other devices when disarming.

### Changed

- **A speaker that was off is switched off again** when the alarm sound is put back on disarm (before, it stayed on after the sound).
- **Safe as before.** Remembering and putting back are never an obstacle: if a speaker does not answer, the tone, the flow and the siren go on after the time limits (tests with hanging and failing speakers, and in the mutation check).
- **Actions: no hint box in an empty flow any more.** Under "Alarm starts" the plus is enough; the box "No actions yet. Add a first step…" with its own button is gone and takes no space.
- **Actions: the field under "Alarm ends" is just called "Closing message".** The long description is gone; only if you have not written an own message it says "Standard: "Alarm ended"".
- **Actions: the preview of a tone is one button, like the test buttons.** It starts as a play symbol and turns into a stop symbol while the tone plays; the separate pause button is gone. The yellow frame stays, because it points to the note that the preview plays on this phone or computer, not on the real system.
- **Notifications: the recipient group of a message can be removed first.** On every kind of message (and per mode) you can now remove the last recipient, as with the recipients of alarms at the top. A warning appears. When you save without a recipient, the switch of that message is switched off automatically and its own list goes back to the default, so nothing looks active that is not. Before, the last recipient could not be removed, so you had to add the new one first.
- **Tablet (iPad in landscape): the options of a sensor open as a window and scroll.** Under 1300 px width the sheet no longer lies over the sensor table (the table header covered its title). It opens like on the phone as a window in the middle with its own scrolling and the button "Done". On wide screens the sheet stays next to the table, but is never taller than the visible area: the header stays, the options scroll inside.
- **The tile "Settings per mode" is only as wide as needed**.
- Alarm sounds in the lists outside the alarm flow that were saved before with "undo" off keep that value; switch it on in the step if you want it.

## [1.25.1] - 2026-11-12

Not released; included in 1.27.0.

Same naming for the actions of the push notification.

### Changed

- **Notifications › "Arming not possible": the two buttons are named like the other actions of the push notification.** "Button "Try again"" and "Button "Arm anyway"" are now "Action "Try again"" and "Action "Arm anyway"", and their descriptions start with "Button under the message:", as for "Open", "Acknowledge" and "Disarm".

## [1.25.0] - 2026-11-12

The badge of the easter egg is a solid 3D body.

### Changed

- **Easter egg: the badge is thick, like a real badge.** The shield is built from many layers in depth, so it has a visible thickness when it turns and no longer looks like paper. Front and back have a rounded ridge with a highlight, the side wall is a darker shade of the same colours, and a soft shadow lies on the floor. The light comes from the top left: the brightness of every surface follows the rotation, and a glint runs over the front. The colours stay as they were.

## [1.24.0] - 2026-11-12

Not released; included in 1.25.0.

Dragging steps: the page scrolls along.

### Added

- **The page scrolls along while you drag.** If you hold a step near the upper or lower edge of the visible area (below the fixed tabs, above the bar with "Save"), the page scrolls by itself, faster the closer you are to the edge. So you can also reach a far away list in a long flow. Before, the scrolling at the edge did not work in the panel.
- **A list takes the step also if you only drag it onto one of its actions** or just next to it (up to 48 px), not only onto the plus. An empty list counts with its plus.
- **A list that does not take the step lights up red.** For example the siren over "Entry delay running": nothing is moved, and you see why.

## [1.23.0] - 2026-11-12

Symbols in all selection buttons of the view.

### Changed

- **"View": every selection button has a symbol.** In the window "View" of the sensor list, "List" and "Cards" carry the same symbols as the switch in the toolbar, "Area", "Sensor type", "Alarm system" and "None" (grouping) and "Ascending" and "Descending" each have their own. On wide screens the four grouping buttons now sit in two rows, as on the phone, so that nothing is cut off.

## [1.22.0] - 2026-11-12

Not released; included in 1.23.0.

Move steps between the lists by dragging.

### Added

- **Drag a step into another list.** On the actions page you can now drag a step by its handle onto another list, also onto an empty one (onto its plus or its area). The list lights up with a dashed frame, and when you let go the step jumps there. This works between "Arming begins", "Alarm system armed", "Entry delay running", "Alarm starts" and "After acknowledging", but only into lists that take this kind of step: the siren (alarm tone) does not go into a delay, a pre-alarm not into "Arming begins", a notification only into the alarm flow.
- **The step is converted for the new list.** An arming tone or pre-alarm that you move into a delay follows that delay (switch on, like a new step there); moved out again, it has its fixed duration. After acknowledging nothing is restored any more, as before.
- **Keyboard instead of dragging.** Arrow up on the first step or arrow down on the last step of a list moves it into the next list that takes it; the focus follows.
## [1.21.0] - 2026-11-12

Not released; included in 1.22.0.

The loading animation ignores "Reduce motion".

### Changed

- **Loading animation of the charts: "Reduce motion" no longer applies.** The three circling dots now move even if the system setting "Reduce motion" is on (the user's request). Before, they only pulsed softly in that case.

## [1.20.0] - 2026-11-12

A small surprise in the header.

### Added

- **Easter egg: triple tap on the logo.** Tap the logo at the top left three times in quick succession and it zooms into the middle of the screen and becomes a pop-up: the shield turns around its axis, a beam of light circles like a siren lamp and the "A" pulses. Below it you see the installed version. A tap anywhere or Escape closes it. On the phone it fills the whole screen. The animation also runs if the system setting "Reduce motion" is on (the user's request).

## [1.19.0] - 2026-11-12

Actions during the exit delay and during the entry delay.

### Added

- **Actions while the exit delay runs.** The actions page has a new fixed point "Arming begins" before "Alarm system armed". What you put there starts as soon as someone arms the system, for example an arming tone that tells everyone to leave. When the system is armed the actions end, a running tone falls silent, and the steps of "Alarm system armed" follow. Disarming stops them at once.
- **Actions while the entry delay runs.** A new fixed point "Entry delay running" before "Alarm starts": steps that run while the time to disarm is running, for example a pre-alarm. They end when the alarm begins (the alarm actions take over) or when the system is disarmed.
- **A tone that follows the delay.** For arming tone and pre-alarm in these two lists there is a switch "As long as the exit delay runs" (resp. "entry delay"), on for new steps. The tone then lasts exactly as long as the delay that is running: the value of the mode, or, if the sensor that started it has its own entry delay, its value. It follows the setting of the alarm system; the fixed duration only applies if the switch is off. The card of the step shows a blue pill instead of the seconds.
- **Two chapters.** The page is divided into "When arming" and "On an alarm", the points in the order of time: arming begins, armed, entry delay running, alarm begins, alarm ends. In the tab "Always active" there is neither.
- **Only where the delay exists.** "Arming begins" only shows in a mode whose exit delay is above 0, and "Entry delay running" only where an entry delay can run (an entry sensor in the zone, with a delay above 0). Saved steps are kept.
- **Also in "Copy actions from" and in the backup.**

### Changed

- **The alarm never waits for these actions.** A device that hangs or fails during a delay holds up nothing: the alarm actions start at the moment the alarm begins, the end of the actions of the delay is awaited for 3 seconds at most. A reload or a restart in the middle of a delay continues only the tones for the remaining time; a device is not switched a second time.

## [1.18.1] - 2026-11-12

Test button of a step becomes a stop button.

### Changed

- **Actions: the test of a step is stopped at the step.** When you test a single step, its play button turns into a stop button, and you stop the test right there. The button in the footer stays locked during such a test: it is only for the test of the whole flow, and during that test it is the stop button.

## [1.18.0] - 2026-11-12

"Arming not possible" with buttons: try again, or arm anyway.

### Added

- **Buttons in the message "Arming not possible".** If an open sensor keeps the alarm system from arming, the push notification now carries two buttons. "Try again" arms the same mode once more, for example after you closed the window; if it is still open, the message comes again. "Arm anyway" arms although sensors are open: they are bypassed until you disarm and do not raise an alarm (shown as bypassed like with the option "Bypass when arming"); all other sensors are watched.
- **Safe by design.** The buttons work for one hour and only while the alarm system is disarmed; once it has been armed (by whatever means) an older message is used up. Only the phone of a recipient of this message can press them. The mode is the one that failed, with its exit delay. No code is needed, also if the alarm system asks for one when arming.
- **Each button can be switched off** under Configuration › Notifications › "Arming not possible". Both are on by default.

## [1.17.12] - 2026-11-12

The orange dot goes away after saving, and the modes are switches.

### Changed

- **System: one switch for each mode.** Under Configuration › System the modes Home, Away, Night and "Always active" are no longer pills but rows like the other settings: switch on the left, symbol, name and a short description.

### Fixed

- **System: "1 change" and the orange dot stayed after saving.** Whoever changed the exit delay or the entry delay while a mode was switched off (for example Night) saw "1 change" again right after saving, and saving again did not help. The panel saves the times of all modes, also of a mode that is switched off (it keeps its values), but the server did not report the values of such a mode back; the panel took the saved state for changed. The server now reports the times of all modes. The other tabs save and read back identically (checked with tests).

## [1.17.11] - 2026-11-11

The charts for signal and battery no longer stay empty.

### Fixed

- **Sensor view: "No values in this period yet" although there was a value.** The history of Home Assistant only knows changes. If the signal (or the battery level) did not change in the chosen period, there was only the level at the beginning, a single point, and instead of the chart the note appeared, although current value, mean and weakest value were shown right above it. The line now runs up to now and ends with the current value; a value that stays the same is a level line. If the statistics of Home Assistant deliver fewer than two values, the history is asked as well.

## [1.17.10] - 2026-11-11

Windows open without the search field jumping in.

### Fixed

- **Actions: the search field no longer opens by itself.** When you opened a step, the browser put the cursor into the first field of the window. For "Switch device", alarm sound, pre-alarm and arming tone that is the search for devices or media players: the list of suggestions dropped down and the keyboard came up on the phone, although you only wanted to look at the step. A window now opens calmly; the list appears as soon as you tap into the search field. This also applies to "Add sensors" and to the step "Wait". Windows that are meant to start in their field (rename, code) still do.

## [1.17.9] - 2026-11-11

The log opens with all alarms collapsed.

### Changed

- **Log: the latest alarm is collapsed too.** Until now the newest alarm was always open when you opened the log, and the list began with its long timeline. Now every finished alarm is collapsed and a tap opens it. Two cases stay open by themselves: an alarm that is still running, and the newest alarm after a tap on the alarm notification.

## [1.17.8] - 2026-11-11

Every switch on the left, its text right next to it, in the whole panel.

### Changed

- **Switches stand on the left everywhere.** What 1.17.7 did for the notifications now applies to the whole panel: in the sensor sheet, in the step editor of the actions ("Set volume", "Until the alarm system is disarmed", "Undo", "Wait until the action has finished", the buttons of the push notification), in "Alarm ends", in the defaults, in the window "View" and when renaming, every switch stands on the left and its text right next to it, growing to the right. Until now the switches stood at the right edge, far from their text on a wide screen.
- **Schedule:** the switch of a time stands at the front of its row. On the phone the row is tidier: switch, time and bin on the first line, the action in full width below, then the weekdays; the action is no longer cut off.
- **Step editor:** a row with a switch has more room to what stands above it and to its slider.

## [1.17.7] - 2026-11-11

Notifications: every switch on the left, its text to the right.

### Changed

- **Notifications: the switches stand on the left.** In Configuration › Notifications every switch (the kind of notification itself, "Critical", "Also keep as a notification in Home Assistant") now stands left of its text and the text grows to the right, on the computer and on the phone. Until now they stood at the right edge, far from the text on a wide screen and wrapped to odd places on the phone, so it was not clear which switch belonged to which option.

## [1.17.6] - 2026-11-11

"Settings per mode" no longer jumps back.

### Fixed

- **Actions: "Settings per mode" jumped back to off after 10 to 20 seconds.** If you switched it on and had not changed anything else yet, the panel took the draft for unchanged at its next regular refresh and threw it away; the switch fell back to "off". The switch now stays as you set it until you save, cancel or leave the page.

## [1.17.5] - 2026-11-11

The mode in the titles of the flow.

### Changed

- **Actions: the mode stands behind the fixed points.** With "Settings per mode" switched on, the three fixed points now say which flow you are looking at: "Alarm system armed (Home)", "Alarm starts (Home)" and "Alarm ends (acknowledged) (Home)", and likewise for Away, Night and Always active. So you still see it after scrolling down, where the tabs are out of sight. With the switch off the titles stay as they were.

## [1.17.4] - 2026-11-11

Easier to tap: the buttons of the alarm steps.

### Changed

- **Actions: larger buttons with a frame.** Test, edit and delete of a step are now real buttons with a frame, at least 44 pixels large and with more room between them (on the phone even more), so that they are easy to hit with a finger. Delete is shown in red.

## [1.17.3] - 2026-11-11

More room between the volume sliders of the media players.

### Changed

- **Volume for each media player: more room.** With "Separately for each media player" the sliders now have a clear gap to the switch above them, between each other and between the name of the speaker and its slider. Until now they sat tightly under one another.

## [1.17.2] - 2026-11-11

The tabs of the log without numbers.

### Changed

- **Log: no numbers in the tabs.** "Alarms" and "All events" no longer show the number of entries in the chosen period; the lists show them anyway.

## [1.17.1] - 2026-11-11

Badges at the top of the README; the 1.17.0 changes (not released separately) are included.

### Changed

- **README:** at the top there are now badges with the version, the state of the tests and of the HACS and hassfest checks, the number of downloads and the license.
- **README:** the note "Status: stable (1.0.0)" is removed.

## [1.17.0] - 2026-11-11

Tones play in one piece instead of choppy.

### Changed

- **A tone plays in one piece for its whole duration.** Until now the alarm system restarted the short sound file (1 to 4 seconds) on the speakers again and again. Every restart takes a moment on a media player and cuts off the running tone: it sounded choppy, as if the file were too short. Now the speaker gets one single file of the configured length and is started only once. This applies to all tones: alarm sound, pre-alarm and arming tone.
- **Soft start, soft end.** Every tone is briefly faded in at the start and faded out at the end instead of setting in hard and breaking off.
- **Continuous tones without a seam.** Siren, two-tone and yelp are now calculated so that one repetition joins the next without a jump and without a dip.
- **Very long tones** (more than 3 minutes and "until disarmed") consist of pieces of 3 minutes; the restart in between falls into the faded-out spot.

## [1.16.0] - 2026-11-11

Volume for each media player, and two bugs when saving the actions.

### Added

- **Volume for each media player.** For alarm sound, pre-alarm and arming tone there is, with more than one media player, the switch "Separately for each media player": then each speaker has its own slider, for example quieter in the bedroom. Without the switch one value applies to all as before. The card of the step then shows the range ("30–70 %").

### Fixed

- **Actions: "changes" after saving or testing although nothing was open.** Home Assistant stores a saved flow slightly differently from how the panel sends it (defaults added, fields in a different order). As soon as the panel loaded the data again, for example after saving or after a test, it took the flow for changed: the footer said "3 changes", and "Save" was active again. The panel now compares the content instead of the spelling.
- **The loading indicator kept spinning for up to 25 seconds after saving.** Whoever saved again in that state saved the same thing. Home Assistant then does not reload the alarm system, but the panel waited for that reload. The server now tells the panel whether the alarm system reloads; without a reload there is no loading indicator. This also applies to sensors and system.

## [1.15.0] - 2026-11-11

Three kinds of tones with their own sounds: alarm sound, pre-alarm and arming tone.

### Added

- **Pre-alarm.** A new step type in the flow of the alarm: a quiet warning tone on speakers before the alarm sound sets in. The default is 20 seconds at 30 % volume; the flow waits for it to end, then the next step follows (for example the alarm sound). Disarming stops it at once, and the alarm sound does not set in any more.
- **Own sounds for each kind.** Each kind offers its own tones, all with a preview:
  - **Alarm sound:** siren, alarm beep, klaxon and new two-tone high-low and yelp.
  - **Pre-alarm:** chime, warning (alarm sounds until now) and new slow beep, pulsing tone, rising tone.
  - **Arming tone:** beep, double beep, soft tone (subtle), bell, rising triad (friendly), confirmation (two notes), tick (very subtle).

### Changed

- **Consistent terms: alarm sound, pre-alarm, arming tone.** The step is called "Alarm sound" (until now "Play alarm sound"), and the button of the push notification is called "Silence alarm sound" (until now "Silence siren"): not everybody has a siren, and the button means the sound of the alarm. The setting for it and the entry in the log are named the same.
- **The arming tone plays whole repetitions only.** A tone of 1 second sounds three times in 3 seconds, a melody of 2 seconds once: it is never cut off halfway. Its selection shows only its own tones now.
- **Sounds chosen earlier stay valid.** An alarm sound with chime or warning keeps playing as before and stays selectable in the step as long as it is set.

## [1.14.0] - 2026-11-11

Actions when arming with an arming tone, and more readable texts on the phone.

### Added

- **Actions when arming.** At the very top of the alarm actions there is the new fixed point "Alarm system armed" with a plus. What you put there runs as soon as the system is armed (after the exit delay), per mode like the alarm actions; the tab "Always active" does not have this point. The steps do not run after an acknowledged alarm (the system was armed all along) and not when Home Assistant starts. Disarming stops them at once, an alarm has priority.
- **Arming tone.** A step type of its own next to the alarm sound: a short tone on speakers, by default a beep of 3 seconds; you set tone, volume and duration (up to 5 minutes), with a preview. It never runs "until disarmed" and restores nothing, so that it can be told apart from the siren. Available when arming and after acknowledging; the alarm keeps the alarm sound.

### Changed

- **The fixed points of the flow are larger.** "Alarm system armed", "Alarm starts" and "Alarm ends (acknowledged)" carry a larger symbol and bolder type: armed with a red shield, the alarm in full red, the end in green.
- **Phone: descriptions in a readable size.** Hints and descriptions are consistently larger on the phone (14.5 instead of about 12 pixels).

### Fixed

- **The type got larger when an alarm was opened.** On the iPhone the browser's automatic sizing enlarged single blocks of text as soon as the page got longer: the same hint in the log was small at one time and large at another. The automatic sizing is switched off, the size is always the same now.

## [1.13.3] - 2026-11-11

### Changed

- **The same structure in log and configuration.** At the top is the main choice (Overview, Log, Configuration), right below it, in the same place, the second row with the tabs of that area. In the log these are now "Alarms" and "All events" (until now below period and alarm system); period and alarm system follow below.
- **Symbols on every level.** The second row carries symbols too, on the computer and on the phone, to the left of the text: Sensors, Actions, Notifications, Alarm system, as well as Alarms and All events. On the phone the widths of these tabs follow their content, so that all four fit with their symbol.
- **README:** all screenshots regenerated (tabs with symbols, log with two tabs).

## [1.13.2] - 2026-11-11

### Changed

- **Loading indicator in sensor view and log.** Wherever a chart is loading there is now the same loading indicator as in the whole panel (three circling dots in the colour of the panel), in the middle of the chart area and a little smaller; the text line "Loading history …" is gone. When you change the period, key figures, chart and list stay dimmed until the new data has arrived: nothing jumps. The log shows it on its first load instead of an empty tab.

## [1.13.1] - 2026-11-11

### Changed

- **Main tabs with a symbol on the computer too.** "Overview", "Log" and "Configuration" carry the same symbol on the computer as on the phone, to the left of the text.

## [1.13.0] - 2026-11-11

The log with two tabs, one year of history and deleting single alarms.

### Added

- **Log with two tabs.** "Alarms" (selected) and "All events" are now side by side instead of one below the other, each with the number in the chosen period. Until now the events stood below the alarms and moved further down with every alarm. Period and alarm system apply to both tabs, the filters of the events are on the tab "All events". The tabs are in the fixed part at the top and always within reach while scrolling.
- **Delete an alarm.** An opened alarm has the button "Delete alarm" with a bin at the bottom. The recording is removed only after you confirm; the entries under "All events" stay. A running alarm cannot be deleted.
- **"Show more".** Long lists show 30 alarms or 200 events first and fetch the next ones with a button. Until now the list of events ended with a note pointing to the export.

### Changed

- **Kept for one year.** Alarms and events are now kept for one year and discarded after that. Until now the last 30 alarms and the last 1000 events per alarm system were kept, no matter how old: in a busy household 1000 events lasted only a few months. The number is only an upper limit now, so that the storage does not grow without bound (200 alarms and 5000 events per alarm system).

## [1.12.0] - 2026-11-11

You choose how your sensors are called: "Device - Sensor" or only the name of the sensor.

### Added

- **Sensor names of your choice.** The view of the overview has the switch "Device name before the sensor name". On (standard): the name is put together from device and sensor, separated by a hyphen, for example "Hue Motion Basement - Motion". This makes every sensor unambiguous, even if several are called the same by themselves. Off: only the name of the sensor ("Motion", or the name you gave the entity yourself). Unlike the rest of the view the choice applies wherever a sensor is named (lists, sensor view, log, push notifications) and on all devices; it is part of the backup too.

### Changed

- **A rule instead of a guess.** 1.11.0 used the entity's own name alone if you had given it to the entity yourself, and Home Assistant's display name otherwise. Your switch decides this now. If the name of the device is already part of the name of the sensor, it is not put in front once more; the main entity of a device is called like the device; sensors of older integrations that carry their full name themselves stay unchanged.

## [1.11.0] - 2026-11-11

The alarm in the red of the armed system, a tile that says who armed and what triggered, and a tidier log.

### Added

- **Attributes `armed_at` and `armed_by`** of the alarm system: since when it has been armed and who armed it. They stay during the entry delay and the alarm and after acknowledging (the system was armed all along) and survive a restart; disarming clears them.
- **README:** the strengths come first (no automations needed, push notifications come by themselves, everything is set up graphically), new sections with an image for the sensor view and the alarm, all screenshots regenerated.

### Changed

- **The alarm in the same red as "armed".** The alarm band was a flat area in the error colour and looked pale next to the other reds in dark mode. It now has the same gradient and the same red border as the armed tile. The tile of the alarm system stays red during an alarm (at its strongest); until now it lost its red exactly then. There is a gap between band and tile.
- **During an alarm the tile says what triggered and who armed.** Below "Alarm" it said "since 07:16 · Diego", as if Diego had triggered the alarm. Now it says "since 07:16" with the sensor that triggered, and on a line of its own "Armed away since 06:50 · Diego". The same applies during the entry delay.
- **Log: a running alarm updates every second.** Duration and bar now run up evenly instead of jumping every 5 seconds. Without a running alarm it stays at 5 seconds.
- **Log on the phone: "from" and "to" side by side.** With "Choose period" the selection is on the first line and the two date fields are below it, equally wide (until now one narrow next to the selection, the other wide below).

### Fixed

- **Log: the connection of the steps never runs through a symbol any more.** In the list of an alarm one continuous line ran behind the symbols and showed through their half-transparent area. Each row now draws one piece above and one below its symbol, both ending just before it (as in the alarm actions).
- **Sensor names: sensors you did not rename keep the name of their device.** Since 1.10.2 a sensor you had not named yourself was called only like its entity in the integration, for example every motion sensor "Motion": in the list, in the log and in the alarm notification ("Alarm: Motion") it was no longer clear which one was meant. The entity's own name now stands alone only if you gave it to the entity yourself ("Living room occupancy"); otherwise the name of the device stays in front ("Hue Motion Basement Motion").

## [1.10.2] - 2026-11-11

### Fixed

- **One name for every sensor, everywhere.** Home Assistant builds the display name of an entity from the name of its device and its own name. Whoever renamed the device got a long name such as "Aqara FP400 Presence sensor Living room Living room occupancy" in every list. The panel and all messages (alarm, entry delay, silent alarm, unreachable, battery, arming not possible) now use only the own name of the entity ("Living room occupancy"); the main entity of a device, which has no own name, is called like the device. Entities that carry their full name themselves keep it. The name of the device stays visible as before (sensor view, tile "Device"). One rule for server and panel (`devices.display_name`), so the name is the same in the list, the sheet, the log and the push message.

## [1.10.1] - 2026-11-10

### Fixed

- **The alarm system loads even if the panel cannot be registered.** If registering the side panel failed (for example "Cannot register a resource into frozen router" when the web server is already frozen), the whole alarm system failed to load. The panel is a convenience, the alarm system is not: the failure is now logged as an error and the system runs on, armed and alarming, without the panel.

## [1.10.0] - 2026-11-10

Actions after acknowledging, and steps that keep running by default.

### Added

- **Actions after acknowledging.** Below "Alarm ends (acknowledged)" and its message there is now another plus: steps that run as soon as the alarm is over, whether someone acknowledged it or disarmed the system, for example close the blinds again or switch off the light. They start only after the alarm actions have stopped and the devices have returned ("Undo"), each mode has its own list like the alarm actions, and "Copy actions from" takes them along. Possible are device, sound with a duration, wait, scene and custom action; there is no alarm message, no acknowledging and no "Undo" here, because nothing follows that could take anything back. A new alarm always has priority: it cancels them and starts its own actions at once.

### Changed

- **Steps keep running by default.** Until now a flow waited for each step to end unless "Do not wait" was switched on. This is now the other way round: every step that carries something out (device, sound, scene, custom action) starts the next one right away, so the actions run through one after the other as fast as possible; nobody has to wait for a siren to finish. If the next step should start only when this one is done, switch on "Wait until the action has finished" in the step; it then carries a pill with that text. "Wait" still waits, and a sound "until disarmed" cannot be waited for.
- **Existing flows behave as before.** Steps from earlier versions that waited keep waiting and now show the pill; steps that ran alongside keep doing so and no longer carry a mark. Change it in the step if you want.
- **All connections in the flow look the same.** The dashed blue line after a step that ran alongside is gone, and so is the switch on the card: the pill on the step says whether the flow waits.
- **"Alarm ends (acknowledged)".** The mark at the end of the flow now says what it means; the texts of its message name acknowledging and disarming.
- **Phone: the gap below the tab bar stays while scrolling.** Below the bar with Sensors, Actions, Notifications and System there is always the same gap as above it. Until now the table header moved up against the bar without a gap, as if the two were melting together.

## [1.9.0] - 2026-11-10

A sensor view: tap a sensor on the overview and see what it did, how its battery is doing and how good its signal is.

### Added

- **Sensor view.** A tap on a sensor of the overview (list or cards) opens its own window instead of the device in Home Assistant. It is a pure overview without settings; the button "Open in HA" in the header leads to the sensor in Home Assistant. On the computer the window is as wide as the defaults window, on the phone it fills the screen with an X at the top. The header, the tiles, the period, the key figures and the chart stay in place, only the list of events scrolls.
- **Tiles as tabs:** "History", "Battery", "Signal" and "Device". Each shows its current value; the chosen one decides chart, figures and list. A tile without data is left out (no "Battery" for a mains device).
- **A chart for each kind of sensor,** for 3 hours, 12 hours, 1 day, 7 days or 30 days. Doors and windows: a timeline with the open times, from 7 days on one row per day from 0 to 24 h. Motion: the number of motions per hour as bars, from 7 days on a grid of day and hour that shows habits and outliers. Smoke, water and the like: reachability with outages and triggers. Blue shows when the alarm system was armed, red an event that triggered an alarm.
- **List of events** with time, duration and the state of the alarm system at that moment, grouped by day, including "Unreachable". An event that triggered an alarm carries the mark "Alarm triggered"; a tap on it shows that alarm in the log.
- **Battery:** the level over 30 days, 90 days or a year with the warning threshold, a mark where the battery was replaced, the consumption per day and a forecast. **Signal:** the course with the zones good, medium and weak.
- **Device:** manufacturer, model, firmware, integration and area, and in which modes of which alarm system the sensor is monitored, with a link to its place in the configuration.
- **30 days of history for everyone.** Home Assistant keeps the history of states for 10 days by default. The integration now remembers small hourly values per sensor (number of triggers, time open) for 30 days and discards older ones, so chart and figures always reach back 30 days; after the update the hours before are filled once from the history of Home Assistant. The list of single events reaches as far as that history does, with a note when it is shorter than the chosen period.

### Changed

- **Phone: every window fills the screen.** Settings windows (view, defaults, step editor, add sensors, sensor sheet, codes and the new sensor view) no longer open as a sheet with a gap at the top. The X is always at the top right, and the bar with the buttons (Cancel, Done, Save) is always at the very bottom: it sits outside the scrolling content and does not move, also when you pull past the end. Only the short questions ("Discard?") stay a small sheet from below.
- **Armed is red, on every device and in dark mode.** Until now only the faint gradient of the tile showed it, hardly visible on the phone and in dark mode, while symbol, state and chosen mode were blue. Now the symbol, the state ("Armed away") and the chosen mode are red, the tile has a red frame, and the gradient is stronger in dark mode. Disarmed: "Off" is green. An alarm stands out from "armed" with a filled red symbol. On the phone the switch shows text only when there are four modes (Off, Home, Away, Night): with symbols the labels ran into each other.

## [1.8.0] - 2026-11-10

### Added

- **Overview, tile of the alarm system:** the tile gets a faint gradient from the bottom, like the cards of the sensors: red while the alarm system is armed (darker with the mode: light for Home, medium for Night, dark for Away), green while it is disarmed.

## [1.7.0] - 2026-11-10

One clear rule for sensors that are "Always active" and also in the zone of a mode, both flows of alarm actions side by side, consistent dots for unsaved changes, a flow drawing that can no longer go wrong, and the sensor cards on the overview grouped the way you choose.

### Added

- **Overview, sensors grouped the way you choose:** by area, by sensor type (doors, windows, motion, smoke and water, …), by alarm system or not at all. On the computer the choice sits in the toolbar next to "List / Cards", on the phone in "View"; it is remembered per device and applies to the list and to the cards. In the card view every group has a title with its number of sensors across the full width, so the cards no longer run together.

### Changed

- **"Always active" and a mode at the same time: one switch, clear by default.** For a sensor that is "Always active" and also in the zone of a mode, the sheet of the sensor has the switch "Armed in <mode>: only <mode> counts" (before: "Ignore Always active"). **On (new default):** while the alarm system is armed in that mode, only the settings and the actions of that mode apply to the sensor. **Off:** "Always active" applies as well: the sensor triggers at once and both flows of alarm actions run side by side, the one of the mode and the one of "Always active". When disarmed and in modes whose zone does not contain the sensor, "Always active" applies as before. Before this version the default was the other way round for the rule (the sensor triggered at once also in its mode), and only the actions of the mode ever ran while armed.
- **Which alarm actions run** now follows the sensor: disarmed, or armed in a mode that does not contain the sensor, the actions of "Always active" run (before, an armed alarm system always ran the actions of the mode, also for a smoke detector outside the zone). If "Always active" has no actions of its own, the actions of the armed mode run, so no alarm stays without actions. Without "Settings per mode" in the actions (one flow for everything) the flow never runs twice.
- **Sheet of the sensor:** the frame "These settings apply …" is always shown and says exactly when the settings take effect, for example "disarmed and armed in Home" with the note "Armed in Away, the settings and actions of that mode apply instead". The pills "Alarm modes" are gone from the sheet: which modes a sensor belongs to is set in the table (the boxes and the column "Always active").
- **Orange dot = unsaved, everywhere the same:** on the tab "Configuration", on the sub-tab and now also on the tab of the mode that has unsaved changes (sensors, actions, notifications, alarm system). The dots and the marked rows disappear at once when saving, not only after the alarm system has reloaded. Own values (overrides) are marked blue, never orange; the bar on a changed sensor row is orange.

### Fixed

- **Drawing of the action flow:** the connecting line was partly blue and partly grey, and could lie over a symbol. Every connection now draws its own line in the flow of the page (one piece above and one below the plus) instead of one line behind everything: it always ends at the plus and at the cards, has one colour per connection (dashed blue after a step that runs alongside, also on the piece to "Alarm ends"), and sits on one axis with the symbols at every width and in both designs.
- **Two flows under the same supervision:** the second flow has its own watchdog, its own set durations and its own place for a restart or reload, so a siren in either flow switches off after the time you set.
## [1.6.5] - 2026-11-10

### Changed

- **Dots:** orange dots now always mean "unsaved change" (on the tabs). The dot at a checkbox that marks an "own value" (differs from the default of the sensor type) is blue now, like the dot at the sensor name, and no longer orange.

## [1.6.4] - 2026-11-10

### Fixed

- **Sensor sheet on the phone:** below the bar with "Done", the content of the sheet showed through in a strip at the bottom of the screen (the safe area was counted twice). The bar now ends exactly at the bottom edge.

## [1.6.3] - 2026-11-10

### Fixed

- **Sensor sheet with "Settings per mode":** a sensor that is only "Always active" and in no zone of the chosen tab (for example "Home") showed the settings of that mode, which have no effect for it. The sheet now shows the area "Always active" ("in every state of the alarm system", blue frame) for such a sensor; once it is in the zone of the tab, the sheet shows the mode again.

## [1.6.2] - 2026-11-10

### Changed

- **Sensor options sheet:** the section "Zones" is now "Alarm modes" and shows "Always active" as a pill next to Home, Away and Night, so it is clear in which states a sensor applies (the separate row "Always active" in the list is gone). The switch "Ignore 'Always active'" sits right below, as soon as the sensor is "Always active" and in a zone; in a tab whose mode does not contain the sensor, a note says there is nothing to override.

## [1.6.1] - 2026-11-10

### Fixed

- **Overview:** the gap between the filters and the table header now stays when you scroll the list; before, it closed and rows showed through above the header.

## [1.6.0] - 2026-11-10

### Added

- **Switch "Always active" off:** in Configuration › System, next to the modes, "Always active" is a pill that can be switched off (default on). Off means no sensor is always active: smoke and water detectors then do not raise an alarm unless they are in the zone of an armed mode, and a yellow warning says so. The tab, the column and the option "Always active" disappear from the sensors and the tab from the actions; all values and actions are kept and come back when it is switched on again. Sensors that are only "Always active" are not listed in the overview while it is off. The setting is part of the backup.

### Fixed

- **Saving actions no longer drops the flow of a switched-off mode or of "Always active":** triggers that are not part of the saved message keep their stored flow and their "Alarm ends" settings; an empty flow in the message still deletes it.

## [1.5.0] - 2026-11-10

### Added

- **Recipients per message:** every message in Configuration › Notifications has a dropdown "Add recipient" with the recipients as pills. The recipients chosen at the top (alarms or maintenance) are preselected as the default; adding or removing one overrides them for that message, "Back to the default" undoes it. With "Settings per mode" on, the recipients can differ per mode as well (mode value, then message, then the group at the top). The last recipient cannot be removed, so nothing is left without a recipient. Test messages and the combined maintenance message follow the own recipients; battery and unreachable messages with different recipients go out separately. The values are part of the backup.

## [1.4.0] - 2026-11-10

Not released; included in 1.5.0.

### Added

- **Copy actions from another mode:** in Configuration › Actions, with "Settings per mode" on, the footer offers "Copy actions from …". It replaces all actions of the open tab (steps and "Alarm ends") with those of another mode or "Always active", after a confirmation if the tab has its own actions. Nothing is saved until you press "Save".
- **Switch "Ignore 'Always active'":** for a sensor that is "Always active" and also in the zone of a mode, a switch in the sensor options (per mode with "Settings per mode"; default off) lets only the rule of that mode apply while the alarm system is armed in it. It does nothing in modes whose zone does not contain the sensor, so a smoke detector stays active there.

### Changed

- **"Always active" is always active:** a sensor with this option triggers in every state of the alarm system, armed or disarmed, and at once. Its options (for example "Silent alarm") now always come from the tab "Always active", also while the alarm system is armed. Before, an armed alarm system read them from the tab of the active mode. If the sensor is also in the zone of the armed mode, both rules run and the stronger effect wins (an alarm beats a silent report).

### Fixed

- **Smoke and water detectors were not listened to or shown:** a sensor whose type is "always active" by default (smoke, water, gas) was only listened to when it was in a zone or had an own value "Always active". One that was merely in the list of the configuration did not trigger an alarm and did not appear in the overview. Now every sensor of the system for which "Always active" applies (own value or default of its type) is listened to and listed.
- **Dialog "View":** the field "Sort by" was squeezed thin; it now has the same height and rounding as the selection bars above it.
- **Flow graphic:** after a step that "runs alongside", the dashed line reached into the card above and ran on top of the solid line. It now sits exactly between the card and the plus button, and the solid line no longer shows through.

## [1.3.0] - 2026-11-10

### Added

- **Button "Acknowledge" in the panel:** the red alarm band in the overview has a button "Acknowledge" next to "Disarm". It ends the alarm and keeps the alarm system armed; it is only there while an alarm is running.

### Changed

- **Button "Acknowledge" in the push message is on by default** (it can be switched off per push step). It switches nothing off, so unlike "Disarm" it needs no opt-in; it still works only while the alarm is running and only from the phone of a configured alarm recipient.

## [1.2.0] - 2026-11-10

Not released; included in 1.3.0.

### Added

- **Acknowledge the alarm:** a new action "End alarm (acknowledge)" for the flow and a button "Acknowledge" in the push message. Acknowledging ends the alarm: the running steps stop, the devices return to their previous state ("Alarm ends" runs like when disarming), the log records who acknowledged. The alarm system **stays armed** in its mode, and the next trigger alarms again. The push message "Alarm ended" replaces the alarm message on the phone. Nothing to acknowledge during the entry delay or when armed without an alarm. The button works only while the alarm is running and only from the phone of a configured alarm recipient; the step does nothing in a test. Disarming still ends the alarm too and switches the system off.

## [1.1.0] - 2026-11-10

Not released; included in 1.2.0.

### Added

- **Entry delay per sensor:** every entry sensor can have its own entry delay in the sensor options sheet (0 to 3600 s). Without an own value the entry delay of the system for the current mode applies; the sheet shows where the value comes from and resets it. With "Settings per mode" on, the value can differ per mode. 0 triggers at once. The value is part of the backup. "Apply to all sensors" in the presets keeps it.
- **Own recipients per message:** the push message step and the push message of "Alarm ends" can have their own recipients instead of the alarm recipients from the configuration. The dialog shows the default recipients; a switch replaces them with a list of your own. An empty list means the default again. Push buttons are accepted from every recipient of the alarm, including those chosen in the steps.
- **Emoji in every default title:** 🚨 alarm, ⏳ entry delay, 🔒 armed, 🔓 disarmed, ✅ alarm ended, ⛔ arming not possible, 📡 sensor unreachable, 🔕 silent alarm, ⚠️ maintenance, 🧪 test. A test makes sure every default title starts with an emoji. Own titles stay as you write them.

### Changed

- **Sensor list:** cards and rows of sensors that are open or have detected motion get a faint colour gradient from the bottom, so they stand out at a glance.
- Version 1.0.1 was not released; its changes are included here.

### Fixed

- **Dialog "View":** a click on a switch, a column or the order no longer scrolls the dialog back to the top; it stays where it was.

## [1.0.1] - 2026-11-10

Not released; included in 1.1.0.

Small design corrections for the computer view.

### Changed

- **Header the same in every tab:** the name of the alarm system (a dropdown with several), the pencil and the button "Open integration in HA" are now at the top in the overview and in the log too, not only in the configuration.
- **Sensor options sheet and top right:** with a wide window the sheet of the sensor options ends on the same line as the buttons at the top right (before, it stopped short of the edge).
- **Sensors, mode tab:** the title of the column of the chosen mode (for example "Away") is bold as well.

### Fixed

- **Gap above the sensor table:** the gap between the tile "Settings per mode" and the table is now fixed and no longer disappears while scrolling.
- **Sorting by state** in the sensor list put "calm" and "closed" in no order; equal states now stand together.
- **Arrow of the selection fields** (dropdowns): drawn as an image, so it no longer shows a notch at some zoom levels.

## [1.0.0] - 2026-11-10

First stable release. No new function compared with 0.40.0: the version number and the status in the README change, because the whole integration was reviewed by an external code review (see 0.40.0) and is no longer a pre-release.

### Changed

- **Version 1.0.0, no longer a pre-release.** The README no longer calls Alarmageddon an early pre-release, and the install steps no longer ask for "Pre-release" in HACS. Everything from 0.24.0 to 0.40.0 is included; the sections below list it.

## [0.40.0] - 2026-11-09

Not released; included in 1.0.0.

Hardening after an external code review: race conditions in the state machine, a test that could swallow a real alarm, a stale "Disarm" button, buttons of the alarm notification only for the configured recipients, and the panel now mirrors the server when it shows what blocks arming.

### Added

- **Watchdog for the alarm actions.** The flow of the alarm actions is now supervised as a whole, whatever the reason for a delay: after the alarm triggers, the first step starts within 8 seconds at most (if the start hangs or fails, the watchdog starts the steps itself, without the snapshot of the devices); no step holds up the next one longer than its own limit (an action 12 seconds, a wait its time plus 2 seconds, a sound its duration plus the time the player may take to answer); and if the flow itself stops unexpectedly, it goes on with the next step. Every intervention is written to the Home Assistant log and shown in the timeline of the alarm ("Watchdog: …"). A hanging step is not cancelled (a script may finish) but no longer waited for; disarming ends it.

### Security

- **Buttons of the alarm notification only for configured recipients:** "Disarm" and "Silence siren" are accepted only from a phone whose Home Assistant user belongs to a configured alarm recipient: a `notify.mobile_app_<device>` service chosen directly, or a member of a chosen notify group (platform `group`, also nested). Before, every Companion App registered with Home Assistant could send the event behind the buttons, also the phone of a user who gets no alarm notifications. Home Assistant confirms only the user who registered the phone, not the single device: two phones of the same user cannot be told apart. An ignored attempt is written to the Home Assistant log. Recipients that are not Companion App services cannot use the buttons (they never could send them).

### Changed

- **A sound "until disarmed" always runs alongside.** It never ends by itself; saved as "wait for this step", the steps after it (for example the siren) never started. The flow shows it as "runs alongside" and the switch is fixed; existing flows behave like this without saving again.
- **"Disarm" and "Silence siren" in the alarm notification** work only while the alarm is running. A stale alarm notification left on the phone (the "Alarm ended" message never arrived) can no longer disarm an alarm system that was armed again later.
- **A real alarm during a test of the alarm actions:** the test ends at once and the real flow starts without waiting for anything; the devices return to their state from before the test when you disarm. Before, the flow and, with a push step in the flow, also the alarm notification were skipped while the test (up to 60 s) was running.
- **Notifications, settings per mode:** with the switch on, the kinds that do not depend on the mode ("Arming not possible", "Disarmed") are listed below the mode tabs under "For all modes"; they were not reachable at all while the switch was on. With the switch off nothing changes.
- **Sensor table, mode tab:** the small line under the sensor name shows the options that apply in the chosen mode (as the sheet does), not the values for all modes.

### Fixed

- **The duration you set counts from the first start.** How long a siren or sound runs is set in the alarm actions ("siren on, wait, siren off", or a sound with a duration). If settings were saved in the middle of an alarm (the alarm system reloads) or Home Assistant restarted, the waiting time or the sound started again in full, so a siren could run up to twice as long as set. Now only the rest runs; if the time is already over, the next step follows at once.
- **Nothing holds up the alarm actions any more.** A hanging device or push notification never did (10 seconds at most, a push not at all). Now the same holds for everything else that runs when the alarm triggers: if the event log, the alarm recording, the notification or the notification inside Home Assistant fails, the alarm actions still start and the other parts still run (before, one failing part stopped everything after it, the siren included). If the storage hangs or fails before the first step, the steps start anyway (after 3 seconds at most), and a failure while writing the timeline no longer stops the following steps.
- **Arming while the code is being checked:** the code check runs in a worker thread. If an entry sensor opened in that moment (entry delay running), arming in another mode silently cancelled the entry delay and the alarm system became armed instead of alarming. Arming is now refused ("Disarm first") and the entry delay runs on to the alarm.
- **Several alarm systems loading together at startup** created two copies of the global settings (defaults per sensor type, notifications) on the same file; a changed default could then skip reloading an alarm system. One copy, as for the panel.
- **"Alarm ends" after a restart of Home Assistant in the middle of an alarm** used the message of "always active" instead of the one of the mode the alarm ran in.
- **Overview, "Ready for" and open sensors:** the panel now applies the same rules as the alarm system: "bypass" and the values per mode (switch "Settings per mode") count. Before, a sensor that the alarm system would bypass was shown as blocking.
- **Sensor list on the overview:** sensors set to "always active" only in the tab "Always active" (settings per mode) were missing from the list.
- **Alarm recording:** an alarm that ended without disarming (old alarm duration restored from before 0.25.0) was never closed, and the next alarm was not recorded. Entries of a sensor that keeps failing and returning during the entry delay (including the notifications it causes) now count against the limit per alarm like sensor entries; state changes, steps and the alarm message are always kept.
- **Panel:** a failed arming showed its error in the wrong dialog in rare cases; the request timer of the data query is released; a removed panel stops its timers; the icons for the sensor classes heat, lock and moving; the summary of an alarm sound without volume had a missing space; the CSV export of the log quotes cells that start like a spreadsheet formula.
- **Options dialog of Home Assistant:** entry sensors are checked against the modes that are really switched on (home and away can be switched off in the panel); the entered code is not sent back to the form after an input error.
- **Configuration:** a personal code without a salt or a damaged code entry no longer breaks the code check or the panel.
- **Log tab:** the panel asks every 5 seconds while the tab is open; the server now answers "unchanged" until an event or an alarm entry was added, instead of sending up to 1000 events and 30 alarms per alarm system every time.
- **"Last change" of the sensors** is written to disk within 5 seconds also when sensors change all the time (before, every change postponed the write, so it happened only when Home Assistant stopped).
- **Saving defaults with "Apply to all sensors" and restoring a backup** reload every alarm system once instead of twice; saving unchanged defaults reloads nothing.
- **Code:** the remains of the removed update function (`http_limit.py`), the unused card view of the sensor table and 61 unused texts of the panel are gone; the own values per sensor are looked up once per options state instead of on every sensor event.
- **README:** rewritten and restructured: why to use it, a quick start, a tour with screenshots, the safety mechanisms with a diagram, the limits, and the details in a "Good to know" section that opens on a click. The images are created from the simulator (`tests/panel/readme-shots.mjs`).
- **Tests:** a systematic security test suite (every panel command only for administrators and only for its own alarm system, codes and hashes never leave the server, code lockout, state machine, hostile backups and inputs, paths without login) and a mutation check that removes each safeguard and requires a test to fail; both run on every push.

## [0.39.0] - 2026-11-09

Backups can have a name.

### Added

- **Name for a backup:** "Back up" asks for an optional name (for example "before the rebuild"). The list shows the name with the date below it; without a name it shows the date.

### Fixed

- **Overview on the phone:** search, filter pills and the table header now stand at the very top of the screen while only the rows scroll; the header with logo and tabs and the two tiles scroll away first. Search and "View" share one row, the filter pills sit in one row you can swipe, the selection fields share one row. The title "Sensors 19 of 19" is gone there (the pill "All" shows the count).
- **Overview on the phone:** the switch List/Cards is only in "View" (it needed too much room in the toolbar); on the computer it stays in both places.
- **Log:** the filter pills of the events slide up under the fixed period and stay there while the list scrolls.
- **Alarm actions never hang:** a device that does not answer within 10 seconds (before: 15) no longer holds up the flow; it goes on with the next step, and the timeline of the alarm shows "No answer within 10 s, the flow went on". The hanging call is not cancelled (a script may finish) but is not waited for, and disarming ends it, even if it ignores the cancellation. The Sonos snapshot before the first step delays the alarm by 3 seconds at most. A failing action is shown in the timeline too. Disarming while the flow starts no longer leaves a half-started flow behind. Notifications to the phones also stop waiting after 15 seconds.
- **Alarm flow on the phone:** the dashed line and the line to "Alarm ends" now sit exactly under the centre of the plus buttons (they were 3 px to the right).

## [0.38.0] - 2026-11-09

Backups kept in the integration, with a list.

### Added

- **Back up** (Configuration › Alarm system › Backup): one button stores the current configuration (all alarm systems, defaults, notifications; never codes) in the integration. Below, a table lists the backups with the date and the alarm systems: **restore** (with the same confirmation as an import), **download** a single backup as a file, or **delete** it. Up to 10 backups are kept; adding an eleventh drops the oldest. "Export" and "Import" with a file stay.

## [0.37.0] - 2026-11-09

Not released; included in 0.38.0.

Arming and disarming from the overview shows that the alarm system is working.

### Changed

- **Sensors on the phone:** the same table with the tick boxes as on the computer, compact (icons in the header, name, four boxes, arrow), instead of one card per sensor. The entry delay and "Remove sensor" are in the sheet that the arrow opens.
- **Button "Open integration in HA"** is shown in every tab of Configuration again (next to the name at the top), not only in Alarm system.
- **Overview, arming and disarming:** the button switches at once; then the loader (three spinning dots, as elsewhere) appears over the slightly blurred background until Home Assistant reports the new state (at most 4 seconds). Nothing can be tapped meanwhile, so it is clear that the alarm system is working and not hanging.

## [0.36.0] - 2026-11-09

Not released; included in 0.38.0.

A tidier log, especially on the phone.

### Changed

- **Log filters** are labelled ("Period", "Alarm system") and a line with the dates the chosen period covers (for example "Monday, 9 November 2026") makes clear what the list shows.
- **Download** moved to the fixed bar at the bottom as an unobtrusive download symbol, next to the count of events and alarms.

### Removed

- **Export JSON.** The CSV download stays.

### Fixed

- **Sensors on the phone:** the explanation of the switch "Settings per mode" is shown (the bar with switch and tabs scrolls with the page on the phone; on the computer it stays fixed). Now all four places with this switch (sensors, actions, messages, alarm system) show an explanation that changes with the switch.
- **Actions on the phone:** the explanation of the switch "Settings per mode" is shown again (the bar scrolls with the page instead of staying fixed).
- **Table headers stick on the phone too** (overview and sensors): the top row of a table with the labels, filtering and sorting never scrolls away; on the phone the filters scroll away instead and the tables are compact enough to fit without sideways scrolling. The default columns of the overview on the phone are now state, battery and signal (firmware can be added in "View").
- **Sensor sheet on the phone:** only one X instead of two, and the sheet no longer runs 22 px over the right edge (the bar with "Done" was too wide, which shifted the content to the left).
- **Alarm flow:** more space below the plus buttons too (between the plus and the next action).
- **Phone:** the four tabs of the settings per mode (modes and "Always active") sit in two rows instead of overlapping.
- **Several alarm systems at startup:** when Home Assistant loaded two or more alarm systems at once, one of them failed with "Setup error" ("Overwriting panel alarmageddon") and was missing in the panel. The panel is now registered once, safely.
- **Loading with damaged options:** an alarm system no longer fails to load when an entry of the sensor options is damaged (not a dictionary), in the migration of the old "Open sensor when arming" choice or later. The cause of a failed setup is always logged; if an alarm system shows "Setup error", the full entry in the Home Assistant log helps.

## [0.35.2] - 2026-11-09

### Changed

- **Name of the alarm system** (title or dropdown, pencil, "Open integration in HA") moved to the very top, next to the logo, instead of below the tabs. The name (or the dropdown to switch the alarm system, with the pencil to rename) stays visible in every tab of Configuration, including Notifications. The button "Open integration in HA" is only in the tab Alarm system. On the phone the button shows only the icon.

## [0.35.1] - 2026-11-09

### Changed

- **Actions:** the button "Test" moved to the fixed bar at the bottom, next to "Cancel" and "Save" (icon only on the phone).

### Fixed

- **Actions:** the bar with the switch and the tabs now really stays fixed while scrolling (it scrolled away before); on the phone it is compact, without the explanation.
- **Actions on the phone:** the card "Alarm ends" is no longer squeezed into a narrow column.

## [0.35.0] - 2026-11-09

The name of the alarm system can be changed, with a shortcut to Home Assistant.

### Added

- **Name of the alarm system** large and bold at the top of Configuration (Sensors, Actions, Alarm system), with a pencil to rename it. The name changes everywhere in Home Assistant: config entry, device and the name of all entities. A switch "Create new entity IDs from the new name" also renames the entity IDs that still follow the old name (IDs you named yourself stay); automations that use the old ID must be adjusted. A name already used by another alarm system is refused.
- **Button "Open integration in HA"** next to the name: opens the integration page of this alarm system in Home Assistant.
- **Settings per mode for the actions** (Configuration › Actions): the same switch as for sensors, messages and alarm system. Off (default): one action flow, including "Alarm ends", applies to every alarm, in all modes and for always active sensors. On: tabs of the modes and "Always active", each with its own flow. Alarm systems whose flows already differ start with the switch on. Switching off applies the flow of the first mode to all (undo with "Cancel").
- **Filter pills for the events** in the tab Log (All, Alarms, Armed, Disarmed, Arming failed), with counts.

### Changed

- **Tab bars of the settings per mode** (Sensors, Actions, Notifications › Messages, Alarm system) sit left-aligned below the switch. In Sensors the bar with switch and tabs stays fixed while scrolling.
- **With several alarm systems** the name becomes a dropdown of the same size to switch the alarm system (instead of the small dropdown next to the tabs). Notifications apply to all alarm systems and show no name.

## [0.34.2] - 2026-11-09

Not released; included in 0.35.0.

### Fixed

- **Alarm flow:** the dashed line of a step that runs alongside no longer runs through the plus button; the plus button has a little more space above it.

## [0.34.1] - 2026-11-09

Not released; included in 0.35.0.

The scope of the settings per mode is now obvious.

### Changed

- **Settings per mode:** the switch, the tabs and all settings below them sit in one bordered group (Sensors, Notifications › Messages, Alarm system › Times and behaviour), with a line "Everything below applies to <mode> only".
- **Sensor sheet:** a large banner "These settings apply only to <mode>" (or "…while the alarm system is disarmed" in the tab "Always active") replaces the small heading.

## [0.34.0] - 2026-11-09

A tab "Always active" for the settings per mode, and settings per mode for messages.

### Added

- **Tab "Always active"** with the settings per mode of the sensors (Configuration › Sensors, switch on): it has all sensor options for itself and applies while the alarm system is disarmed. The column "Always active" belongs to this tab; the option "Always active" itself never depends on a mode, so a smoke detector cannot be switched off in one mode.
- **Settings per mode for messages** (Configuration › Notifications › Messages): a switch "Settings per mode"; only when it is on, the tabs of the modes appear (there is no tab "All modes", the first mode is chosen) and every mode gets its own on/off, critical, volume and "keep in Home Assistant" for the messages while armed: silent alarm, **sensor unreachable while armed**, entry delay and armed. With the switch off everything applies to all modes; the own values stay saved. Part of the draft and the backup.

- **Settings per mode for the alarm system** (Configuration › Alarm system › Times and behaviour): a switch "Settings per mode", off by default. Off: one set of exit delay, entry delay and confirmation window for all modes. On: the tabs of the modes appear and every mode has its own values. Alarm systems whose modes already differ start with the switch on. Switching off applies the values of the first mode to all modes. Part of the backup.

### Changed

- **"Sensor unreachable while armed"** moved up to the other messages (before it stood under maintenance), so it can differ per mode. "Sensor unreachable" (for a longer time) stays under maintenance.

## [0.33.0] - 2026-11-09

Settings per mode, simplified: the same table, with the settings of the chosen mode.

### Changed

- **Settings per mode work differently** (Configuration › Sensors): the tabs of the modes only appear when the switch "Settings per mode" is on; there is no tab "All modes" any more, and the first mode is chosen. With the switch on, the table has the **same columns as before** (zones of all modes, "Always active", entry delay), so you always see in which modes a sensor is active. The column of the chosen mode and "Always active" (which then applies to this mode) are highlighted. All other sensor options (may be open, bypass, arm as soon as closed, failure counts as alarm, needs a second sensor, silent alarm) are set in the sheet of the sensor, for the chosen mode. With the switch off everything is as before 0.32.0. On the phone the zone buttons of the cards show the chosen mode with a frame. More space around the switch.
- **The origin text** of an option in a mode reads "Basic value (as before switching on)" and "Own value for {mode}" with "back to the basic value".

## [0.32.0] - 2026-11-09

Sensor settings per mode, and "Bypass" is now a setting per sensor.

### Added

- **Settings per mode** in Configuration › Sensors: a switch "Settings per mode" above the table. Off (default): the settings of a sensor apply to all modes, as before. On: the tabs "All modes", "Home", "Away" and "Night" become selectable, and every mode can have its own values for **all** sensor options (always active, may be open, bypass, arm as soon as closed, failure counts as alarm, needs a second sensor, silent alarm). The tab of a mode shows the table with all options as checkboxes (a dot marks an own value of this mode), the sheet of a sensor shows the values of the chosen mode with their origin ("Own value for Away" / "Same as in All modes") and "back to All modes". Without an own value the value for all modes applies, then the default of the sensor type. Switching off keeps the values (they just do not apply). Part of the draft and the backup.
- **New sensor option "Bypass when arming":** if the sensor is open when arming and may not be open, it is skipped until disarmed, instead of preventing arming. It is also part of the defaults per sensor type.

### Removed

- **The setting "Open sensor when arming"** (block or bypass) of the alarm system, in the panel and in the options dialog of Home Assistant. It is now decided per sensor and, if you want, per mode. Existing alarm systems keep their behaviour: a former "Bypass" is moved once to the option "Bypass" of the sensors (per mode, if the modes differed); the old values disappear.

## [0.31.0] - 2026-11-09

Notifications can stay in Home Assistant, "Report only" is now "Silent alarm", and the scroll position no longer jumps.

Not released; included in 0.32.0.

### Added

- **Keep as a notification in Home Assistant** (Configuration › Notifications): every kind of message, alarm and maintenance, can additionally appear in the bell of Home Assistant. It stays until someone dismisses it, independent of the recipients; the same kind replaces its own entry (the alarm message is replaced by "Alarm ended"). The setting can also differ per mode where messages per mode exist. Part of the backup.

### Changed

- **The sensor option "Report only" is called "Silent alarm"** everywhere (option, hints, list).

### Fixed

- **Adding sensors no longer scrolls to the top:** in the window "Add sensors" the list stays where it is when you tick a sensor, and windows keep their scroll position when they are redrawn.
- **Table header and sheet are no longer cut off at the top:** the fixed parts at the top (tabs, sub-tabs, toolbar) no longer cover the first lines; their spacing is part of the parts themselves, so it is the same while scrolling.

## [0.30.0] - 2026-11-09

Display fixes in the sensor table and the action flow.

### Fixed

- **Sensor table:** on a wide screen the table keeps its width and the checkboxes stay in place when the options of a sensor open (the sheet stands beside it). The delete symbol and the arrow stand on one line, the arrow at the far right.
- **Fixed parts at the top** (tabs, sub-tabs, toolbar, column header) no longer slide over each other when scrolling; they are measured again when their height changes (for example when the logo has loaded).
- **Action flow:** the symbols "Alarm begins" and "Alarm ends" are opaque, so the line no longer shines through.

## [0.29.0] - 2026-11-09

Own message values per mode for everything that happens while the alarm system is armed.

Includes the changes from 0.28.0.

### Added

- **Messages per mode** (Configuration › Notifications › Messages): sub-tabs "All modes", "Home", "Away", "Night". The kinds that only occur while armed (**Silent alarm**, **Entry delay**, **Armed**, **Sensor unreachable while armed**) can have their own values per mode (on/off, critical, volume, own test message). Without an own value the value of "All modes" applies; every kind shows its origin ("Own value for this mode" / "Same as in All modes") with "Reset", and "All modes" points to the modes with own values. Part of the draft and the backup, validated by the server.

## [0.28.0] - 2026-11-09

The update function is removed, "Alarm ends" has an own message, and the sensor table shows "Always active".

Not released; included in 0.29.0.

### Removed

- **The whole update function** (Configuration › Updates, the daily check, the entity of HACS, the message "Update available" under Repairs and in the notification kinds, "Install updates automatically", the release notes in the panel and the settings in the backup). Updates run through HACS as for every integration. Old settings and the old message under Repairs disappear by themselves.

### Added

- **"Alarm ends" element** at the end of every flow (Configuration › Actions, per mode) with an optional **own message** when someone disarms: the same options as the alarm message (title and text with placeholders, preview, critical, volume, tap target; no buttons), in a window like the steps, with a test button. The message replaces the standard message "Alarm ended" (same tag, so it replaces the alarm message on the phone). Part of the backup. Whether devices return after the alarm is decided only by "Undo on disarm / acknowledge" in each step.
- **"Always active" as a checkbox** in the sensor table of Configuration › Sensors (and as a button on the phone cards): shows the effective value; a click sets an own value for this sensor.
- **Filter by sensor type** (dropdown) in the sensor list on the overview.
- **Overview stays in view:** with a tall window the cards of the alarm systems, the filters and the column header stay in place when scrolling.

### Changed

- **Sensor table (Configuration):** the arrow and the delete symbol stand side by side, the arrow at the far right; integration and battery columns are gone to keep it clear.
- **Action flow:** the line no longer runs through the cards and ends at "Alarm ends", which has a coloured icon.
- **Volume slider** is at most half as wide; **scroll bars in windows** have more distance to the edge.
- **Windows:** the column header of the tables is no longer covered by the toolbar.
- **"Sensor reports (no alarm)" is now called "Silent alarm"**, and the chapter "Alarm messages" is called "Messages" (Configuration › Notifications).

## [0.27.0] - 2026-11-09

An "Alarm ends" element at the end of every action flow decides what disarming does.

Includes the changes from 0.24.0, 0.25.0 and 0.26.0.

### Fixed

- **The view no longer jumps to the top** when the screen is redrawn (marking sensors, adding sensors, closing a window): the scroll position is kept within the same view, and a window that closes returns to the position where it was opened.

### Added

- **"Alarm ends" element** at the end of every flow (Configuration › Actions, per mode): the choice "On disarm / acknowledge": **Stop, undo the marked steps** (as before, default), **Stop, undo all steps** (all devices the steps changed return to their state before the alarm, whatever each step says) or **Only stop, undo nothing** (all steps stop and alarm sounds fall silent, switched devices stay). The choice is part of the draft, the backup and the data of the alarm system; the default is not stored.

## [0.26.0] - 2026-11-09

Structured windows with a close button and fixed buttons, fixed header with a sortable list, free choice of columns per device, an "Occupancy" filter, and defaults that can be applied to all sensors.

Not released; included in 0.27.0.

### Added

- **Windows (popups) as in Device Panel:** every window has a round close button (x) at the top right, and the buttons at the bottom (Cancel, Apply, Save …) stay in view while the content scrolls. "Cancel", the x and Escape ask "Discard changes?" when something was entered or changed (action step, sensor selection, defaults, new code).
- **Fixed header:** title bar with tabs, sub-tabs, toolbar and the column header of the sensor tables stay in place when scrolling; only the list scrolls.
- **Sort by column:** a click on a column header of the sensor list sorts by it (a second click reverses the order, an arrow shows the direction); every column is sortable (state, battery, forecast, signal, firmware, model, integration, last change, area, zones). Empty values always stay at the end. The header row is more prominent. The choice also appears in the "View" window as a dropdown.
- **Filter "Occupancy":** motion, occupancy and presence sensors have their own filter; "Open" no longer counts them.
- **Tap a sensor row anywhere** in Configuration › Sensors (also a card on the phone) to open its options; checkboxes, switches and buttons in the row keep their function.
- **"Apply to all sensors"** in the defaults per sensor type: deletes the own values of all sensors, so every sensor follows the defaults (with a warning and the number of affected sensors).
- **Logo** of the integration next to the tabs.
- **"Undo on disarm / acknowledge"** (before "Return to previous state on disarm") with a clear hint on every action where it makes sense (switch device, alarm sound, own action with devices). Not for "Scene or script", whose effects cannot be undone in general.

### Changed

- **Alarm sound:** the new step is "Do not wait" by default, so the next step starts at once; existing steps stay as saved.
- **Dropdowns look the same everywhere** (own arrow with distance to the edge); the choice of the alarm system in the configuration is prominent.
- **Wide screens:** the content is at most 1680 px wide, with white space left and right.
- **Push notification dialog** in chapters with a bar in front of the title (message, delivery, tap target, actions); the design is used in all action dialogs.

## [0.25.0] - 2026-11-09

The sensor list on the overview works like the list in Device Panel (own columns on phone and computer), and the alarm lasts until it is acknowledged.

Not released; included in 0.27.0.

### Added

- **Sensor list as in Device Panel:** the list is the default view, on the computer and on the phone. Columns are chosen and ordered separately for the **computer** and the **phone** (View › "For this computer" / "For the phone"), with their own sorting, direction and grouping, and are stored per user in Home Assistant (and in the browser as a fallback). Columns: state, battery, forecast, signal, firmware, model, integration, last change, area, zones. The phone gets a compact set by default (state, battery, signal, firmware).
- **Card layout is optional** on both devices (switch "List / Cards"); cards show the fields chosen for the device.

### Changed

- **The alarm lasts until it is acknowledged:** the state "Alarm" stays until someone disarms, in every mode and also for always-active sensors. The setting "Alarm duration" is removed from the panel, the options dialog and the alarm systems. How long a siren or an alarm sound plays is set in the step of the actions (alarm sound: "Duration"). Disarming still stops all steps and returns the devices. Old values in the options or in a backup are ignored.
- **The preview of the push notification** now stands directly under the placeholders, before the delivery options.
- **Clearer wording for the push notification buttons** (Configuration › Actions, step "Push notification"): the group is called "Actions of the push notification", each entry says that it is a button under the message and what it does. The hint of the alarm sound no longer mentions the alarm duration.
- **The scope "Always active" is removed** from Configuration › Alarm system › "Settings per mode": it only held the alarm duration. The actions for "always active" stay in Configuration › Actions.

## [0.24.0] - 2026-11-09

Not released; included in 0.27.0.

### Changed

- **All tab and selection bars follow the Device Panel design** (the design rule "selection buttons"): equal-width fields with 2 px gap, 3 px padding and 14 px radius, the bar in 7 % text colour over the card colour, the selected field as a capsule in the page background colour with a thin inner border, the selected tab in the accent colour (weight 500). The capsule slides to the new tab in 0.46 s with a slight overshoot and is a little transparent while it moves.
- **Redrawing does not interrupt the slide:** the panel remembers the last position of each capsule and continues from there, also when the bar is redrawn in the middle of the move (no jump back). Without a selected tab there is no capsule. With "Reduce motion" in the system the capsule stands at the target at once. Every bar has its own key, so two bars never share a position.
- **Phone:** tap area at least 44 px, bars fill the width, from five tabs on four columns in rows (three on narrow phones). Small bars (for example the switch List / Cards) stay as wide as their content.
- **"Open sensor when arming" is a dropdown** (Configuration › Alarm system › Behaviour) instead of two tabs: tabs there looked too much like the navigation and were confusing.

### Fixed

- **"Last change" in the sensor list** no longer jumps to the time of the last restart of Home Assistant. Only a change between open and closed counts; "unavailable" and back (restart, radio dropout) does not. Alarmageddon remembers the time itself and, for sensors without a remembered time, reads the history once (recorder, last 90 days); without a real change in that time the list shows "–".


## [0.23.0] - 2026-11-08

Includes the changes from 0.22.0.

### Added

- **Card layout for the sensor list** (Overview): a switch "List / Cards" next to "View". Cards show one small card per sensor with all information of the chosen columns (state, battery, forecast, signal, firmware, model, integration, last change, zones), as a grid and grouped like the list. On the phone the cards are always used and follow the width.
- **Tap target of the alarm message** (Configuration › Actions, step "Push notification"): by default a tap opens the log with the running alarm (what happened when since it went off, the view refreshes every 5 seconds). Alternatively the overview or an own path in Home Assistant (for example `/lovelace/alarm`). The "Open" button uses the same target.
- **"Waits for the end" / "Runs alongside" on every step** of the action flow: a switch on the card changes it with one tap, and after a step that runs alongside the connection to the next step is dashed, so the flow is visible at a glance.
- **Searchable choices** for "Type" and "Action" of an own action: typing filters the list.
- **Sensors to add** (Configuration › Sensors › "Add sensors"): the same filter pills as the sensor list (All, Doors & windows, Motion, More), and a taller search field.
- The log refreshes every 5 seconds while it is open (before only during a running alarm).

### Changed

- **Filter pills are spaced** (also between the rows when they wrap).
- **The chapter "Alarm message" in Configuration › Notifications is gone** (the settings are in the push step, no further hint is needed).

### Fixed

- **The alarm system was forgotten after adding sensors** ("No alarm system yet", and the panel hung): Home Assistant reloads the alarm system when you save, and the side panel was removed and added again meanwhile. The panel now stays in place; the screen keeps the last data and shows the loading indicator (the same as Device Panel: dimmed content, three turning dots) until the reload is done. The side panel only disappears when the last alarm system is removed.

## [0.22.0] - 2026-11-08

Not released; included in 0.23.0.

### Added

- **Period in the log** (Log tab): "All", "Last 3 hours", "Last 24 hours", "Today", "Yesterday", "Last 7 days", "Last 30 days", "Choose a day …" (jump to a day with the date field) and "Choose a period …" (from, to). With several alarm systems you can also filter by alarm system. The list shows how many events and alarms match. The period is remembered per browser.
- **Export of the log** as CSV (semicolons and BOM, opens correctly in Excel) or JSON. The export contains exactly what the chosen period and alarm system show: the events and the timelines of the alarms (CSV: one row per entry with time, alarm system, type, description, sensor, person and the alarm it belongs to). The list on screen shows the newest 300 events; the export contains all of them.

### Changed

- **The log keeps more:** up to 1000 events and 30 alarms per alarm system (before 50 and 20), so that periods like "Last 30 days" are useful.

## [0.21.0] - 2026-11-08

Not released; included in 0.23.0.

### Added

- **Icon of the integration in notifications:** every notification of Alarmageddon (alarm, sensors, maintenance, update) carries the icon of the integration. Android shows it as the icon of the notification. iOS always shows the icon of the Home Assistant app; that cannot be replaced by an integration. The icon is served by Home Assistant without login (`/alarmageddon_icon.png`).

## [0.20.0] - 2026-11-08

Not released; included in 0.23.0.

### Changed

- **Alarm message only in the push step** (Configuration › Actions, "Push notification"): critical, volume and the buttons "Open", "Silence siren" and "Disarm" are set there, together with title and text, separately for each mode and push step. In Configuration › Notifications the kind "Alarm" and the chapter "Buttons in the message" are gone; a note with a button leads to the actions.
- **Existing alarm systems keep their behaviour:** a push step without its own values uses the earlier global values (critical, volume, buttons) until you change them in the step.
- **A button only works if the message offers it.** This is derived from the configuration, so it also works after a restart of Home Assistant for a message that is still on the phone.
- **The alarm message cannot be switched off any more:** it always goes out (an earlier "off" for the kind "Alarm" no longer counts). Without a push step in the actions a default message goes out (critical, button "Open").

## [0.19.0] - 2026-11-08

Not released; included in 0.23.0.

### Added

- **Own title and text for the alarm notification** (Configuration › Actions, step "Push notification", open with the pencil): the default text is in the fields and can be changed as you like. Placeholders `{name}` (alarm system), `{sensor}` (triggering sensor), `{time}` and `{mode}` are inserted with one tap and filled in when the alarm goes off; a preview shows the message with real names. "Restore default text" brings the default back. An unchanged text is not saved, so it keeps following the language of Home Assistant. Buttons, critical and volume come from Configuration › Notifications as before.

## [0.18.0] - 2026-11-08

Not released; included in 0.23.0.

### Changed

- **Alarm sound: duration instead of repetitions** (Configuration › Actions): "How long it may sound" in seconds (with quick choices 10 s, 30 s, 1 min, 5 min), or "Until the alarm system is disarmed", where the tone repeats without end until someone disarms, silences the siren or the alarm duration ends. When the time is up, the media players are stopped so the tone does not trail off. Existing steps with repetitions keep working (shown as the matching number of seconds, saved as before until you edit them).
- **"Silence siren" always works:** the push button now also stops the media players when all steps of the actions have already ended but a tone may still be playing, and works for a sound without end.

## [0.17.0] - 2026-11-08

Not released; included in 0.23.0.

### Added

- **"Do not wait for this step"** (Configuration › Actions, per step of type switch device, alarm sound, scene or script, own action): the next step starts right away instead of after this one has ended. For a very long alarm sound or a slow device, so the following steps are not held up. Disarming stops steps that run alongside as well. A failing step never stops the others, with or without the option (as before). Steps that run alongside are not resumed after a restart of Home Assistant in the middle of an alarm; the steps after them are.

### Fixed

- **Save bar at the bottom:** on pages with little content (for example an alarm without steps) the bar with "Cancel" and "Save" now sits at the bottom of the window instead of in the middle; the spacing above it is kept.


## [0.16.0] - 2026-11-08

Not released; included in 0.23.0.

### Added

- **Buttons in the alarm message with their own switches** (Configuration › Notifications, chapter "Buttons in the message"): "Open" (on by default), "Disarm" (off by default, as before) and new "Silence siren" (off by default). "Silence siren" stops all steps of the alarm actions and returns the devices to their previous state; the alarm system stays in alarm until someone disarms it. It only works during a real alarm with running actions, and the recent events and the alarm timeline show it.

### Fixed

- **Own action in the action editor** showed the technical names of Home Assistant (`cover.set_cover_position`, field `speed`). Types, actions, descriptions, field names and choices are now shown in your language, fetched from Home Assistant like its own interface; where Home Assistant has no translation, the name is made readable ("Set cover position").
- **Spacing:** the last element of a page no longer sits directly on the bar with "Cancel" and "Save"; hints, warnings and the "Test message" rows have more room.


## [0.15.0] - 2026-11-08

Not released; included in 0.23.0.

### Changed

- **Unreachable sensors in one place** (Configuration › Notifications, chapter "Maintenance messages"): the two entries "Sensor unreachable while armed" and "Sensor unreachable" are now one card "Sensor unreachable" with two cases, each with its own switch, critical, volume and test message: "While the alarm system is armed" (reported at once, goes to the alarm recipients) and "Out for a long time" (after the set time, also while disarmed, goes to the maintenance recipients). Settings and recipients are unchanged.
- **Better explanations:** "Sensor reports (no alarm)" now says that only this message goes out instead of an alarm, at most one per sensor and minute, and where the option "Report only" is set (per sensor).

## [0.14.0] - 2026-11-08

Not released; included in 0.23.0.

### Changed

- **Sensor list is a choice** (Configuration › Sensors): the list no longer shows every sensor Home Assistant knows, which kept sensors in view that have nothing to do with an alarm system. "Add sensors" opens a window with all sensors Alarmageddon recognises (search, grouped by area); you tick the ones that belong to this alarm system and add them. Each alarm system has its own list.
- **Remove from list:** per sensor with the bin button (or in the sensor sheet). Zones, entry delay and own options of that sensor are cleared; it can be added again at any time.
- **Existing alarm systems:** sensors that are already in a zone or have own options stay in the list; all other sensors have to be added once. Nothing changes for alarm, zones or the overview.
- The list is part of the backup.

## [0.13.0] - 2026-11-08

Not released; included in 0.23.0.

### Added

- **Actions and notifications in the alarm timeline:** every started step of the alarm actions (notification, action with devices, alarm sound, wait) and every notification that goes out during the alarm appears in the Log tab in order with the sensors. Steps of a test run are marked "test".

## [0.12.0] - 2026-11-08

Log as its own tab with a graphical timeline for every alarm.

Includes the changes from 0.7.0, 0.8.0, 0.9.0, 0.10.0 and 0.11.0.

### Added

- **Alarm recording:** every alarm is recorded from the first trigger (entry delay or alarm) until it is acknowledged by disarming. The recording holds the state changes and every change of the sensors of the alarm system (responded, calm again, unreachable, also sensors that only report) with the time. It continues after a restart of Home Assistant in the middle of an alarm. Entry delays that end with disarming are recorded too. At most 20 alarms per alarm system and 300 entries per alarm; with a flapping sensor the first entries (the cause) and the end are kept. The recordings are runtime data and not part of the backup.
- **Log tab** on the start page: every alarm as a card with a timeline (one lane per sensor with a bar for the time it responded, lines for entry delay, alarm and acknowledged, time axis) and the order below it with time of day and time since the start. A running alarm updates every 5 seconds; the newest alarm is open, older ones collapsed.

### Changed

- **Recent events** moved from the overview to the Log tab ("All events", up to 100 across all alarm systems).

## [0.11.0] - 2026-11-08

Not released; included in 0.12.0.

### Changed

- **Action editor rebuilt** (Configuration › Actions): the building blocks are "Push notification", "Switch device", "Play alarm sound", "Wait", "Scene or script" and "Own action". No JSON anywhere.
  - **Switch device** reads what the device can do from Home Assistant: you choose devices (search, chosen ones as tags with an x) and then only see fitting actions (turn on/off/toggle, covers open/close, locks lock/unlock) and, when turning on, the settings the device really supports (brightness, colour temperature, cover position, fan speed, temperature and mode of a thermostat), each with a slider or dropdown. Settings left off stay as they are.
  - **Own action** lists every action of Home Assistant with its fields (text, number with slider, selection, entity dropdown, switch). Required fields are marked and checked. Values of fields the editor cannot show are kept.
  - **Play alarm sound:** media players via search field with tags, the tone as a dropdown, play and pause buttons next to it (clearly marked as a preview on this phone or computer, not on the real system), volume and repetitions as a slider and field.
  - Existing steps are shown in the new blocks without changes to the saved data.
- Search fields in the editor keep the focus while typing; the list opens only while the field is in use.

### Added

- **Test button per step:** runs only this step on the real devices, after a confirmation. The test of the whole workflow stays as before.
- **Reorder by dragging:** every step has a handle; drag it up or down (finger or mouse), arrow keys work too. Dragging is part of the draft like every other change.

## [0.10.0] - 2026-11-08

Not released; included in 0.12.0.

### Changed

- **Settings per mode** (Configuration › Alarm system): choose "Home", "Away", "Night" or "Always active" and set the values of that mode: exit delay, entry delay, alarm duration, behaviour for open sensors and the confirmation window for two-sensor confirmation. "Always active" is the alarm of an always-active sensor (smoke, water) while the alarm system is disarmed and has only the alarm duration. Every mode keeps its own values, also when it is switched off.
- **Existing alarm systems keep their behaviour:** as long as a mode has no value of its own, the common value of earlier versions applies to it.
- **The options dialog of Home Assistant** sets common values: a value you change there applies to all modes afterwards; unchanged values leave the per-mode values alone.
- The backup contains the values per mode.

## [0.9.0] - 2026-11-08

Not released; included in 0.12.0.


Notifications rebuilt: every kind of message has its own settings, and a sensor can report instead of triggering.

Includes the changes from 0.7.0 and 0.8.0.

### Added

- **Settings per kind of message** (Configuration › Alerts): every kind (alarm, sensor reports, sensor unreachable while armed, entry delay, arming not possible, armed, disarmed, low battery, sensor unreachable, update available) can be switched on or off, be critical or not, and has its own volume (iOS). Each kind has its own "Send test message" button, which goes out with its saved settings, so you hear how it sounds.
- **Recipients as a dropdown:** pick a notification service from a dropdown; the chosen ones appear as tags with an x. Separate for alarms and for maintenance. A warning shows when a group has no recipient.
- **Report only** (new option per sensor): if this sensor responds while armed, a message is sent (kind "Sensor reports (no alarm)", critical by default) instead of triggering the alarm. For sensors that often respond without a break-in (pet, sunlight) or whose battery runs low. At most one message per sensor and minute; the recent events show it. Never set by default; also works for "always active" sensors if you choose so.

### Changed

- **Messages in chapters:** Recipients, Alarm messages, Maintenance messages, Buttons in the message.
- **Old settings carry over:** the single "critical" and "volume" of earlier versions become the settings of the alarm and of "sensor unreachable while armed"; switched-off kinds stay off. Backups from earlier versions are read the same way.
- Maintenance messages and the update message are critical only if you switch that on for their kind (default: no).

## [0.8.0] - 2026-11-08

Not released; included in 0.12.0.


New look of the settings like in Device Panel, and nothing gets lost when you switch tabs.

Includes the changes from 0.7.0.

### Changed

- **Settings in chapters:** every chapter has a title with a bar in front (Configuration › Alarm system: Modes, Times, Behaviour, Schedule, Codes per person, Backup; Updates: Version, Settings).
- **Tabs slide:** switching between the tabs of the configuration slides the page in from the side.
- **Nothing gets lost when switching tabs:** each tab keeps its unsaved changes, also when you go to the overview and back. A yellow dot on the tab shows where something is still open; "Cancel" and "Save" stay in each tab. A question only comes where a draft would really be replaced (another alarm system) and when the page is reloaded or closed.

## [0.7.0] - 2026-11-08

Not released; included in 0.12.0.


Updates from the panel, like in Device Panel.

### Added

- **Configuration › Updates:** shows the installed and the latest version (GitHub and HACS), the release notes of all versions in between (in your language, from the changelog) and "Update", which installs the new version through HACS. Home Assistant is never restarted by itself: "Restart now" appears when the new version is on disk, with a confirmation. A dot on the tab shows that something is waiting.
- **Daily check:** asks GitHub once a day (first check at a random time after the start) and reports a new version under Repairs. Can be switched off.
- **Notification "Update available"** to the maintenance recipients, once per version, switchable under Notifications.
- **Install updates automatically:** off by default. Downloads the new version through HACS after the daily check; the restart stays with you. Only the HACS entity of this repository is ever used.
- **Pre-releases:** offered on request (default: yes as long as a pre-release is installed). HACS installs them only with its own "Pre-release" switch; the panel explains this and links to the HACS device.
- The update settings are part of the backup.

## [0.6.0] - 2026-11-08

Schedule for arming and disarming, and the modes of an alarm system are now chosen in the panel.

Includes the changes from 0.3.0, 0.4.0 and 0.5.0.

### Added

- **Schedule:** per alarm system any number of times in Configuration › Alarm system: arm "Home", "Away" or "Night", or disarm, at a set time on chosen weekdays, each time switchable on and off. A running alarm or entry delay is never disarmed or overridden by the schedule (recorded in the recent events). Open sensors block arming as usual and the notification "arming not possible" follows. No code is needed. "Changed by" shows "Schedule". Times missed while Home Assistant was off are not made up.

### Changed

- **Modes freely selectable:** "Home", "Away" and "Night" can each be switched on and off per alarm system in Configuration › Alarm system (before only "Night", and only when setting up or in the options). At least one mode; Apple Home and the overview offer only the modes switched on. A mode switched off keeps its zone and actions. The mode the alarm system is armed in cannot be switched off.

## [0.5.0] - 2026-11-08

Not released; included in 0.6.0.

Maintenance notifications and battery forecast, two-sensor confirmation against false alarms, codes per person and a backup of all settings.


### Added

- **Maintenance notifications:** low battery and sensors that stay unreachable go to the maintenance recipients, for all alarm systems. Each problem is reported once, several at a time in one notification; again only after the battery was replaced or the sensor responded again. Threshold (default 20 %) and time until "unreachable" (default 60 minutes) in Configuration › Notifications. Checked every 15 minutes.
- **Battery forecast:** the sensor list shows when a battery will be low, calculated from the history since the last battery change (recorder, last 90 days). Without enough history no forecast is shown.
- **Two-sensor confirmation:** new option per sensor "Needs a second sensor". While armed such a sensor triggers only if another sensor with this option responds within the confirmation window (default 60 seconds, Configuration › Alarm system). Against false alarms from pets or sunlight. Off by default; sensors without this option still trigger alone, and during the entry delay it does not apply. An unconfirmed trigger appears in the recent events.
- **Codes per person:** any number of personal codes per alarm system in Configuration › Alarm system, optionally linked to a Home Assistant user. "Changed by", the recent events and the notifications show the person. Two persons cannot have the same code. Codes are stored only as a hash and never shown; the main code from the options keeps working.
- **Backup:** export all settings as a file (zones, delays, options per sensor, actions, defaults, notifications) and restore them, with a preview of which alarm systems are found (matched by name). Codes are never part of a backup.

### Changed

- **Low battery threshold** comes from the notifications setting and applies equally to the list, the status tile and the maintenance notification.

### Fixed

- **Recent events:** "arming not possible" was shown as "disarmed".
- **Phone:** the choice "Open sensor when arming" was cut off.

## [0.4.0] - 2026-11-08

Not released; included in 0.6.0.

Alarm actions as a graphical workflow per alarm, own alarm sounds for media players and notifications with critical push messages.


### Added

- **Configuration › Actions:** one workflow per alarm system and alarm ("Home", "Away", "Night" and "always active" for smoke, water, gas). Building blocks: push notification, turn on, turn off, open and close covers, alarm sound on media players, wait, script and any Home Assistant action with own data. Steps can be added at any position, edited, moved and deleted; changes are a draft with "Cancel" and "Save". A workflow with its own push step replaces the automatic alarm notification, so it is not sent twice.
- **Alarm sounds:** five sounds of our own (siren, alarm beep, klaxon, warning, chime) for media players such as Sonos, with preview in the panel, volume and repetitions. The sounds are served by Home Assistant itself; the media player must reach the local URL of Home Assistant.
- **Back to the previous state:** before the first step Alarmageddon saves the state of all devices in the workflow (on/off, brightness, position, volume, source; for Sonos additionally the Sonos snapshot including groups). Disarming or the end of the alarm duration stops all steps and returns marked devices to that state. For alarm sounds this is on by default. This also works after a restart of Home Assistant in the middle of an alarm.
- **Test:** runs the workflow without alarm and stops by itself after 60 seconds at the latest, or with "Stop test". A real alarm cannot be stopped from the workflow, only by disarming.
- **Configuration › Notifications (for all alarm systems):** recipients separately for alarms and maintenance notifications (every `notify` service, for example the companion app), critical alarm notification with volume (iOS: critical, Android: alarm channel), events (alarm, entry delay, armed, disarmed, arming not possible, sensor unreachable while armed) and test notifications.
- **Alarm notification:** with time and triggering sensor, button "Open"; "Alarm ended" replaces the alarm notification on the phone after disarming. A sensor that becomes unreachable while armed is reported as critical.
- **"Disarm" button in the alarm notification:** off by default. iOS asks for Face ID or the passcode, Android does not; the panel warns about this.

## [0.3.0] - 2026-11-08

Not released; included in 0.6.0.

New start page with a sensor list like Device Panel, a configuration area with options per sensor and "ready to arm".

### Added

- **Options per sensor:** "always active" (smoke, water, gas trigger even when disarmed), "may be open when arming" (for example a motion sensor on the way to the door), "arm as soon as closed" (closing the front door ends the exit delay after a few seconds), "failure counts as alarm" (unreachable while armed triggers). Without an own value the default of the sensor type applies.
- **Defaults per sensor type:** door, window, motion, smoke/water/gas, glass break/vibration/tamper and other, for all alarm systems. Proposal: doors "arm as soon as closed", motion "may be open when arming", smoke/water/gas "always active", glass break/vibration/tamper "failure counts as alarm".
- **Ready to arm:** one entity per mode (for example "Ready to arm away") with the blocking sensors as attribute; the overview shows "Ready for" per mode.
- **Start page:** at the top the control of all alarm systems and a status tile ("All good" or warnings such as low battery and unreachable sensors; a tap filters the list). Below a list of all assigned sensors with search, filters (problems, open, low battery, unreachable, alarm system, area) and a view setting (columns, grouping, sorting, remembered per browser). Columns: area, zones, state, battery, signal (dBm or LQI), firmware, manufacturer/model, integration, last change.
- **Configuration › Sensors:** the grid of zones as before, with a side sheet per sensor (zones, entry delay, options with origin "default" or "own value" and reset), on the phone as a sheet from the bottom. Button "Defaults" for the defaults per sensor type.
- **Configuration › Alarm system:** night mode, exit delay per mode, entry delay, alarm duration and the behaviour for open sensors, directly in the panel.
- **Sensor failure while armed** is recorded in the recent events.

### Changed

- **Panel tabs:** "Overview" and "Configuration" (before "Overview" and "Sensor groups").

## [0.2.0] - 2026-11-08

Side panel with an overview of all alarm systems and graphical sensor groups.

Includes the changes from 0.1.0.

### Added

- **Side panel "Alarmageddon":** added automatically with the first alarm system, removed with the last one. Only for administrators. Works on a desktop monitor and in the companion app on the phone.
- **Overview:** one card per alarm system with state, mode switch (Off, Home, Away, Night), open sensors, unreachable sensors and low batteries (below 20 %). A countdown shows the remaining exit or entry delay. During an alarm a red band with "Disarm" stands at the top. The panel asks for the code only when needed (a default code in Home Assistant works without input).
- **Recent events:** who armed or disarmed which alarm system and which sensor triggered, stored per alarm system (last 50).
- **Sensor groups:** a table with one column per zone and a switch for the entry delay. Drag across several boxes to set them all at once, "All" sets a whole column, with search and filters (doors & windows, motion, other). Sensors are grouped by area, with integration and battery. On the phone: one card per sensor with zone buttons. Changes are a draft with "Cancel" and "Save"; leaving with unsaved changes asks first.
- **Sensors of any integration:** the panel offers all binary sensors of a fitting device class (door, window, motion, smoke, water, glass break and more). The battery comes from the battery sensor of the same device.
- **Glass break:** binary sensors with the new device class "glass break" (Home Assistant 2026.10) are offered as well.

## [0.1.0] - 2026-11-08

Not released; included in 0.2.0.

First pre-release: the alarm core with Apple HomeKit support. The graphical setup in the side panel follows in a later version.

### Added

- **Alarm system as entity:** an `alarm_control_panel` with the modes "Home" and "Away", optionally "Night" (off by default), exit delay per mode, entry delay for chosen sensors (for example the front door) and alarm duration (0 = until disarmed).
- **Several alarm systems:** one entry per alarm system, each with its own device. Names must be unique.
- **Apple HomeKit:** works with the HomeKit Bridge of Home Assistant. Apple Home offers "Home", "Away", "Off" and, with night mode on, "Night". Tested with the real HomeKit Bridge.
- **Zones:** one entity per zone, on as soon as a sensor of the zone is open.
- **Open sensor when arming:** block arming or bypass the open sensors until disarmed.
- **Code:** optional, 4 to 8 digits, stored only as a hash, optionally also required to arm. Locked for one minute after five wrong codes. The default code from the entity settings of Home Assistant is supported.
- **Restart:** state, delays and alarm continue after a restart or when the options change. An entry delay that ran out during the restart becomes an alarm. A sensor that comes back from "unavailable" as open does not trigger.
- **Languages:** English and German.

[1.74.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.74.1
[1.74.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.74.0
[1.71.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.71.0
[1.70.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.70.0
[1.69.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.69.0
[1.68.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.68.0
[1.67.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.67.0
[1.66.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.66.1
[1.66.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.66.0
[1.65.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.65.0
[1.63.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.63.0
[1.62.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.62.0
[1.61.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.61.0
[1.60.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.60.0
[1.59.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.59.0
[1.57.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.57.0
[1.55.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.55.0
[1.54.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.54.0
[1.53.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.53.0
[1.52.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.52.0
[1.51.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.51.0
[1.48.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.48.1
[1.48.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.48.0
[1.46.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.46.1
[1.46.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.46.0
[1.45.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.45.0
[1.44.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.44.0
[1.43.5]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.43.5
[1.43.4]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.43.4
[1.43.3]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.43.3
[1.43.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.43.2
[1.43.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.43.1
[1.43.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.43.0
[1.42.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.42.0
[1.41.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.41.0
[1.40.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.40.0
[1.39.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.39.0
[1.38.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.38.0
[1.37.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.37.0
[1.36.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.36.1
[1.36.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.36.0
[1.35.5]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.35.5
[1.35.4]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.35.4
[1.35.3]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.35.3
[1.35.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.35.2
[1.35.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.35.1
[1.35.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.35.0
[1.34.4]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.34.4
[1.34.3]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.34.3
[1.34.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.34.2
[1.34.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.34.1
[1.34.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.34.0
[1.33.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.33.1
[1.33.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.33.0
[1.32.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.32.0
[1.31.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.31.0
[1.30.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.30.0
[1.29.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.29.0
[1.28.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.28.0
[1.27.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.27.0
[1.25.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.25.0
[1.23.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.23.0
[1.20.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.20.0
[1.19.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.19.0
[1.18.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.18.1
[1.18.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.18.0
[1.17.12]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.12
[1.17.11]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.11
[1.17.10]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.10
[1.17.9]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.9
[1.17.8]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.8
[1.17.7]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.7
[1.17.6]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.6
[1.17.5]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.5
[1.17.4]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.4
[1.17.3]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.3
[1.17.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.2
[1.17.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.1
[1.17.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.17.0
[1.16.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.16.0
[1.15.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.15.0
[1.14.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.14.0
[1.13.3]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.13.3
[1.13.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.13.2
[1.13.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.13.1
[1.13.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.13.0
[1.12.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.12.0
[1.11.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.11.0
[1.10.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.10.2
[1.10.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.10.1
[1.10.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.10.0
[1.9.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.9.0
[1.8.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.8.0
[1.7.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.7.0
[1.6.5]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.6.5
[1.6.4]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.6.4
[1.6.3]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.6.3
[1.6.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.6.2
[1.6.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.6.1
[1.6.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.6.0
[1.5.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.5.0
[1.3.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.3.0
[1.0.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v1.0.0
[0.39.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.39.0
[0.38.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.38.0
[0.35.2]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.35.2
[0.35.1]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.35.1
[0.35.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.35.0
[0.34.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.34.0
[0.33.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.33.0
[0.32.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.32.0
[0.30.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.30.0
[0.29.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.29.0
[0.27.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.27.0
[0.23.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.23.0
[0.12.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.12.0
[0.6.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.6.0
[0.2.0]: https://github.com/Diegofuego871/ha-alarmageddon/releases/tag/v0.2.0
