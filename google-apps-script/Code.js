// Read-only bridge: accepts no caller-supplied folder or file IDs.
const LUNCH_FOLDER_ID = '1uZMZ1kgGk0TiZZuut4voigcWT0-APO_0';
function doGet() { return json_({error:'Authentication required.'}); }
function doPost(event) {
  const expected = 'ad29d2ae10404b51863b9ac9c4158602da70df45566ec11dfb35902514a1b759';
  let request;
  try { request = JSON.parse(event.postData.contents); } catch (_) { return json_({error:'Authentication required.'}); }
  if (!request.token || typeof request.token !== 'string' || Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, request.token).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('') !== expected) return json_({error:'Authentication required.'});
  try {
    const files = DriveApp.getFolderById(LUNCH_FOLDER_ID).getFilesByType(MimeType.PDF);
    let newest = null;
    while (files.hasNext()) {
      const file = files.next();
      if (!newest || file.getLastUpdated().getTime() > newest.getLastUpdated().getTime() ||
          (file.getLastUpdated().getTime() === newest.getLastUpdated().getTime() && file.getDateCreated().getTime() > newest.getDateCreated().getTime())) newest = file;
    }
    if (!newest) throw new Error('No lunch PDF is available.');
    if (newest.getSize() > 5 * 1024 * 1024) throw new Error('Lunch PDF exceeds the supported size.');
    return json_({ source: { name:newest.getName(), modifiedTime:newest.getLastUpdated().toISOString() }, pdf:Utilities.base64Encode(newest.getBlob().getBytes()) });
  } catch (error) { return json_({error:'The lunch PDF is temporarily unavailable.'}); }
}
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
// Run once as the project owner to authorize the read-only Drive scope.
function authorizeLunchFolder() { console.log(DriveApp.getFolderById(LUNCH_FOLDER_ID).getName()); }
