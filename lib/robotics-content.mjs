export const ROBOTICS_HTML=`<section class="robotics-workspace" aria-label="NEST Robotics membership management">
<h2>NEST™ Robotics</h2><p>Manage club membership, FIRST Team #2927 registration, and parent consent.</p>
<p data-robotics-status role="status" aria-live="polite"></p><div data-robotics-content hidden>
<div class="internal-actions"><button type="button" data-robotics-load>Reload membership</button><button type="button" data-robotics-refresh>Refresh from Program of Work</button></div>
<p data-robotics-imported></p><p data-robotics-summary></p>
<label>Find a member <input type="search" data-robotics-search placeholder="Name or student ID"></label>
<div class="table-scroll"><table><thead><tr><th>Member</th><th>Club status</th><th>FIRST membership</th><th>Parent waiver</th><th>Review</th></tr></thead><tbody data-robotics-members></tbody></table></div>
<p data-robotics-unmatched></p><details><summary>Import the FIRST roster</summary><p>Copy the Team Roster page from FIRST Dashboard, including Youth Members → Accepted. Pending invitations and applications do not count as joined. Import again when FIRST records change.</p>
<label>FIRST dashboard text<textarea data-robotics-roster rows="8" maxlength="150000"></textarea></label><button type="button" data-robotics-import>Import accepted youth roster</button></details>
<details><summary>Reminder notifications</summary><p>Only active members with verified student IDs and roster emails receive reminders. Sending uses the school bridge account. Preview the recipients and message before sending.</p>
<label>Reminder type <select data-robotics-kind><option value="join">Join FIRST</option><option value="waiver">Parent waiver</option><option value="both">Both reminder groups</option><option value="test">Test both messages to my account</option></select></label>
<button type="button" data-robotics-preview>Preview recipients</button><div data-robotics-preview-content></div><button type="button" data-robotics-send hidden>Send these reminders</button></details>
</div></section>`;
