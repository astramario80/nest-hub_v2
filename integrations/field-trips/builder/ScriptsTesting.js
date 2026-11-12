/**
=============== SCRIPTS TESTING ===============
 
*/

function checkAppsScriptApiAccess() {
  try {
    // Use this script's own project ID to test
    const scriptId = ScriptApp.getScriptId();
    const token = ScriptApp.getOAuthToken();
    
    const response = UrlFetchApp.fetch(
      `https://script.googleapis.com/v1/projects/${scriptId}`,
      {
        headers: { 'Authorization': 'Bearer ' + token },
        muteHttpExceptions: true
      }
    );
    
    const code = response.getResponseCode();
    if (code === 200) {
      const data = JSON.parse(response.getContentText());
      Logger.log('✅ Apps Script API is enabled and accessible!');
      Logger.log(`Script Title: ${data.title}`);
      Logger.log(`Script ID: ${scriptId}`);
    } else if (code === 403) {
      Logger.log('❌ Apps Script API access denied');
      Logger.log('Response: ' + response.getContentText());
    } else {
      Logger.log(`⚠️ Response code: ${code}`);
      Logger.log('Response: ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
  }
}

/**
 * Run this once to get the template IDs from the Templates folder
 */
function getTemplateIdsFromFolder() {
  const templatesFolderId = '1MG7nZ5GueVeJEGjn7m3tEN0oBBB5tw3k';
  const folder = DriveApp.getFolderById(templatesFolderId);
  const files = folder.getFiles();
  
  Logger.log('Templates found:');
  Logger.log('='.repeat(60));
  
  while (files.hasNext()) {
    const file = files.next();
    Logger.log(`Name: ${file.getName()}`);
    Logger.log(`ID: ${file.getId()}`);
    Logger.log('---');
  }
}

function testFieldTripsFolder() {
  const fieldTripsFolderId = '1oy8tn_fNRH902LgRHgX_aRHHmYO3ugbB';
  
  try {
    const folder = DriveApp.getFolderById(fieldTripsFolderId);
    Logger.log(`✅ Found folder: ${folder.getName()}`);
    
    // List immediate subfolders
    const subfolders = folder.getFolders();
    let count = 0;
    while (subfolders.hasNext() && count < 5) {
      const sub = subfolders.next();
      Logger.log(`   📂 ${sub.getName()}`);
      count++;
    }
    
  } catch (e) {
    Logger.log(`❌ Error: ${e.message}`);
  }
}

function testDriveAccess() {
  Logger.log('Testing Drive access...');
  
  // Test 1: Can we access Drive at all?
  try {
    const rootFolder = DriveApp.getRootFolder();
    Logger.log(`✅ Root folder accessible: ${rootFolder.getName()}`);
  } catch (e) {
    Logger.log(`❌ Root folder error: ${e.message}`);
  }
  
  // Test 2: Upcoming Events folder (we know this works from earlier)
  try {
    const upcomingFolder = DriveApp.getFolderById('12zXeHSjAUYyQDI7ALcIZ1l3R44MMpLGh');
    Logger.log(`✅ Upcoming Events folder: ${upcomingFolder.getName()}`);
  } catch (e) {
    Logger.log(`❌ Upcoming Events error: ${e.message}`);
  }
  
  // Test 3: Current Event folder
  try {
    const currentFolder = DriveApp.getFolderById('1oy8tn_fNRH902LgRHgX_aRHHmYO3ugbB');
    Logger.log(`✅ Current Event folder: ${currentFolder.getName()}`);
  } catch (e) {
    Logger.log(`❌ Current Event error: ${e.message}`);
  }
  
  // Test 4: Templates folder
  try {
    const templatesFolder = DriveApp.getFolderById('1MG7nZ5GueVeJEGjn7m3tEN0oBBB5tw3k');
    Logger.log(`✅ Templates folder: ${templatesFolder.getName()}`);
  } catch (e) {
    Logger.log(`❌ Templates error: ${e.message}`);
  }
}

function forceReauthorization() {
  // This function uses multiple services to trigger auth prompts
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log(`Spreadsheet: ${ss.getName()}`);
  
  const folder = DriveApp.getRootFolder();
  Logger.log(`Root folder: ${folder.getName()}`);
}

function testFolderStructure() {
  const fieldTripsFolderId = '1oy8tn_fNRH902LgRHgX_aRHHmYO3ugbB';
  
  const fieldTripsFolder = DriveApp.getFolderById(fieldTripsFolderId);
  Logger.log(`📁 Field Trips folder: ${fieldTripsFolder.getName()}`);
  
  // List all subfolders
  const subfolders = fieldTripsFolder.getFolders();
  Logger.log('\nDirect subfolders:');
  
  while (subfolders.hasNext()) {
    const sub = subfolders.next();
    Logger.log(`  📂 ${sub.getName()}`);
    
    // Check for sub-subfolders
    const subSubs = sub.getFolders();
    while (subSubs.hasNext()) {
      const subSub = subSubs.next();
      Logger.log(`      📂 ${subSub.getName()}`);
    }
  }
}

function listFilesInUpcomingEvents() {
  const upcomingFolderId = '12zXeHSjAUYyQDI7ALcIZ1l3R44MMpLGh';
  const upcomingFolder = DriveApp.getFolderById(upcomingFolderId);
  
  Logger.log(`📁 Upcoming Events folder contents:\n`);
  
  const eventFolders = upcomingFolder.getFolders();
  
  while (eventFolders.hasNext()) {
    const eventFolder = eventFolders.next();
    Logger.log(`📂 ${eventFolder.getName()}`);
    
    const files = eventFolder.getFiles();
    let fileCount = 0;
    
    while (files.hasNext()) {
      const file = files.next();
      Logger.log(`   📄 ${file.getName()} (${file.getMimeType()})`);
      fileCount++;
    }
    
    if (fileCount === 0) {
      Logger.log(`   ⚠️ No files in this folder (only subfolders)`);
    }
    
    Logger.log('');
  }
}

function debugTemplateScriptId() {
  const templateSpreadsheetId = '1vQ3lJSx1bf5KhCC7q7zQVot-DM5UL817SbzFl5S15fk';
  
  Logger.log('🔍 Checking template Script ID...');
  
  try {
    const templateSS = SpreadsheetApp.openById(templateSpreadsheetId);
    Logger.log(`✅ Opened template: ${templateSS.getName()}`);
    
    const setupSheet = templateSS.getSheetByName('Setup');
    
    if (!setupSheet) {
      Logger.log('❌ Setup sheet not found in template');
      return;
    }
    
    const scriptId = setupSheet.getRange('A2').getValue();
    Logger.log(`📋 Script ID from Setup!A2: "${scriptId}"`);
    
    if (!scriptId) {
      Logger.log('❌ Script ID is empty! Open the template to register it.');
      return;
    }
    
    // Try to read the script content
    Logger.log('📖 Attempting to read script content...');
    
    const token = ScriptApp.getOAuthToken();
    const url = `https://script.googleapis.com/v1/projects/${scriptId}/content`;
    
    const response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    const content = response.getContentText();
    
    Logger.log(`Response code: ${code}`);
    
    if (code === 200) {
      const parsed = JSON.parse(content);
      Logger.log(`✅ Success! Found ${parsed.files.length} files in script`);
      parsed.files.forEach(f => Logger.log(`   • ${f.name} (${f.type})`));
    } else {
      Logger.log(`❌ Failed to read script: ${content}`);
    }
    
  } catch (e) {
    Logger.log(`❌ Error: ${e.message}`);
  }
}


function debugTemplateScriptId() {
  const templateSpreadsheetId = '1vQ3IJSx1bf5KhCC7q7zQVot-DM5UL8I7SbzFl5S15fk';
  
  Logger.log('🔍 Checking template Script ID...');
  
  try {
    const templateSS = SpreadsheetApp.openById(templateSpreadsheetId);
    Logger.log(`✅ Opened template: ${templateSS.getName()}`);
    
    const setupSheet = templateSS.getSheetByName('Setup');
    
    if (!setupSheet) {
      Logger.log('❌ Setup sheet not found in template');
      return;
    }
    
    const scriptId = setupSheet.getRange('A2').getValue();
    Logger.log(`📋 Script ID from Setup!A2: "${scriptId}"`);
    
    if (!scriptId) {
      Logger.log('❌ Script ID is empty! Open the template to register it.');
      return;
    }
    
    // Try to read the script content
    Logger.log('📖 Attempting to read script content...');
    
    const token = ScriptApp.getOAuthToken();
    const url = `https://script.googleapis.com/v1/projects/${scriptId}/content`;
    
    const response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    const content = response.getContentText();
    
    Logger.log(`Response code: ${code}`);
    Logger.log(`Response: ${content.substring(0, 500)}`);
    
    if (code === 200) {
      const parsed = JSON.parse(content);
      Logger.log(`✅ Success! Found ${parsed.files.length} files in script`);
    } else {
      Logger.log(`❌ Failed to read script. Check if Apps Script API is enabled.`);
    }
    
  } catch (e) {
    Logger.log(`❌ Error: ${e.message}`);
  }
}


function verifyScriptPush() {
  const templateScriptId = '1EA_2ubUuHUMu2pAI_qPk7_fFjWwyH4edS4CCDZ5JulzL0dF3MiJEXgKV';
  const targetScriptId = '1MFMsyWWsgMjiN3rvo4zjebJLnHsDFSnDZdeTCG2-47z4wZVlRfmUHbmJ';
  
  const token = ScriptApp.getOAuthToken();
  
  // Get template content
  Logger.log('📖 Reading template script...');
  const templateResponse = UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${templateScriptId}/content`,
    { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
  );
  const templateContent = JSON.parse(templateResponse.getContentText());
  Logger.log(`   Template has ${templateContent.files.length} files:`);
  templateContent.files.forEach(f => Logger.log(`   • ${f.name}`));
  
  // Get target content BEFORE push
  Logger.log('\n📖 Reading target script BEFORE push...');
  const beforeResponse = UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${targetScriptId}/content`,
    { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
  );
  
  if (beforeResponse.getResponseCode() !== 200) {
    Logger.log(`   ❌ Error: ${beforeResponse.getContentText()}`);
    return;
  }
  
  const beforeContent = JSON.parse(beforeResponse.getContentText());
  Logger.log(`   Target has ${beforeContent.files.length} files:`);
  beforeContent.files.forEach(f => Logger.log(`   • ${f.name}`));
  
  // Push
  Logger.log('\n📝 Pushing template to target...');
  const pushResponse = UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${targetScriptId}/content`,
    {
      method: 'PUT',
      headers: { 
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(templateContent),
      muteHttpExceptions: true
    }
  );
  Logger.log(`   Push response code: ${pushResponse.getResponseCode()}`);
  Logger.log(`   Push response: ${pushResponse.getContentText().substring(0, 500)}`);
  
  // Get target content AFTER push
  Logger.log('\n📖 Reading target script AFTER push...');
  const afterResponse = UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${targetScriptId}/content`,
    { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
  );
  const afterContent = JSON.parse(afterResponse.getContentText());
  Logger.log(`   Target now has ${afterContent.files.length} files:`);
  afterContent.files.forEach(f => Logger.log(`   • ${f.name}`));
}


function listTrackedScriptIds() {
  const ss = SpreadsheetApp.openById('117q2rtYkkMCy67SDHF0UD3XXuxtESxh-psXUVCdzB-c');
  const sheet = ss.getSheetByName('FolderTracker');
  
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 2, lastRow - 1, 4).getValues(); // Columns B-E
  
  Logger.log('📋 FolderTracker Script IDs:\n');
  
  for (const row of data) {
    const eventName = row[0];
    const scriptId = row[3]; // Column E
    
    Logger.log(`${eventName}`);
    Logger.log(`   Script ID: ${scriptId || '(empty)'}`);
    Logger.log('');
  }
}

function checkTemplateOnOpenContent() {
  const templateScriptId = '1EA_2ubUuHUMu2pAI_qPk7_fFjWwyH4edS4CCDZ5JulzL0dF3MiJEXgKV';
  const token = ScriptApp.getOAuthToken();
  
  const response = UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${templateScriptId}/content`,
    { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
  );
  
  const content = JSON.parse(response.getContentText());
  
  // Find Triggers&Masters file
  const triggersFile = content.files.find(f => f.name === 'Triggers&Masters');
  
  if (triggersFile) {
    Logger.log('📄 Triggers&Masters.gs content:\n');
    
    // Check for key functions
    const source = triggersFile.source;
    
    Logger.log(`Contains "updateTriggerStatus()": ${source.includes('updateTriggerStatus()')}`);
    Logger.log(`Contains "registerScriptIdIfNeeded()": ${source.includes('registerScriptIdIfNeeded()')}`);
    Logger.log(`Contains "function updateTriggerStatus": ${source.includes('function updateTriggerStatus')}`);
    
    // Show the onOpen function
    const onOpenMatch = source.match(/function onOpen[\s\S]*?^}/m);
    if (onOpenMatch) {
      Logger.log('\n📋 onOpen function:\n');
      Logger.log(onOpenMatch[0].substring(0, 1500));
    }
  } else {
    Logger.log('❌ Triggers&Masters file not found');
  }
}
function checkTargetOnOpenContent() {
  const targetScriptId = '1MFMsyWWsgMjiN3rvo4zjebJLnHsDFSnDZdeTCG2-47z4wZVlRfmUHbmJ';
  const token = ScriptApp.getOAuthToken();
  
  const response = UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${targetScriptId}/content`,
    { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true }
  );
  
  const content = JSON.parse(response.getContentText());
  
  // Find Triggers&Masters file
  const triggersFile = content.files.find(f => f.name === 'Triggers&Masters');
  
  if (triggersFile) {
    Logger.log('📄 Target Triggers&Masters.gs content:\n');
    
    const source = triggersFile.source;
    
    Logger.log(`Contains "updateTriggerStatus()": ${source.includes('updateTriggerStatus()')}`);
    Logger.log(`Contains "registerScriptIdIfNeeded()": ${source.includes('registerScriptIdIfNeeded()')}`);
    Logger.log(`Contains "function updateTriggerStatus": ${source.includes('function updateTriggerStatus')}`);
    
    // Show the onOpen function
    const onOpenMatch = source.match(/function onOpen[\s\S]*?^}/m);
    if (onOpenMatch) {
      Logger.log('\n📋 onOpen function in target:\n');
      Logger.log(onOpenMatch[0].substring(0, 1500));
    }
  } else {
    Logger.log('❌ Triggers&Masters file not found');
  }
}





