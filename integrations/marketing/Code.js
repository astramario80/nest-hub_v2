function doGet(){return json_({status:401});}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function doPost(e){try{const r=JSON.parse(e.postData.contents);if(typeof r.token!=='string'||hash_(r.token)!=='e48a1a2c74faf571ec7a68a432cfbbc161772ff5ef50dd433e301c3506886873')return json_({status:401});return json_(marketingDispatch_(r));}catch(_){return json_({status:503});}}
function hash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');}
function Authorize_NEST_Media(){const folder=Drive.Files.get(MARKETING_ROOT_,{fields:'id,name'});console.log('NEST media connection ready: '+folder.name);}
