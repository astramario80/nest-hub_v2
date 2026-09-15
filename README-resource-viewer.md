# Embedded resources

External HTTPS menu links open in a shared NEST dialog. Internal routes, downloads, mail links and modifier-clicks keep their normal behavior. Dialog close/Escape restores focus and removes the embedded page. Refresh content reloads the original source. No content is copied to NEST storage and no sharing permissions are changed.

Provider adapters: Padlet board embeds, Google Docs preview, Google Forms embedded mode, Google Slides embed, Sheets preview, Drive folders/files and YouTube. Other HTTPS pages are attempted in a sandboxed frame with a direct-open option. SmartPass and the Bethel StudentVue portal explicitly deny framing and therefore show a launch option instead. Authentication/mail links also launch directly.

Verified on production September 15, 2026: Billboard Division 1 and Parking Lot Division 1 render inside NEST. Finished List renders with the existing school Google account. The specific Join Us Google Form exposes an embedded preview with a Fill out form link, so the viewer explains that completion requires opening it separately. Other providers can also enforce sign-in or frame restrictions; a frame load event does not establish successful rendering.

Desktop and phone-size viewer checks passed. Unit tests cover URL adapters, direct-launch providers, focus restoration, frame removal, and unmodified internal navigation.
