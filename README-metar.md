# METAR LookUp pop-out

The Safety → Pre / Post-Flight METAR link opens `/metar` in a reusable, resizable window. KPLU (Thun Field) is the default. The page also works directly in a browser tab, including when pop-outs are blocked.

The layout and decoder use the existing METAR LookUp spreadsheet's bound script (project `17pdtl6QX1o0E4RWKsPmpVKSAUD4aS_lf2jkLY8b5i6vkP5dvxHE2Lyi2`) and Sheet2 color legend. The ten categories are Station ID, Observation Time, Modifier, Wind, Visibility, Weather, Sky Condition, Temperature and Dew Point, Altimeter Setting, and Remarks. Only the abbreviation glossary and category structure are ported; original script credentials and shared spreadsheet state are not shipped to the browser.

`api/metar.mjs` gets one station's most recent report from the public Aviation Weather Center JSON API. It validates a four-character station ID, uses a fixed upstream host with a bounded timeout, checks the returned station, and gives clear missing-data/source-error responses. Successful reads have a one-minute shared cache. This makes lookup independent for each student and does not change the sheet's station selector or background script.

`js/metar-decoder.mjs` is shared by the API and browser. It preserves raw report groups alongside plain-language meanings, retains unsupported groups explicitly, and handles compound weather, fractional visibility, cloud layers, SI wind/gust units, signed temperatures, pressure remarks and month/year rollover. Source observation timestamps are shown in Pacific time and UTC; older reports are identified. This is a weather report reader, not a flight-clearance decision engine.

The official AWC observations map is embedded directly in an iframe, with a normal full-map link for browsers/networks that cannot embed it. Students can click map stations, use the map search, enter the chosen station ID in the NEST lookup, or paste a report copied from the map for decoding. Map clicks do not automatically change the NEST station field. AWC's frame is isolated from the pre-flight form.

**Copy METAR** works in standalone mode. When launched by Safety, **Use in pre-flight form** sends the report back to the current pre-flight weather answer without submitting the form. The receiving page verifies the exact window, origin and per-opening channel. The form's other answers stay in place. Signing out invalidates the return channel. The separate METAR-condition Yes/No question remains for the student to answer.

Official references: [AWC Data API](https://aviationweather.gov/data/api/) and [AWC GFA help](https://aviationweather.gov/gfa/help/).

Checks: `node --test tests/metar.test.mjs tests/safety.test.mjs`.

The Safety form also embeds METAR and the new `/notams` FAA search wrapper inline in its weather step. Both tools support separate pop-out windows. Same-origin parent/opener messages are accepted only from the specific iframe/window and a random per-opening channel. FAA contents remain in the official FAA iframe; students record the relevant findings for transfer to their form.
