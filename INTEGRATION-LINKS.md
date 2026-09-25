# NEST integration link index

Source Google permissions remain in force. This index has links and structure only; it contains no student records or credentials.

## 3D printing

- Old landing slide: https://docs.google.com/presentation/d/1s01dI6Arva3IjZcMtLN3Fx7UGfa4Zy9FtNAKFIG5Z-E/present?slide=id.p
- 3D print request form: https://docs.google.com/forms/d/e/1FAIpQLScGtcbvGnwnloQKpd15pelduyp5ohsT6aQx6qF13DBcZ4RKgg/viewform
- Printer queue and request management sheet: https://docs.google.com/spreadsheets/d/13Dnk31EDgx2_E46gkEAJ_e0gamqsA_VoFSf8qQEr4vk/edit?gid=47407658#gid=47407658
- 3D print document library: https://drive.google.com/drive/folders/1LIiFv7sGoiIr7SPLDWNrTBUHgMUyCQfW
- Instructions linked from the old slide: https://docs.google.com/presentation/d/19iyg0iYq2L-jJBWIGbYBN4sIRUuW84W0rm9fLNO6QT0/present?slide=id.p1
- Print preparation linked from the old slide: https://digitalfactory.ultimaker.com/app/prepare
- Bambu Studio: https://bambulab.com/en/download/studio (added from the official Bambu Lab download page; not a link on the old slide)

The old slide's printer icon points to https://forms.gle/6AVJkCMJJZoa4mky9, which redirects to the same 3D print request form listed above.

## Weather reports

- Weather data workbook: https://docs.google.com/spreadsheets/d/1px1NzRmcf0sSRp0u3SZE4dKlYXbfagyHdRYNYGeNJM8/edit
- Weather submission form: https://docs.google.com/forms/d/e/1FAIpQLSetK0Uegeg9SBa1gnpnDp84Em47_CS27RVDf714WUWP3P52ew/viewform
- Live workbook tabs: Advisory, Period 1, Period 2, Period 3, Period 4, Period 5, CTSO. Period 7 is not present.
- The report headers are on row 9, and report entries start on row 10. The NEST data page presents buttons only for tabs where the current account has a Division Manager, Assistant Manager, or Partner Liaison role in the matching period. The leadership workbook contains the title `Partner Liaison`.

Advisory currently has no corresponding division role in the leadership lookup, so it is excluded from division access pending a role rule.

## Leadership and hiring

- Leadership lookup and hiring link directory: https://docs.google.com/spreadsheets/d/1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I/edit?gid=254146775#gid=254146775
- Leadership application form: https://docs.google.com/forms/d/e/1FAIpQLSdy-5_36M3kbapsQRVni1Kn11LBXtq7PTdqPTS8lm44EZjjZA/viewform
- `Imported!B:C` maps period to hiring workbook. Current links:
  - Period 1: https://docs.google.com/spreadsheets/d/1Ut9K28LgaYbNHJRw6cn1l48wD_aaO484ZMjJi8zcIxo/edit
  - Period 2: https://docs.google.com/spreadsheets/d/13RUztc3CXnd9bzM9IcYXEIqhO-045KbStHeB7GKA_W4/edit
  - Period 4: https://docs.google.com/spreadsheets/d/1DBkq8zvNVi48aegk0AkMObEDH0krVmRnmigVPUHyuCI/edit
  - Period 5: https://docs.google.com/spreadsheets/d/1BAzRoHsx3lbAG-PH48_8fQHRW6WAmEJL3Fi0eIxBcGY/edit
  - CTSO: https://docs.google.com/spreadsheets/d/1Fz65n04x1wCLcuVjYpKEcEexlyZvsoMKhOfJZkhovfg/edit

Period 3 and Period 7 have no hiring workbook link in `Imported!B:C` at present. The inspected workbooks contain `Applications` and `Division Team`; Period 4 also contains a historical-looking `Expedited Apps.` tab. The current NEST review reads only `Applications` until the purpose of that extra tab is confirmed. The `Applications` headers are Timestamp, Applicant, Period, Position, three written response questions, and Notes. In `Division Team`, B is position, C is team member, and D is district email. The team member cells have strict dropdown lists; the inspected workbook contains no review-status or selection column in `Applications`.

Managers and assistant managers may review their own division's applications and team. CTSO Chief Executive, Financial, and Operations Officers may review applications across divisions. Managers and assistant managers can assign a student already on their division roster. NEST checks their current role and the current team cell before writing the name and district email; it expands the strict dropdown list if the rostered student is missing. CTSO executives have review access only. Adding a student to the underlying division roster is a separate operation and is not connected here.

## Publishing

Deploy `google-spinner/Code.js`, `Auth.js`, `Tracker.js`, `Weather.js`, `Hiring.js`, and `appsscript.json` together as a new version of the school-owned bridge before releasing the website changes. Verify with school accounts for each role and a student without access. No production publishing or student assignment changes have been made in this task.
