// ============================================================================
// SECTION 1: TRIGGER SETUP & DELETION
// ============================================================================

function setupTimeTriggers() {
  // No longer needed - each event spreadsheet handles its own updates
  Logger.log('ℹ️ Time-based triggers no longer used in Field Trip Builder');
  Logger.log('ℹ️ Each event spreadsheet manages its own attendance updates');
}

function deleteAllProjectTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    ScriptApp.deleteTrigger(t);
  }
  Logger.log('🗑️ Deleted all existing triggers');
}


// ============================================================================
// SECTION 2: TRIGGER AUDIT
// ============================================================================

/**
 * AUDIT: Scans all Field Trip Data spreadsheets and reports on their triggers
 * Reads trigger counts from each spreadsheet's Setup!B2 cell
 * Creates a report in a new sheet called "Trigger Audit"
 */
function auditAllFieldTripTriggers() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log('🔍 Starting Field Trip Trigger Audit...');
  Logger.log('='.repeat(60));

  // Get or create audit sheet
  let auditSheet = ss.getSheetByName('Trigger Audit');
  if (!auditSheet) {
    auditSheet = ss.insertSheet('Trigger Audit');
  } else {
    auditSheet.clear();
  }

  // Set up headers
  const headers = [
    'Event Name',
    'Event Date',
    'Status',
    'Days Until/Since',
    'Trigger Count',
    'Last Trigger Check',
    'Spreadsheet Link',
    'Recommendation'
  ];

  auditSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  auditSheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#002529')
    .setFontColor('#ffffff');

  // Get data from FolderTracker
  const trackerSheet = ss.getSheetByName(FOLDER_TRACKER_CONFIG.sheetName);
  
  if (!trackerSheet) {
    ui.alert('Error', 'FolderTracker sheet not found. Run "Update Folder Tracker Database" first.', ui.ButtonSet.OK);
    return;
  }
  
  const lastRow = trackerSheet.getLastRow();
  if (lastRow < 2) {
    ui.alert('No Data', 'No spreadsheets found in FolderTracker.', ui.ButtonSet.OK);
    return;
  }
  
  // Get data from columns B-G (Event Name, Folder ID, Spreadsheet ID, Script ID, Last Updated, Status)
  const trackerData = trackerSheet.getRange(2, 2, lastRow - 1, 6).getValues();
  
  Logger.log(`📁 Found ${trackerData.length} spreadsheets in FolderTracker`);

  const results = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const row of trackerData) {
    const eventName = row[0];
    const folderId = row[1];
    const spreadsheetId = row[2];
    const scriptId = row[3];
    
    if (!spreadsheetId) continue;
    
    Logger.log(`\n📊 Checking: ${eventName}`);
    
    // Try to get trigger count from the spreadsheet's Setup!B2
    let triggerCount = 0;
    let lastTriggerCheck = '';
    let eventDate = null;
    
    try {
      const targetSS = SpreadsheetApp.openById(spreadsheetId);
      const setupSheet = targetSS.getSheetByName('Setup');
      
      if (setupSheet) {
        triggerCount = setupSheet.getRange('B2').getValue() || 0;
        lastTriggerCheck = setupSheet.getRange('C2').getValue() || '';
      }
      
      // Try to get event date from the folder name
      try {
        const folder = DriveApp.getFolderById(folderId);
        const folderName = folder.getName();
        const eventInfo = parseEventFolderName(folderName);
        
        if (eventInfo) {
          eventDate = eventInfo.eventDate;
        }
      } catch (folderErr) {
        Logger.log(`   ⚠️ Could not access folder: ${folderErr.message}`);
      }
      
    } catch (e) {
      Logger.log(`   ⚠️ Could not access spreadsheet: ${e.message}`);
    }
    
    // Calculate days until/since event
    let daysDiff = null;
    let status = '❓ Unknown Date';
    let recommendation = '⚠️ Check manually';
    
    if (eventDate) {
      daysDiff = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysDiff < -7) {
        status = '🔴 Past (>1 week ago)';
        recommendation = triggerCount > 0 ? '⚠️ DISABLE TRIGGERS' : '✅ OK (no triggers)';
      } else if (daysDiff < 0) {
        status = '🟠 Past (<1 week)';
        recommendation = triggerCount > 0 ? '⚠️ Consider disabling' : '✅ OK';
      } else if (daysDiff === 0) {
        status = '🟢 TODAY';
        recommendation = '✅ Keep active';
      } else if (daysDiff <= 7) {
        status = '🟢 Upcoming (this week)';
        recommendation = '✅ Keep active';
      } else {
        status = '🔵 Future';
        recommendation = '✅ OK';
      }
    }
    
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    
    results.push([
      eventName,
      eventDate ? Utilities.formatDate(eventDate, Session.getScriptTimeZone(), 'MM/dd/yyyy') : 'Unknown',
      status,
      daysDiff !== null ? daysDiff : 'N/A',
      triggerCount,
      lastTriggerCheck ? Utilities.formatDate(new Date(lastTriggerCheck), Session.getScriptTimeZone(), 'MM/dd/yyyy HH:mm') : 'Never',
      spreadsheetUrl,
      recommendation
    ]);
    
    Logger.log(`   Status: ${status}, Triggers: ${triggerCount}`);
  }

  // Sort by days until/since (upcoming first, then past)
  results.sort((a, b) => {
    if (a[3] === 'N/A') return 1;
    if (b[3] === 'N/A') return -1;
    return b[3] - a[3];
  });

  // Write results
  if (results.length > 0) {
    auditSheet.getRange(2, 1, results.length, headers.length).setValues(results);

    // Make spreadsheet links clickable
    for (let i = 0; i < results.length; i++) {
      const rowNum = i + 2;
      const url = results[i][6];
      const richText = SpreadsheetApp.newRichTextValue()
        .setText('Open Spreadsheet')
        .setLinkUrl(url)
        .build();
      auditSheet.getRange(rowNum, 7).setRichTextValue(richText);
    }

    // Set column widths
    auditSheet.setColumnWidth(1, 200); // Event name
    auditSheet.setColumnWidth(2, 100); // Date
    auditSheet.setColumnWidth(3, 180); // Status
    auditSheet.setColumnWidth(4, 100); // Days
    auditSheet.setColumnWidth(5, 100); // Trigger count
    auditSheet.setColumnWidth(6, 150); // Last check
    auditSheet.setColumnWidth(7, 130); // Link
    auditSheet.setColumnWidth(8, 180); // Recommendation

    // Highlight rows that need attention
    for (let i = 0; i < results.length; i++) {
      if (results[i][7].includes('DISABLE')) {
        auditSheet.getRange(i + 2, 1, 1, headers.length).setBackground('#f4cccc');
      } else if (results[i][7].includes('Consider')) {
        auditSheet.getRange(i + 2, 1, 1, headers.length).setBackground('#fff2cc');
      }
    }

    // Freeze header row
    auditSheet.setFrozenRows(1);
  }

  // Summary
  const totalTriggers = results.reduce((sum, r) => sum + (parseInt(r[4]) || 0), 0);
  const pastWithTriggers = results.filter(r => r[2].includes('Past') && r[4] > 0).length;
  const neverChecked = results.filter(r => r[5] === 'Never').length;

  Logger.log('\n' + '='.repeat(60));
  Logger.log('AUDIT SUMMARY');
  Logger.log('='.repeat(60));
  Logger.log(`Total spreadsheets scanned: ${results.length}`);
  Logger.log(`Total triggers found: ${totalTriggers}`);
  Logger.log(`Past events with triggers: ${pastWithTriggers}`);
  Logger.log(`Never checked (need to open): ${neverChecked}`);

  let message = `Scanned ${results.length} Field Trip spreadsheet(s)\n\n`;
  message += `Total triggers found: ${totalTriggers}\n`;
  message += `⚠️ Past events with active triggers: ${pastWithTriggers}\n`;
  
  if (neverChecked > 0) {
    message += `\n📋 ${neverChecked} spreadsheet(s) have never reported trigger status.\n`;
    message += `Open each one to update its trigger count, or push the updated script first.`;
  }
  
  message += `\n\nSee the "Trigger Audit" sheet for details.`;

  ui.alert('🔍 Trigger Audit Complete', message, ui.ButtonSet.OK);
}


// ============================================================================
// SECTION 3: CLEANUP INSTRUCTIONS & CHECKLIST GENERATION
// ============================================================================

function generateCleanupChecklist() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const auditSheet = ss.getSheetByName('Trigger Audit');

  if (!auditSheet) {
    SpreadsheetApp.getUi().alert(
      'Run Audit First',
      'Please run "🔍 Audit All Field Trip Triggers" first.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  let instructionsSheet = ss.getSheetByName('Cleanup Checklist');
  if (!instructionsSheet) {
    instructionsSheet = ss.insertSheet('Cleanup Checklist');
  } else {
    instructionsSheet.clear();
  }

  instructionsSheet.getRange('A1').setValue('🧹 TRIGGER CLEANUP CHECKLIST').setFontSize(16).setFontWeight('bold');
  instructionsSheet.getRange('A3').setValue('For each spreadsheet below:');
  instructionsSheet.getRange('A4').setValue('1. Click the link to open the spreadsheet');
  instructionsSheet.getRange('A5').setValue('2. Go to: 📋 Field Trip Builder → 🔄 Toggle Auto-Updates');
  instructionsSheet.getRange('A6').setValue('3. Click "Yes" to disable the triggers');
  instructionsSheet.getRange('A7').setValue('4. Check the box in column A when done');

  const data = auditSheet.getDataRange().getValues();
  const headers = data[0];

  const statusCol = headers.indexOf('Status');
  const nameCol = headers.indexOf('Event Name');
  const dateCol = headers.indexOf('Event Date');
  const urlCol = headers.indexOf('Spreadsheet URL');

  const needsCleanup = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[statusCol] && row[statusCol].includes('Past')) {
      needsCleanup.push({
        name: row[nameCol],
        date: row[dateCol],
        url: row[urlCol]
      });
    }
  }

  const startRow = 9;
  instructionsSheet.getRange(startRow, 1, 1, 4).setValues([['✓ Done', 'Event Name', 'Event Date', 'Click to Open Spreadsheet']]);
  instructionsSheet.getRange(startRow, 1, 1, 4).setFontWeight('bold').setBackground('#f0f0f0');

  needsCleanup.forEach((item, index) => {
    const row = startRow + 1 + index;
    instructionsSheet.getRange(row, 1).insertCheckboxes();
    instructionsSheet.getRange(row, 2).setValue(item.name);
    instructionsSheet.getRange(row, 3).setValue(item.date);
    instructionsSheet.getRange(row, 4).setFormula(`=HYPERLINK("${item.url}", "Open Spreadsheet")`);
  });

  instructionsSheet.setColumnWidth(1, 70);
  instructionsSheet.setColumnWidth(2, 200);
  instructionsSheet.setColumnWidth(3, 100);
  instructionsSheet.setColumnWidth(4, 350);

  SpreadsheetApp.getUi().alert(
    'Cleanup Checklist Created',
    `Found ${needsCleanup.length} past event(s) that may have active triggers.\n\n` +
    `See the "Cleanup Checklist" sheet and work through each one.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function generateCleanupInstructions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const auditSheet = ss.getSheetByName('Trigger Audit');

  if (!auditSheet) {
    SpreadsheetApp.getUi().alert('Please run "Audit All Field Trip Triggers" first.');
    return;
  }

  let instructionsSheet = ss.getSheetByName('Cleanup Instructions');
  if (!instructionsSheet) {
    instructionsSheet = ss.insertSheet('Cleanup Instructions');
  } else {
    instructionsSheet.clear();
  }

  instructionsSheet.getRange('A1').setValue('🧹 TRIGGER CLEANUP INSTRUCTIONS');
  instructionsSheet.getRange('A1').setFontSize(16).setFontWeight('bold');

  instructionsSheet.getRange('A3').setValue('For each spreadsheet below:');
  instructionsSheet.getRange('A4').setValue('1. Click the link to open the spreadsheet');
  instructionsSheet.getRange('A5').setValue('2. Go to: 📋 Field Trip Builder → 🔄 Toggle Auto-Updates');
  instructionsSheet.getRange('A6').setValue('3. Confirm to disable the triggers');
  instructionsSheet.getRange('A7').setValue('4. Check it off in column A');

  const data = auditSheet.getDataRange().getValues();
  const headers = data[0];

  const statusCol = headers.indexOf('Status');
  const nameCol = headers.indexOf('Event Name');
  const dateCol = headers.indexOf('Event Date');
  const urlCol = headers.indexOf('Spreadsheet URL');
  const triggerCol = headers.indexOf('Trigger Count');

  const needsCleanup = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[statusCol].includes('Past') && row[triggerCol] > 0) {
      needsCleanup.push({
        name: row[nameCol],
        date: row[dateCol],
        url: row[urlCol],
        triggers: row[triggerCol]
      });
    }
  }

  const startRow = 9;
  instructionsSheet.getRange(startRow, 1, 1, 5).setValues([['Done?', 'Event Name', 'Event Date', 'Link', 'Triggers']]);
  instructionsSheet.getRange(startRow, 1, 1, 5).setFontWeight('bold').setBackground('#f0f0f0');

  needsCleanup.forEach((item, index) => {
    const row = startRow + 1 + index;
    instructionsSheet.getRange(row, 1).insertCheckboxes();
    instructionsSheet.getRange(row, 2).setValue(item.name);
    instructionsSheet.getRange(row, 3).setValue(item.date);
    instructionsSheet.getRange(row, 4).setValue(item.url);
    instructionsSheet.getRange(row, 4).setFontColor('#1155CC');
    instructionsSheet.getRange(row, 5).setValue(item.triggers);
  });

  instructionsSheet.setColumnWidth(1, 60);
  instructionsSheet.setColumnWidth(2, 200);
  instructionsSheet.setColumnWidth(3, 100);
  instructionsSheet.setColumnWidth(4, 400);
  instructionsSheet.setColumnWidth(5, 80);

  const summaryRow = startRow + needsCleanup.length + 3;
  instructionsSheet.getRange(summaryRow, 1).setValue(`Total spreadsheets needing cleanup: ${needsCleanup.length}`);
  instructionsSheet.getRange(summaryRow, 1).setFontWeight('bold');

  SpreadsheetApp.getUi().alert(
    'Cleanup Instructions Generated',
    `Found ${needsCleanup.length} past event(s) with active triggers.\n\n` +
    `See the "Cleanup Instructions" sheet for a checklist.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


// ============================================================================
// SECTION 4: HELP & DOCUMENTATION
// ============================================================================

function showTriggerManagementHelp() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; color: #222; }
      h2 { color: #002529; margin-top: 0; }
      h3 { color: #002529; margin-bottom: 8px; }
      ul { margin-top: 8px; }
      .warning { background: #fff2cc; padding: 12px; border-radius: 8px; margin: 12px 0; }
      .info { background: #d9ead3; padding: 12px; border-radius: 8px; margin: 12px 0; }
      code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
    </style>

    <h2>🔧 Trigger Management Help</h2>

    <h3>The Problem</h3>
    <p>Each Field Trip Data spreadsheet has triggers that run every 5 minutes (email monitoring) 
    and every 30 minutes (attendance updates). When events end, these triggers keep running 
    and can cause:</p>
    <ul>
      <li>Gmail API rate limit errors</li>
      <li>Error notification emails to staff</li>
      <li>Wasted script execution quota</li>
    </ul>

    <div class="warning">
      <strong>⚠️ Important:</strong> The template has been updated to auto-disable triggers 
      3 days after an event ends. But existing spreadsheets need manual cleanup.
    </div>

    <h3>How to Disable Triggers for a Past Event</h3>
    <ol>
      <li>Open the Field Trip Data spreadsheet for the past event</li>
      <li>Go to: <code>📋 Field Trip Builder → 🔄 Toggle Auto-Updates</code></li>
      <li>Click "Yes" to confirm disabling</li>
    </ol>

    <div class="info">
      <strong>✅ Good News:</strong> Future events will auto-disable their triggers 
      3 days after the event date passes.
    </div>

    <h3>Menu Options</h3>
    <ul>
      <li><strong>🔍 Audit All Field Trip Triggers</strong> - Scans all event folders and creates a status report</li>
      <li><strong>🧹 Generate Cleanup Instructions</strong> - Creates a checklist of past events to clean up</li>
    </ul>
  `)
  .setWidth(500)
  .setHeight(500);

  SpreadsheetApp.getUi().showModalDialog(html, 'Trigger Management Help');
}


// ============================================================================
// SECTION 5: TEMPLATE CONFIGURATION
// ============================================================================

const TEMPLATE_CONFIG = {
  folders: {
    upcomingEvents: '12zXeHSjAUYyQDI7ALcIZ1l3R44MMpLGh',
    currentEvent: '1oy8tn_fNRH902LgRHgX_aRHHmYO3ugbB',
    templates: '1MG7nZ5GueVeJEGjn7m3tEN0oBBB5tw3k'
  },
  templates: {
    itinerary: {
      id: '1_NDi3EJ0GAJFbUqF10Sykkg-QDQCcH8r3t3PUXKnxBs',
      name: 'Itinerary',
      searchTerms: ['itinerary'],
      fileType: MimeType.GOOGLE_DOCS
    },
    permissionForm: {
      id: '1mufhIsWuPB6DAJiqjq1jk7A7r8Bb0tKJT3LqK-Q4Yao',
      name: 'Permission Slip',
      searchTerms: ['permission', 'slip', 'form'],
      fileType: MimeType.GOOGLE_DOCS
    },
    dataSheet: {
      id: '1vQ3IJSx1bf5KhCC7q7zQVot-DM5UL8I7SbzFl5S15fk',
      name: 'Field Trip Data',
      searchTerms: ['field trip data', 'data'],
      fileType: MimeType.GOOGLE_SHEETS
    }
  }
};

function getTemplateConfig() {
  return TEMPLATE_CONFIG;
}


// ============================================================================
// SECTION 6: HELPER / UTILITY FUNCTIONS
// ============================================================================

function parseEventFolderName(folderName) {
  const pattern = /^(\d{2})_(\d{2})_(\d{2})(?:-(\d{2}))?[_\s](.+)$/;
  const match = folderName.match(pattern);

  if (!match) return null;

  const year = parseInt('20' + match[1]);
  const month = parseInt(match[2]) - 1;
  const day = parseInt(match[3]);
  const eventNameRaw = match[5];
  const eventName = eventNameRaw.replace(/_/g, ' ');

  return {
    eventDate: new Date(year, month, day),
    eventName: eventName
  };
}

function getActiveEventFolders() {
  const config = getTemplateConfig();
  const eventFolders = [];
  
  Logger.log('Scanning for active event folders...');
  
  // Upcoming
  try {
    const upcomingFolder = DriveApp.getFolderById(config.folders.upcomingEvents);
    const upcomingSubfolders = upcomingFolder.getFolders();
    while (upcomingSubfolders.hasNext()) {
      const folder = upcomingSubfolders.next();
      const folderName = folder.getName();
      if (parseEventFolderName(folderName)) {
        eventFolders.push({ name: folderName, id: folder.getId(), folder: folder, location: 'Upcoming' });
      }
    }
  } catch (e) {
    throw new Error(`Cannot access Upcoming Events folder. Error: ${e.message}`);
  }
  
  // Current
  try {
    const currentFolder = DriveApp.getFolderById(config.folders.currentEvent);
    const currentSubfolders = currentFolder.getFolders();
    while (currentSubfolders.hasNext()) {
      const folder = currentSubfolders.next();
      const folderName = folder.getName();
      if (parseEventFolderName(folderName)) {
        if (!eventFolders.some(ef => ef.id === folder.getId())) {
          eventFolders.push({ name: folderName, id: folder.getId(), folder: folder, location: 'Current' });
        }
      }
    }
  } catch (e) {
    throw new Error(`Cannot access Current Event folder. Error: ${e.message}`);
  }
  
  eventFolders.sort((a, b) => a.name.localeCompare(b.name));
  return eventFolders;
}

function checkTriggersForSpreadsheet(spreadsheetId) {
  const result = {
    hasEmailMonitor: false,
    hasAttendanceUpdate: false,
    hasOnOpen: false,
    totalTriggers: 0,
    triggerDetails: []
  };

  try {
    const triggers = ScriptApp.getProjectTriggers();

    triggers.forEach(trigger => {
      const source = trigger.getTriggerSource();
      if (source === ScriptApp.TriggerSource.SPREADSHEETS) {
        const handlerFunction = trigger.getHandlerFunction();
        result.triggerDetails.push({
          function: handlerFunction,
          type: trigger.getEventType().toString(),
          id: trigger.getUniqueId()
        });
      }
    });

    try {
      SpreadsheetApp.openById(spreadsheetId);
    } catch (e) {
      Logger.log(`    ⚠️ Could not open spreadsheet: ${e.message}`);
    }

  } catch (e) {
    Logger.log(`    ❌ Error checking triggers: ${e.message}`);
  }

  return result;
}

function findExistingTemplateFiles(folder, templateConfig) {
  const matchingFiles = [];
  const files = folder.getFiles();
  const templateKey = templateConfig.name.toLowerCase();
  
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName().toLowerCase();
    const mimeType = file.getMimeType();
    
    let isMatch = false;
    
    if (templateKey.includes('field trip data') || templateKey.includes('data')) {
      if ((fileName.includes('field trip data') || fileName.includes('- field trip data')) 
          && mimeType === MimeType.GOOGLE_SHEETS) {
        isMatch = true;
      }
    } else if (templateKey.includes('itinerary')) {
      if (fileName.includes('itinerary') && 
          (mimeType === MimeType.GOOGLE_DOCS || mimeType === MimeType.PDF)) {
        isMatch = true;
      }
    } else if (templateKey.includes('permission') || templateKey.includes('form')) {
      if ((fileName.includes('field trip form') || fileName.includes('permission')) && 
          (mimeType === MimeType.GOOGLE_DOCS || mimeType === MimeType.PDF)) {
        isMatch = true;
      }
    } else {
      const matches = templateConfig.searchTerms.some(term => fileName.includes(term.toLowerCase()));
      if (matches) isMatch = true;
    }
    
    if (isMatch) {
      matchingFiles.push(file);
    }
  }
  
  return matchingFiles;
}


// ============================================================================
// SECTION 7: DIAGNOSTICS & SETUP
// ============================================================================

function diagnoseFolderAccess() {
  // (kept exactly as your original)
  const ui = SpreadsheetApp.getUi();
  const config = getTemplateConfig();
  
  let report = [];
  report.push('📁 FOLDER ACCESS DIAGNOSTIC');
  report.push('='.repeat(50));
  report.push('');
  
  report.push('UPCOMING EVENTS FOLDER:');
  report.push(`ID: ${config.folders.upcomingEvents}`);
  
  try {
    const upcomingFolder = DriveApp.getFolderById(config.folders.upcomingEvents);
    report.push(`✅ Accessible: "${upcomingFolder.getName()}"`);
    
    const upcomingSubfolders = upcomingFolder.getFolders();
    const upcomingEvents = [];
    while (upcomingSubfolders.hasNext()) {
      upcomingEvents.push(upcomingSubfolders.next().getName());
    }
    
    report.push(`   Contains ${upcomingEvents.length} subfolder(s)`);
    if (upcomingEvents.length > 0) {
      upcomingEvents.sort();
      for (const name of upcomingEvents.slice(0, 8)) {
        const parsed = parseEventFolderName(name);
        report.push(`   • ${name} ${parsed ? '✓' : '(not event format)'}`);
      }
      if (upcomingEvents.length > 8) {
        report.push(`   ... and ${upcomingEvents.length - 8} more`);
      }
    }
  } catch (e) {
    report.push(`❌ CANNOT ACCESS: ${e.message}`);
  }
  
  report.push('');
  report.push('CURRENT EVENT FOLDER:');
  report.push(`ID: ${config.folders.currentEvent}`);
  
  try {
    const currentFolder = DriveApp.getFolderById(config.folders.currentEvent);
    report.push(`✅ Accessible: "${currentFolder.getName()}"`);
    
    const currentSubfolders = currentFolder.getFolders();
    const currentEvents = [];
    while (currentSubfolders.hasNext()) {
      currentEvents.push(currentSubfolders.next().getName());
    }
    
    report.push(`   Contains ${currentEvents.length} subfolder(s)`);
    if (currentEvents.length > 0) {
      for (const name of currentEvents) {
        const parsed = parseEventFolderName(name);
        report.push(`   • ${name} ${parsed ? '✓' : '(not event format)'}`);
      }
    }
  } catch (e) {
    report.push(`❌ CANNOT ACCESS: ${e.message}`);
  }
  
  report.push('');
  report.push('='.repeat(50));
  
  try {
    const allEvents = getActiveEventFolders();
    report.push(`✅ TOTAL ACTIVE EVENTS: ${allEvents.length}`);
    
    const upcoming = allEvents.filter(e => e.location === 'Upcoming').length;
    const current = allEvents.filter(e => e.location === 'Current').length;
    report.push(`   Upcoming: ${upcoming}`);
    report.push(`   Current: ${current}`);
  } catch (e) {
    report.push(`❌ Error getting active events: ${e.message}`);
  }
  
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: monospace; font-size: 12px; padding: 16px; white-space: pre-wrap; }
      h3 { font-family: Arial, sans-serif; color: #002529; }
    </style>
    <pre>${report.join('\n')}</pre>
  `)
  .setWidth(600)
  .setHeight(500);
  
  ui.showModalDialog(html, 'Folder Access Diagnostic');
}

function diagnoseTemplateAccess() {
  // (kept exactly as your original)
  const ui = SpreadsheetApp.getUi();
  const config = getTemplateConfig();
  
  Logger.log('='.repeat(60));
  Logger.log('TEMPLATE ACCESS DIAGNOSTIC');
  Logger.log('='.repeat(60));
  
  let report = [];
  let hasErrors = false;
  
  report.push('📄 TEMPLATES:');
  
  for (const [key, templateConfig] of Object.entries(config.templates)) {
    const templateId = templateConfig.id;
    
    if (!templateId || templateId === '') {
      report.push(`   ⚠️ ${templateConfig.name}: Not configured (ID is blank)`);
      Logger.log(`⚠️ ${templateConfig.name}: Not configured`);
      continue;
    }
    
    try {
      const file = DriveApp.getFileById(templateId);
      const fileName = file.getName();
      const fileType = file.getMimeType();
      report.push(`   ✅ ${templateConfig.name}`);
      report.push(`      File: "${fileName}"`);
      report.push(`      ID: ${templateId}`);
      report.push(`      Type: ${fileType}`);
      Logger.log(`✅ ${templateConfig.name}: "${fileName}" (${fileType})`);
    } catch (e) {
      report.push(`   ❌ ${templateConfig.name}`);
      report.push(`      ID: ${templateId}`);
      report.push(`      Error: ${e.message}`);
      Logger.log(`❌ ${templateConfig.name} error: ${e.message}`);
      hasErrors = true;
    }
  }
  
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: monospace; font-size: 12px; padding: 16px; white-space: pre-wrap; }
      .success { color: green; }
      .error { color: red; }
      .warning { color: orange; }
      h3 { font-family: Arial, sans-serif; color: #002529; }
    </style>
    <h3>🔍 Template Access Diagnostic</h3>
    <pre>${report.join('\n')}</pre>
    ${hasErrors ? '<p style="color:red; font-family:Arial;"><strong>⚠️ Some templates have errors. See above for details.</strong></p>' : '<p style="color:green; font-family:Arial;"><strong>✅ All configured templates are accessible!</strong></p>'}
  `)
  .setWidth(600)
  .setHeight(400);
  
  ui.showModalDialog(html, 'Template Diagnostic Results');
}

function showTemplateSetupHelper() {
  // (kept exactly as your original)
  const config = getTemplateConfig();
  
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; font-size: 13px; }
      h2 { color: #002529; margin-top: 0; }
      h3 { color: #002529; margin-bottom: 8px; }
      .template-box { background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 12px 0; }
      .template-name { font-weight: bold; color: #002529; }
      .status-ok { color: green; }
      .status-missing { color: orange; }
      .status-error { color: red; }
      code { background: #e0e0e0; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
      .instructions { background: #fff2cc; padding: 12px; border-radius: 8px; margin: 16px 0; }
      .help-text { font-size: 11px; color: #666; }
    </style>
    
    <h2>🔧 Template Setup Helper</h2>
    
    <div class="instructions">
      <strong>How to find a file ID:</strong><br>
      1. Open the template file in Google Drive<br>
      2. Look at the URL in your browser<br>
      3. Copy the long string between <code>/d/</code> and <code>/edit</code><br>
      <br>
      Example: https://docs.google.com/document/d/<strong>1ABC123xyz...</strong>/edit
    </div>
    
    <h3>Current Configuration:</h3>
    
    <div class="template-box">
      <div class="template-name">📁 Upcoming Events Folder</div>
      <div>ID: <code>${config.folders.upcomingEvents}</code></div>
    </div>
    
    <div class="template-box">
      <div class="template-name">📁 Current Event Folder</div>
      <div>ID: <code>${config.folders.currentEvent}</code></div>
    </div>
    
    <div class="template-box">
      <div class="template-name">📄 Itinerary Template</div>
      <div class="${config.templates.itinerary.id ? 'status-ok' : 'status-missing'}">
        ${config.templates.itinerary.id ? 'ID: <code>' + config.templates.itinerary.id + '</code>' : '⚠️ Not configured'}
      </div>
      <div class="help-text">Search terms: ${config.templates.itinerary.searchTerms.join(', ')}</div>
    </div>
    
    <div class="template-box">
      <div class="template-name">📄 Permission Slip Template</div>
      <div class="${config.templates.permissionForm.id ? 'status-ok' : 'status-missing'}">
        ${config.templates.permissionForm.id ? 'ID: <code>' + config.templates.permissionForm.id + '</code>' : '⚠️ Not configured'}
      </div>
      <div class="help-text">Search terms: ${config.templates.permissionForm.searchTerms.join(', ')}</div>
    </div>
    
    <div class="template-box">
      <div class="template-name">📊 Field Trip Data Sheet Template</div>
      <div class="${config.templates.dataSheet.id ? 'status-ok' : 'status-missing'}">
        ${config.templates.dataSheet.id ? 'ID: <code>' + config.templates.dataSheet.id + '</code>' : '⚠️ Not configured'}
      </div>
      <div class="help-text">Search terms: ${config.templates.dataSheet.searchTerms.join(', ')}</div>
    </div>
    
    <div class="instructions">
      <strong>To update template IDs:</strong><br>
      1. Open the script editor (Extensions → Apps Script)<br>
      2. Find <code>TEMPLATE_CONFIG</code> in Triggers.gs<br>
      3. Replace the <code>id:</code> values with your template file IDs<br>
      4. Save the script<br>
      5. Run "🔍 Diagnose Template Access" to verify
    </div>
  `)
  .setWidth(550)
  .setHeight(650);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Template Setup Helper');
}

function findPotentialTemplates() {
  // (kept exactly as your original)
  const ui = SpreadsheetApp.getUi();
  
  Logger.log('Searching for potential template files...');
  
  const searchTerms = [
    { query: 'title contains "itinerary" and title contains "template"', type: 'Itinerary' },
    { query: 'title contains "permission" and title contains "template"', type: 'Permission Form' },
    { query: 'title contains "field trip" and title contains "template"', type: 'Field Trip' },
    { query: 'title contains "field trip data"', type: 'Data Sheet' }
  ];
  
  let results = [];
  
  for (const search of searchTerms) {
    try {
      const files = DriveApp.searchFiles(search.query);
      while (files.hasNext()) {
        const file = files.next();
        results.push({
          name: file.getName(),
          id: file.getId(),
          type: search.type,
          mimeType: file.getMimeType(),
          url: file.getUrl()
        });
      }
    } catch (e) {
      Logger.log(`Search error for ${search.type}: ${e.message}`);
    }
  }
  
  const seen = new Set();
  results = results.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  
  if (results.length === 0) {
    ui.alert('No Templates Found', 
      'Could not find any files matching template search terms.\n\n' +
      'Try searching manually in Drive for your template files.',
      ui.ButtonSet.OK);
    return;
  }
  
  let html = `
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; padding: 12px; }
      h3 { color: #002529; }
      table { border-collapse: collapse; width: 100%; }
      td, th { border: 1px solid #ddd; padding: 6px; text-align: left; }
      th { background: #002529; color: white; }
      .id-cell { font-family: monospace; font-size: 10px; }
      a { color: #1155cc; }
    </style>
    <h3>📂 Potential Template Files Found</h3>
    <p>Click a file name to open it. Copy the ID to use in TEMPLATE_CONFIG.</p>
    <table>
      <tr><th>Type</th><th>File Name</th><th>ID (copy this)</th></tr>
  `;
  
  for (const file of results) {
    html += `<tr>
      <td>${file.type}</td>
      <td><a href="${file.url}" target="_blank">${file.name}</a></td>
      <td class="id-cell">${file.id}</td>
    </tr>`;
  }
  
  html += '</table>';
  
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(700)
    .setHeight(400);
  
  ui.showModalDialog(htmlOutput, 'Potential Template Files');
}


// ============================================================================
// SECTION 8/9/10: TEMPLATE UPDATE FUNCTIONS (UPDATED)
// ============================================================================

/**
 * UPDATED: For itinerary + permission form, regenerate using FieldTripBuilder data
 * rather than copying a raw template (which leaves placeholders).
 *
 * - itinerary: trash existing itinerary doc(s) then call generateItineraryFromFormData(row, folder)
 * - permissionForm: trash existing permission doc/pdf then call generateCustomPermissionForm(row, folder, folderName)
 * - dataSheet: keep old behavior (copy template) because updating in place depends on your sheet structure
 */
function updateTemplatesForFolders(folders, templateKeys) {
  const results = {
    foldersProcessed: 0,
    templatesReplaced: 0,
    templatesAdded: 0,
    errors: [],
    details: []
  };

  const config = getTemplateConfig();

  // Pull FieldTripBuilder data once
  const spreadsheetId = '117q2rtYkkMCy67SDHF0UD3XXuxtESxh-psXUVCdzB-c';
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const builderSheet = ss.getSheetByName('FieldTripBuilder');
  if (!builderSheet) {
    throw new Error('FieldTripBuilder sheet not found.');
  }
  const formData = builderSheet.getRange(2, 1, builderSheet.getLastRow() - 1, 33).getDisplayValues();

  for (const folderInfo of folders) {
    results.foldersProcessed++;

    const folder = folderInfo.folder || DriveApp.getFolderById(folderInfo.id);
    const folderName = folderInfo.name || folder.getName();

    Logger.log(`\n📂 Processing: ${folderName}`);

    // folder name → eventName used in FieldTripBuilder column C
    const match = folderName.match(/^\d{2}_\d{2}_\d{2}(?:-\d{2})?_(.*)/);
    if (!match) {
      results.errors.push(`${folderName}: Malformed folder name (cannot match to FieldTripBuilder)`);
      continue;
    }
    const eventName = match[1];

    // Find matching row
    let matchingRow = null;
    for (let i = 0; i < formData.length; i++) {
      if (formData[i][2] === eventName) { // column C
        matchingRow = formData[i];
        break;
      }
    }
    if (!matchingRow) {
      results.errors.push(`${folderName}: No matching FieldTripBuilder row found for "${eventName}"`);
      continue;
    }

    for (const templateKey of templateKeys) {
      const templateConfig = config.templates[templateKey];

      try {
        if (templateKey === 'itinerary') {
          const existing = findExistingTemplateFiles(folder, templateConfig);
          const hadExisting = existing.length > 0;
          existing.forEach(f => f.setTrashed(true));

          const doc = generateItineraryFromFormData(matchingRow, folder);
          if (!doc) throw new Error('generateItineraryFromFormData returned null');

          results.templatesReplaced += hadExisting ? 1 : 0;
          results.templatesAdded += hadExisting ? 0 : 1;
          results.details.push(`${folderName}: ${hadExisting ? 'Rebuilt' : 'Created'} Itinerary`);
        }

        else if (templateKey === 'permissionForm') {
          const existing = findExistingTemplateFiles(folder, templateConfig);
          const hadExisting = existing.length > 0;
          existing.forEach(f => f.setTrashed(true));

          const pdf = generateCustomPermissionForm(matchingRow, folder, folderName);
          if (!pdf) throw new Error('generateCustomPermissionForm returned null');

          results.templatesReplaced += hadExisting ? 1 : 0;
          results.templatesAdded += hadExisting ? 0 : 1;
          results.details.push(`${folderName}: ${hadExisting ? 'Rebuilt' : 'Created'} Permission Form PDF`);
        }

        else {
          // Original copy-based behavior for dataSheet + any other keys
          if (!templateConfig || !templateConfig.id || templateConfig.id === '') {
            throw new Error(`Template ID not configured for ${templateKey}`);
          }

          const existingFiles = findExistingTemplateFiles(folder, templateConfig);
          const hadExisting = existingFiles.length > 0;
          existingFiles.forEach(f => f.setTrashed(true));

          const templateFile = DriveApp.getFileById(templateConfig.id);
          const eventInfo = parseEventFolderName(folderName);
          const eventDisplayName = eventInfo ? eventInfo.eventName : folderName;

          let newFileName;
          if (templateKey === 'dataSheet') {
            newFileName = `Field Trip Data_${eventDisplayName}`;
          } else if (templateKey === 'itinerary') {
            newFileName = `${eventDisplayName} Itinerary`;
          } else if (templateKey === 'permissionForm') {
            newFileName = `${eventDisplayName} Field Trip Form`;
          } else {
            newFileName = `${eventDisplayName} - ${templateConfig.name}`;
          }

          templateFile.makeCopy(newFileName, folder);

          results.templatesReplaced += hadExisting ? 1 : 0;
          results.templatesAdded += hadExisting ? 0 : 1;
          results.details.push(`${folderName}: ${hadExisting ? 'Replaced' : 'Added'} ${templateConfig.name}`);
        }

      } catch (error) {
        results.errors.push(`${folderName} - ${templateKey}: ${error.message}`);
        Logger.log(`  ❌ Error updating ${templateKey}: ${error.message}`);
      }
    }
  }

  return results;
}


// ============================================================================
// SECTION 8: TEMPLATE UPDATE FUNCTIONS - ALL TRIPS
// ============================================================================

function updateAllTemplatesAllTrips() {
  const ui = SpreadsheetApp.getUi();
  const eventFolders = getActiveEventFolders();
  
  if (eventFolders.length === 0) {
    ui.alert('No Trips Found', 'No active field trip folders found in Upcoming Events or Current Event folders.', ui.ButtonSet.OK);
    return;
  }
  
  const confirm = ui.alert(
    '⚠️ WARNING: Rebuild All Templates',
    `This will rebuild templates for ${eventFolders.length} active field trip(s).\n\n` +
    `• Itinerary + Permission Form will be regenerated from FieldTripBuilder data\n` +
    `• Data Sheet replacement can cause data loss\n\n` +
    `Continue?`,
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;
  
  const results = updateTemplatesForFolders(eventFolders, ['itinerary', 'permissionForm', 'dataSheet']);
  showUpdateResults(results, 'All Templates - All Active Trips');
}

function updateItineraryAllTrips() {
  const ui = SpreadsheetApp.getUi();
  const eventFolders = getActiveEventFolders();
  
  if (eventFolders.length === 0) {
    ui.alert('No Trips Found', 'No active field trip folders found.', ui.ButtonSet.OK);
    return;
  }
  
  const confirm = ui.alert(
    'Rebuild Itineraries',
    `This will rebuild the ITINERARY for ${eventFolders.length} active field trip(s) using FieldTripBuilder data.\n\nContinue?`,
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;
  
  const results = updateTemplatesForFolders(eventFolders, ['itinerary']);
  showUpdateResults(results, 'Itinerary - All Active Trips');
}

function updatePermissionFormAllTrips() {
  const ui = SpreadsheetApp.getUi();
  const eventFolders = getActiveEventFolders();
  
  if (eventFolders.length === 0) {
    ui.alert('No Trips Found', 'No active field trip folders found.', ui.ButtonSet.OK);
    return;
  }
  
  const confirm = ui.alert(
    'Rebuild Permission Forms',
    `This will rebuild the PERMISSION FORM PDF for ${eventFolders.length} active field trip(s) using FieldTripBuilder data.\n\nContinue?`,
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;
  
  const results = updateTemplatesForFolders(eventFolders, ['permissionForm']);
  showUpdateResults(results, 'Permission Form - All Active Trips');
}

function updateDataSheetAllTrips() {
  const ui = SpreadsheetApp.getUi();
  const eventFolders = getActiveEventFolders();
  
  if (eventFolders.length === 0) {
    ui.alert('No Trips Found', 'No active field trip folders found.', ui.ButtonSet.OK);
    return;
  }
  
  const confirm = ui.alert(
    '🛑 DANGER: Replace Data Sheets',
    `This will REPLACE the FIELD TRIP DATA SHEET for ${eventFolders.length} active field trip(s).\n\n` +
    `🛑 CRITICAL WARNING:\n` +
    `• Attendance data may be LOST\n` +
    `• Student information may be LOST\n` +
    `• Script IDs will change (need re-registration)\n\n` +
    `Continue?`,
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;
  
  const results = updateTemplatesForFolders(eventFolders, ['dataSheet']);
  showUpdateResults(results, 'Field Trip Data Sheet - All Active Trips');
}


// ============================================================================
// SECTION 9: TEMPLATE UPDATE FUNCTIONS - SELECT TRIP
// ============================================================================

function updateAllTemplatesSelectTrip() {
  const selectedFolder = showTripSelectionDialog('Update All Templates');
  if (!selectedFolder) return;
  
  const results = updateTemplatesForFolders([selectedFolder], ['itinerary', 'permissionForm', 'dataSheet']);
  showUpdateResults(results, `All Templates - ${selectedFolder.name}`);
}

function updateItinerarySelectTrip() {
  const selectedFolder = showTripSelectionDialog('Update Itinerary');
  if (!selectedFolder) return;
  
  const results = updateTemplatesForFolders([selectedFolder], ['itinerary']);
  showUpdateResults(results, `Itinerary - ${selectedFolder.name}`);
}

function updatePermissionFormSelectTrip() {
  const selectedFolder = showTripSelectionDialog('Update Permission Form');
  if (!selectedFolder) return;
  
  const results = updateTemplatesForFolders([selectedFolder], ['permissionForm']);
  showUpdateResults(results, `Permission Form - ${selectedFolder.name}`);
}

function updateDataSheetSelectTrip() {
  const selectedFolder = showTripSelectionDialog('Update Field Trip Data Sheet');
  if (!selectedFolder) return;
  
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    '⚠️ Confirm Data Sheet Update',
    `You are about to replace the Field Trip Data Sheet for:\n\n` +
    `"${selectedFolder.name}"\n\n` +
    `Any custom data in the existing sheet may be lost.\n\n` +
    `Continue?`,
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;
  
  const results = updateTemplatesForFolders([selectedFolder], ['dataSheet']);
  showUpdateResults(results, `Field Trip Data Sheet - ${selectedFolder.name}`);
}

function showTripSelectionDialog(actionName) {
  // (kept exactly as your original)
  const ui = SpreadsheetApp.getUi();
  const eventFolders = getActiveEventFolders();
  
  if (eventFolders.length === 0) {
    ui.alert('No Trips Found', 'No active field trip folders found in Upcoming Events or Current Event folders.', ui.ButtonSet.OK);
    return null;
  }
  
  let optionsHtml = eventFolders.map((folder, index) => {
    const eventInfo = parseEventFolderName(folder.name);
    const displayName = eventInfo 
      ? `${eventInfo.eventName} (${Utilities.formatDate(eventInfo.eventDate, Session.getScriptTimeZone(), 'MM/dd/yyyy')}) [${folder.location}]`
      : `${folder.name} [${folder.location}]`;
    return `<option value="${index}">${displayName}</option>`;
  }).join('\n');
  
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; }
      h3 { color: #002529; margin-top: 0; }
      select { width: 100%; padding: 8px; font-size: 14px; margin: 12px 0; }
      .buttons { margin-top: 16px; text-align: right; }
      button { padding: 8px 16px; margin-left: 8px; cursor: pointer; }
      .primary { background: #002529; color: white; border: none; border-radius: 4px; }
      .secondary { background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; }
      .info { font-size: 12px; color: #666; margin-bottom: 8px; }
    </style>
    
    <h3>📂 Select Field Trip</h3>
    <p class="info">Showing ${eventFolders.length} active trip(s) from Upcoming Events and Current Event folders.</p>
    <p>Choose a field trip to ${actionName.toLowerCase()}:</p>
    
    <select id="tripSelect">
      ${optionsHtml}
    </select>
    
    <div class="buttons">
      <button class="secondary" onclick="google.script.host.close()">Cancel</button>
      <button class="primary" onclick="selectTrip()">Select</button>
    </div>
    
    <script>
      function selectTrip() {
        const select = document.getElementById('tripSelect');
        google.script.run.withSuccessHandler(() => {
          google.script.host.close();
        }).setSelectedTripIndex(parseInt(select.value));
      }
    </script>
  `)
  .setWidth(500)
  .setHeight(250);
  
  const cache = CacheService.getUserCache();
  cache.put('tripSelectionFolders', JSON.stringify(eventFolders.map(f => ({name: f.name, id: f.id, location: f.location}))), 300);
  cache.remove('selectedTripIndex');
  
  ui.showModalDialog(html, actionName);
  
  Utilities.sleep(500);
  for (let i = 0; i < 60; i++) {
    Utilities.sleep(500);
    const selectedIndex = cache.get('selectedTripIndex');
    if (selectedIndex !== null) {
      const index = parseInt(selectedIndex);
      cache.remove('selectedTripIndex');
      cache.remove('tripSelectionFolders');
      return eventFolders[index];
    }
  }
  
  return null;
}

function setSelectedTripIndex(index) {
  // (kept exactly as your original)
  const cache = CacheService.getUserCache();
  cache.put('selectedTripIndex', index.toString(), 60);
}

function showUpdateResults(results, operationName) {
  // (kept exactly as your original)
  const ui = SpreadsheetApp.getUi();
  
  let message = `✅ ${operationName} Complete!\n\n`;
  message += `Folders processed: ${results.foldersProcessed}\n`;
  message += `Templates replaced: ${results.templatesReplaced}\n`;
  message += `Templates added: ${results.templatesAdded}\n`;
  
  if (results.errors.length > 0) {
    message += `\n⚠️ Errors (${results.errors.length}):\n`;
    message += results.errors.slice(0, 5).join('\n');
    if (results.errors.length > 5) {
      message += `\n...and ${results.errors.length - 5} more`;
    }
  }
  
  if (results.details.length > 0 && results.details.length <= 10) {
    message += `\n\nDetails:\n`;
    message += results.details.join('\n');
  }
  
  ui.alert('Template Update Results', message, ui.ButtonSet.OK);
  
  Logger.log('='.repeat(60));
  Logger.log(`TEMPLATE UPDATE: ${operationName}`);
  Logger.log('='.repeat(60));
  Logger.log(`Folders: ${results.foldersProcessed}`);
  Logger.log(`Replaced: ${results.templatesReplaced}`);
  Logger.log(`Added: ${results.templatesAdded}`);
  Logger.log(`Errors: ${results.errors.length}`);
  results.details.forEach(d => Logger.log(`  - ${d}`));
  results.errors.forEach(e => Logger.log(`  ❌ ${e}`));
}


// ============================================================================
// SECTION 11: TEMPLATE CHECK FUNCTIONS (ADD MISSING ONLY)
// ============================================================================

function checkAndAddMissingTemplates() {
  // (kept exactly as your original)
  const ui = SpreadsheetApp.getUi();
  
  try {
    const config = getTemplateConfig();
    const eventFolders = getActiveEventFolders();
    
    if (eventFolders.length === 0) {
      ui.alert('No Trips Found', 'No active field trip folders found.', ui.ButtonSet.OK);
      return;
    }
    
    let templatesAdded = 0;
    let alreadyComplete = 0;
    let report = [];
    
    for (const folderInfo of eventFolders) {
      const eventFolder = folderInfo.folder;
      const folderName = folderInfo.name;
      const eventInfo = parseEventFolderName(folderName);
      const eventName = eventInfo ? eventInfo.eventName : folderName;
      
      let folderComplete = true;
      
      for (const [templateKey, templateConfig] of Object.entries(config.templates)) {
        if (!templateConfig.id || templateConfig.id === '') continue;
        
        const existingFiles = findExistingTemplateFiles(eventFolder, templateConfig);
        
        if (existingFiles.length === 0) {
          folderComplete = false;
          
          try {
            const templateFile = DriveApp.getFileById(templateConfig.id);
            
            let newFileName;
            if (templateKey === 'dataSheet') {
              newFileName = `Field Trip Data_${eventName}`;
            } else if (templateKey === 'itinerary') {
              newFileName = `${eventName} Itinerary`;
            } else if (templateKey === 'permissionForm') {
              newFileName = `${eventName} Field Trip Form`;
            } else {
              newFileName = `${eventName} - ${templateConfig.name}`;
            }
            
            templateFile.makeCopy(newFileName, eventFolder);
            templatesAdded++;
            report.push(`✅ Added "${templateConfig.name}" to: ${eventName}`);
            
          } catch (e) {
            report.push(`❌ Error adding ${templateConfig.name} to ${eventName}: ${e.message}`);
          }
        }
      }
      
      if (folderComplete) alreadyComplete++;
    }
    
    let message = `✅ Template Check Complete!\n\n`;
    message += `Folders scanned: ${eventFolders.length}\n`;
    message += `Already complete: ${alreadyComplete}\n`;
    message += `Templates added: ${templatesAdded}\n`;
    
    if (report.length > 0) {
      message += `\nDetails:\n${report.slice(0, 10).join('\n')}`;
      if (report.length > 10) {
        message += `\n...and ${report.length - 10} more`;
      }
    } else {
      message += `\nAll folders already have their templates! 🎉`;
    }
    
    ui.alert('Template Check Results', message, ui.ButtonSet.OK);
    
  } catch (error) {
    ui.alert('Error', `Something went wrong:\n${error.message}`, ui.ButtonSet.OK);
    Logger.log(`Template check error: ${error.message}`);
  }
}

function checkAndAddMissingTemplatesCurrentYear() {
  checkAndAddMissingTemplates();
}

function showTemplateStatusReport() {
  // (kept exactly as your original)
  const ui = SpreadsheetApp.getUi();
  
  try {
    const config = getTemplateConfig();
    const eventFolders = getActiveEventFolders();
    
    if (eventFolders.length === 0) {
      ui.alert('No Trips Found', 'No active field trip folders found.', ui.ButtonSet.OK);
      return;
    }
    
    const templateNames = Object.values(config.templates).map(t => t.name);
    
    let html = `
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 8px; }
        h3 { color: #002529; margin: 8px 0; }
        table { border-collapse: collapse; width: 100%; margin-top: 8px; }
        td, th { border: 1px solid #ddd; padding: 6px; text-align: left; }
        th { background: #002529; color: white; }
        .complete { color: green; font-weight: bold; }
        .missing { color: red; font-weight: bold; }
        .location { font-size: 10px; color: #666; }
      </style>
      <h3>📋 Active Field Trip Template Status</h3>
      <p>Showing ${eventFolders.length} active trip(s) from Upcoming Events and Current Event folders.</p>
      <table>
        <tr>
          <th>Event</th>
          <th>Location</th>
    `;
    
    for (const name of templateNames) {
      html += `<th>${name}</th>`;
    }
    html += `</tr>`;
    
    for (const folderInfo of eventFolders) {
      const eventInfo = parseEventFolderName(folderInfo.name);
      const displayName = eventInfo 
        ? `${eventInfo.eventName}<br><span class="location">${Utilities.formatDate(eventInfo.eventDate, Session.getScriptTimeZone(), 'MM/dd/yyyy')}</span>`
        : folderInfo.name;
      
      html += `<tr><td>${displayName}</td><td>${folderInfo.location}</td>`;
      
      for (const [key, templateConfig] of Object.entries(config.templates)) {
        const existingFiles = findExistingTemplateFiles(folderInfo.folder, templateConfig);
        html += existingFiles.length > 0 
          ? '<td class="complete">✓</td>' 
          : '<td class="missing">✗</td>';
      }
      
      html += '</tr>';
    }
    
    html += '</table>';
    
    const htmlOutput = HtmlService.createHtmlOutput(html)
      .setWidth(700)
      .setHeight(500);
    
    ui.showModalDialog(htmlOutput, 'Template Status Report');
    
  } catch (error) {
    ui.alert('Error', `Could not generate report:\n${error.message}`, ui.ButtonSet.OK);
  }
}


// ============================================================================
// SECTION 12: ON OPEN MENU
// ============================================================================

function onOpen() {
  // (kept exactly as your original)
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('🚌 Field Trip Tools')
    .addSubMenu(ui.createMenu('📋 Template Check')
      .addItem('Check & Add Missing Templates', 'checkAndAddMissingTemplates')
      .addItem('View Template Status Report', 'showTemplateStatusReport'))
    .addSeparator()
    .addSubMenu(ui.createMenu('🔄 Update Templates')
      .addItem('Update All Templates - All Active Trips', 'updateAllTemplatesAllTrips')
      .addItem('Update All Templates - Select Trip...', 'updateAllTemplatesSelectTrip')
      .addSeparator()
      .addItem('Update Itinerary Only - All Active Trips', 'updateItineraryAllTrips')
      .addItem('Update Itinerary Only - Select Trip...', 'updateItinerarySelectTrip')
      .addSeparator()
      .addItem('Update Permission Form Only - All Active Trips', 'updatePermissionFormAllTrips')
      .addItem('Update Permission Form Only - Select Trip...', 'updatePermissionFormSelectTrip')
      .addSeparator()
      .addItem('Update Data Sheet Only - All Active Trips', 'updateDataSheetAllTrips')
      .addItem('Update Data Sheet Only - Select Trip...', 'updateDataSheetSelectTrip'))
    .addSeparator()
    .addSubMenu(ui.createMenu('📜 Push Scripts')
      .addItem('Push Script to All Tracked Sheets', 'pushScriptToAllTracked')
      .addItem('Push Script to Selected Sheet...', 'pushScriptToSelected')
      .addSeparator()
      .addItem('Update Folder Tracker Database', 'updateFolderTrackerDatabase')
      .addSeparator()
      .addItem('🔍 Test Script Push Setup', 'testScriptPushSetup')
      .addItem('❓ How Script IDs Work', 'showScriptIdInstructions'))
    .addSeparator()
    .addSubMenu(ui.createMenu('🔧 Setup & Diagnostics')
      .addItem('🔍 Diagnose Folder Access', 'diagnoseFolderAccess')
      .addItem('🔍 Diagnose Template Access', 'diagnoseTemplateAccess')
      .addItem('📋 View Setup Helper', 'showTemplateSetupHelper')
      .addItem('🔎 Find Potential Templates in Drive', 'findPotentialTemplates'))
    .addSeparator()
    .addSubMenu(ui.createMenu('⚙️ Trigger Management')
      .addItem('🔍 Audit All Field Trip Triggers', 'auditAllFieldTripTriggers')
      .addItem('🧹 Generate Cleanup Checklist', 'generateCleanupChecklist')
      .addItem('📝 Generate Cleanup Instructions', 'generateCleanupInstructions')
      .addSeparator()
      .addItem('❓ Trigger Management Help', 'showTriggerManagementHelp'))
    .addToUi();
}


// ============================================================================
// SECTION 13: SCRIPT PUSH FUNCTIONALITY
// ============================================================================

const SCRIPT_TEMPLATE_CONFIG = {
  dataSheet: {
    templateSpreadsheetId: '1vQ3IJSx1bf5KhCC7q7zQVot-DM5UL8I7SbzFl5S15fk',
    name: 'Field Trip Data Script'
  }
};

function getTemplateScriptId() {
  const templateId = '1vQ3IJSx1bf5KhCC7q7zQVot-DM5UL8I7SbzFl5S15fk';
  
  try {
    const templateSS = SpreadsheetApp.openById(templateId);
    const setupSheet = templateSS.getSheetByName('Setup');
    
    if (setupSheet) {
      const scriptId = setupSheet.getRange('A2').getValue();
      if (scriptId) {
        Logger.log(`📋 Template Script ID: ${scriptId}`);
        return scriptId;
      }
    }
    
    Logger.log('⚠️ No Script ID found in template Setup!A2');
    return null;
    
  } catch (e) {
    Logger.log(`❌ Error getting template Script ID: ${e.message}`);
    return null;
  }
}

function getScriptContent(scriptId) {
  const token = ScriptApp.getOAuthToken();
  const url = `https://script.googleapis.com/v1/projects/${scriptId}/content`;
  
  Logger.log(`📖 Fetching script content for: ${scriptId}`);
  
  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    const contentText = response.getContentText();
    
    Logger.log(`   Response code: ${code}`);
    
    if (code === 200) {
      const content = JSON.parse(contentText);
      Logger.log(`   ✅ Found ${content.files.length} files`);
      return content;
    } else {
      Logger.log(`   ❌ Failed: ${contentText}`);
      return null;
    }
  } catch (e) {
    Logger.log(`   ❌ Error: ${e.message}`);
    return null;
  }
}

function pushScriptContent(targetScriptId, content) {
  const token = ScriptApp.getOAuthToken();
  const url = `https://script.googleapis.com/v1/projects/${targetScriptId}/content`;
  
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(content),
      muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    if (code === 200) {
      Logger.log('✅ Script content pushed successfully');
      return true;
    } else {
      Logger.log(`❌ Push failed: ${code} - ${response.getContentText()}`);
      return false;
    }
  } catch (e) {
    Logger.log(`❌ Error pushing script: ${e.message}`);
    return false;
  }
}

function pushScriptToAllTracked() {
  // (kept exactly as your original)
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.openById(FOLDER_TRACKER_CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(FOLDER_TRACKER_CONFIG.sheetName);
  
  if (!sheet) {
    ui.alert('Error', 'FolderTracker sheet not found.', ui.ButtonSet.OK);
    return;
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    ui.alert('No Data', 'No spreadsheets found in FolderTracker.', ui.ButtonSet.OK);
    return;
  }
  
  const data = sheet.getRange(2, 2, lastRow - 1, 6).getValues();
  
  const tracked = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i][3]) {
      tracked.push({
        rowNum: i + 2,
        eventName: data[i][0],
        spreadsheetId: data[i][2],
        scriptId: data[i][3]
      });
    }
  }
  
  if (tracked.length === 0) {
    ui.alert('No Script IDs', 
      'No spreadsheets with Script IDs found in FolderTracker.\n\n' +
      'Script IDs are automatically registered when you open each Field Trip Data spreadsheet.',
      ui.ButtonSet.OK);
    return;
  }
  
  const templateSpreadsheetId = '1vQ3IJSx1bf5KhCC7q7zQVot-DM5UL8I7SbzFl5S15fk';
  let templateScriptId = null;
  
  try {
    const templateSS = SpreadsheetApp.openById(templateSpreadsheetId);
    const setupSheet = templateSS.getSheetByName('Setup');
    if (setupSheet) {
      templateScriptId = setupSheet.getRange('A2').getValue();
    }
  } catch (e) {
    ui.alert('Error', `Could not access template spreadsheet: ${e.message}`, ui.ButtonSet.OK);
    return;
  }
  
  if (!templateScriptId) {
    ui.alert('Error', 
      'Could not find template Script ID.\n\n' +
      'Please open the Field Trip Data Template and ensure the Script ID is in Setup!A2.',
      ui.ButtonSet.OK);
    return;
  }
  
  const confirm = ui.alert(
    '🔄 Push Scripts to All Tracked Spreadsheets',
    `This will push the template script to ${tracked.length} spreadsheet(s):\n\n` +
    tracked.map(t => `• ${t.eventName}`).slice(0, 10).join('\n') +
    (tracked.length > 10 ? `\n...and ${tracked.length - 10} more` : '') +
    '\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  
  if (confirm !== ui.Button.YES) return;
  
  const content = getScriptContent(templateScriptId);
  if (!content) {
    ui.alert('Error', 'Could not read template script content.', ui.ButtonSet.OK);
    return;
  }
  
  let success = 0;
  let failed = 0;
  const errors = [];
  
  for (const item of tracked) {
    try {
      const result = pushScriptContent(item.scriptId, content);
      
      if (result) {
        success++;
        sheet.getRange(item.rowNum, 6).setValue(new Date());
      } else {
        failed++;
        errors.push(`${item.eventName}: Push failed`);
      }
    } catch (e) {
      failed++;
      errors.push(`${item.eventName}: ${e.message}`);
    }
    
    Utilities.sleep(500);
  }
  
  let message = `Script Push Complete!\n\n`;
  message += `✅ Success: ${success}\n`;
  message += `❌ Failed: ${failed}\n`;
  
  if (errors.length > 0) {
    message += `\nErrors:\n${errors.slice(0, 5).join('\n')}`;
    if (errors.length > 5) {
      message += `\n...and ${errors.length - 5} more`;
    }
  }
  
  ui.alert('Script Push Results', message, ui.ButtonSet.OK);
}

function pushScriptToSelected() {
  // (kept exactly as your original)
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.openById(FOLDER_TRACKER_CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(FOLDER_TRACKER_CONFIG.sheetName);
  
  if (!sheet) {
    ui.alert('Error', 'FolderTracker sheet not found.', ui.ButtonSet.OK);
    return;
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    ui.alert('No Data', 'No spreadsheets found in FolderTracker.', ui.ButtonSet.OK);
    return;
  }
  
  const data = sheet.getRange(2, 2, lastRow - 1, 6).getValues();
  const tracked = [];
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][3]) {
      tracked.push({
        rowNum: i + 2,
        eventName: data[i][0],
        spreadsheetId: data[i][2],
        scriptId: data[i][3]
      });
    }
  }
  
  if (tracked.length === 0) {
    ui.alert('No Script IDs', 
      'No spreadsheets with Script IDs found in FolderTracker.',
      ui.ButtonSet.OK);
    return;
  }
  
  let optionsHtml = tracked.map((item, index) => {
    return `<option value="${index}">${item.eventName}</option>`;
  }).join('\n');
  
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; }
      h3 { color: #002529; margin-top: 0; }
      select { width: 100%; padding: 8px; font-size: 14px; margin: 12px 0; }
      .buttons { margin-top: 16px; text-align: right; }
      button { padding: 8px 16px; margin-left: 8px; cursor: pointer; }
      .primary { background: #002529; color: white; border: none; border-radius: 4px; }
      .secondary { background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; }
    </style>
    
    <h3>📝 Select Spreadsheet</h3>
    <p>Choose a spreadsheet to push the template script to:</p>
    
    <select id="sheetSelect">
      ${optionsHtml}
    </select>
    
    <div class="buttons">
      <button class="secondary" onclick="google.script.host.close()">Cancel</button>
      <button class="primary" onclick="selectSheet()">Push Script</button>
    </div>
    
    <script>
      function selectSheet() {
        const select = document.getElementById('sheetSelect');
        google.script.run
          .withSuccessHandler(() => google.script.host.close())
          .executePushToSelectedSheet(parseInt(select.value));
      }
    </script>
  `)
  .setWidth(450)
  .setHeight(220);
  
  const cache = CacheService.getUserCache();
  cache.put('trackedSheetsForPush', JSON.stringify(tracked), 300);
  
  ui.showModalDialog(html, 'Push Script to Selected');
}

function executePushToSelectedSheet(index) {
  // (kept exactly as your original)
  const cache = CacheService.getUserCache();
  const trackedJson = cache.get('trackedSheetsForPush');
  
  if (!trackedJson) {
    Logger.log('❌ Tracked sheets cache expired');
    return;
  }
  
  const tracked = JSON.parse(trackedJson);
  const selected = tracked[index];
  
  if (!selected) {
    Logger.log('❌ Invalid selection index');
    return;
  }
  
  cache.remove('trackedSheetsForPush');
  
  const templateScriptId = getTemplateScriptId();
  if (!templateScriptId) {
    SpreadsheetApp.getUi().alert('Error', 'Could not find template Script ID.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  const content = getScriptContent(templateScriptId);
  if (!content) {
    SpreadsheetApp.getUi().alert('Error', 'Could not read template script content.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  Logger.log(`📝 Pushing script to: ${selected.eventName}`);
  const result = pushScriptContent(selected.scriptId, content);
  
  if (result) {
    const ss = SpreadsheetApp.openById(FOLDER_TRACKER_CONFIG.spreadsheetId);
    const sheet = ss.getSheetByName(FOLDER_TRACKER_CONFIG.sheetName);
    sheet.getRange(selected.rowNum, 6).setValue(new Date());
    
    SpreadsheetApp.getUi().alert('Success', `✅ Script pushed to "${selected.eventName}"`, SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    SpreadsheetApp.getUi().alert('Failed', `❌ Could not push script to "${selected.eventName}"`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function showScriptIdInstructions() {
  // (kept exactly as your original)
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; font-size: 13px; }
      h2 { color: #002529; margin-top: 0; }
      h3 { color: #002529; }
      ol { line-height: 1.8; }
      .note { background: #fff2cc; padding: 12px; border-radius: 8px; margin: 16px 0; }
      code { background: #e0e0e0; padding: 2px 6px; border-radius: 4px; }
    </style>
    
    <h2>📋 How to Get Script IDs</h2>
    
    <p>Each Field Trip Data spreadsheet has its own bound script project with a unique Script ID. 
    To push script updates, you need to add these IDs to the FolderTracker sheet.</p>
    
    <h3>For each spreadsheet:</h3>
    <ol>
      <li>Open the Field Trip Data spreadsheet</li>
      <li>Go to <strong>Extensions → Apps Script</strong></li>
      <li>In the script editor, click the <strong>⚙️ gear icon</strong> (Project Settings)</li>
      <li>Copy the <strong>Script ID</strong></li>
      <li>Paste it into the <strong>Script ID</strong> column (D) in FolderTracker</li>
    </ol>
    
    <div class="note">
      <strong>💡 Tip:</strong> You only need to do this once per spreadsheet. 
      After the Script ID is saved, you can push updates anytime from the menu.
    </div>
    
    <h3>Important:</h3>
    <p>Each target spreadsheet's script project must also have:</p>
    <ul>
      <li>The Apps Script API enabled</li>
      <li>Be linked to your GCP project (<code>303749720535</code>)</li>
    </ul>
    <p>Otherwise the push will fail with a permission error.</p>
  `)
  .setWidth(550)
  .setHeight(480);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Script ID Instructions');
}

function testScriptPushSetup() {
  // (kept exactly as your original)
  const ui = SpreadsheetApp.getUi();
  let report = [];
  
  report.push('🔍 SCRIPT PUSH SETUP TEST');
  report.push('='.repeat(50));
  
  report.push('\n1. Template Script ID:');
  const templateScriptId = getTemplateScriptId();
  if (templateScriptId) {
    report.push(`   ✅ Found: ${templateScriptId}`);
  } else {
    report.push('   ❌ NOT FOUND - Check template Setup!A2');
  }
  
  report.push('\n2. Template Script Content:');
  if (templateScriptId) {
    try {
      const content = getScriptContent(templateScriptId);
      if (content) {
        report.push(`   ✅ Readable: ${content.files.length} files`);
        for (const file of content.files) {
          report.push(`      • ${file.name} (${file.type})`);
        }
      } else {
        report.push('   ❌ Could not read content');
      }
    } catch (e) {
      report.push(`   ❌ Error: ${e.message}`);
    }
  } else {
    report.push('   ⏭️ Skipped (no template Script ID)');
  }
  
  report.push('\n3. FolderTracker Status:');
  try {
    const ss = SpreadsheetApp.openById(FOLDER_TRACKER_CONFIG.spreadsheetId);
    const sheet = ss.getSheetByName(FOLDER_TRACKER_CONFIG.sheetName);
    
    if (sheet) {
      const lastRow = sheet.getLastRow();
      const data = lastRow > 1 ? sheet.getRange(2, 2, lastRow - 1, 6).getValues() : [];
      
      const total = data.length;
      const withScriptId = data.filter(r => r[3]).length;
      const ready = data.filter(r => r[5] === 'Ready').length;
      
      report.push(`   ✅ Sheet found`);
      report.push(`   Total spreadsheets: ${total}`);
      report.push(`   With Script IDs: ${withScriptId}`);
      report.push(`   Ready for push: ${ready}`);
    } else {
      report.push('   ❌ FolderTracker sheet not found');
    }
  } catch (e) {
    report.push(`   ❌ Error: ${e.message}`);
  }
  
  report.push('\n' + '='.repeat(50));
  
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: monospace; font-size: 12px; padding: 16px; white-space: pre-wrap; }
    </style>
    <pre>${report.join('\n')}</pre>
  `)
  .setWidth(600)
  .setHeight(450);
  
  ui.showModalDialog(html, 'Script Push Setup Test');
}


// ============================================================================
// SECTION 14: SCRIPT ID TRACKING & DATABASE
// ============================================================================

/**
 * Configuration for the FolderTracker sheet
 */
const FOLDER_TRACKER_CONFIG = {
  spreadsheetId: '117q2rtYkkMCy67SDHF0UD3XXuxtESxh-psXUVCdzB-c',
  sheetName: 'FolderTracker',
  columns: {
    // Column A is reserved for other script
    eventName: 2,     // B - Event Name
    folderId: 3,      // C - Folder ID
    spreadsheetId: 4, // D - Field Trip Data Spreadsheet ID
    scriptId: 5,      // E - Script Project ID
    lastUpdated: 6,   // F - Last Script Update
    status: 7         // G - Status
  },
  headerRow: 1
};

function ensureFolderTrackerCalendarIdColumns_() {
  const ss = SpreadsheetApp.openById(FOLDER_TRACKER_CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(FOLDER_TRACKER_CONFIG.sheetName);
  if (!sheet) throw new Error('FolderTracker sheet not found');

  sheet.getRange('H1').setValue('Permission Deadline Event ID');
  sheet.getRange('I1').setValue('Trip Event ID - Day 1');
  sheet.getRange('J1').setValue('Trip Event ID - Day 2');
  sheet.getRange('K1').setValue('Trip Event ID - Day 3');
  sheet.getRange('L1').setValue('Trip Event ID - Day 4');
  sheet.getRange('M1').setValue('Trip Event ID - Day 5');
}


function getFolderTrackerRowByFolderId_(folderId) {
  const ss = SpreadsheetApp.openById(FOLDER_TRACKER_CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(FOLDER_TRACKER_CONFIG.sheetName);
  if (!sheet) throw new Error('FolderTracker sheet not found');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  // Folder ID is column C
  const folderIds = sheet.getRange(2, 3, lastRow - 1, 1).getValues().flat();
  const idx = folderIds.findIndex(v => String(v).trim() === String(folderId).trim());
  if (idx === -1) return null;

  return { sheet, row: idx + 2 };
}

function getCalendarIdsForFolder_(folderId) {
  const hit = getFolderTrackerRowByFolderId_(folderId);
  if (!hit) return { deadlineId: '', mainId: '' };

  const deadlineId = hit.sheet.getRange(hit.row, 8).getValue(); // H
  const mainId = hit.sheet.getRange(hit.row, 9).getValue();     // I
  return { deadlineId, mainId };
}

function setCalendarIdsForFolder_(folderId, { deadlineId, mainId }) {
  const hit = getFolderTrackerRowByFolderId_(folderId);
  if (!hit) return;

  if (deadlineId) hit.sheet.getRange(hit.row, 8).setValue(deadlineId); // H
  if (mainId) hit.sheet.getRange(hit.row, 9).setValue(mainId);         // I
}




/**
 * Sets up the FolderTracker headers if not already present
 */
function setupFolderTrackerHeaders() {
  const ss = SpreadsheetApp.openById(FOLDER_TRACKER_CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(FOLDER_TRACKER_CONFIG.sheetName);
  
  if (!sheet) {
    Logger.log('❌ FolderTracker sheet not found');
    return;
  }
  
  // Check if headers exist
  const headers = sheet.getRange(1, 1, 1, 6).getValues()[0];
  
  // Set headers if column B onwards is empty
  if (!headers[1]) {
    sheet.getRange(1, 2, 1, 5).setValues([[
      'Event Name',
      'Spreadsheet ID', 
      'Script ID',
      'Last Script Update',
      'Status'
    ]]);
    
    // Format header row
    sheet.getRange(1, 1, 1, 6)
      .setFontWeight('bold')
      .setBackground('#002529')
      .setFontColor('#ffffff');
    
    // Set column widths
    sheet.setColumnWidth(1, 200);  // Folder ID
    sheet.setColumnWidth(2, 200);  // Event Name
    sheet.setColumnWidth(3, 280);  // Spreadsheet ID
    sheet.setColumnWidth(4, 280);  // Script ID
    sheet.setColumnWidth(5, 140);  // Last Updated
    sheet.setColumnWidth(6, 100);  // Status
    
    Logger.log('✅ FolderTracker headers set up');
  }
}


/**
 * Scans the Field Trips folder for all Field Trip Data spreadsheets
 * and populates the FolderTracker sheet with their info
 * Writes to columns B-G, leaving column A untouched
 * Also pulls Script IDs from each spreadsheet's Setup!A2
 */
function updateFolderTrackerDatabase() {
  ensureFolderTrackerCalendarIdColumns_();
  const ss = SpreadsheetApp.openById(FOLDER_TRACKER_CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(FOLDER_TRACKER_CONFIG.sheetName);
  
  if (!sheet) {
    Logger.log('❌ FolderTracker sheet not found');
    return;
  }
  
  // Set up headers in B1:G1 (leave A alone)
  sheet.getRange(1, 2, 1, 6).setValues([[
    'Event Name',
    'Folder ID',
    'Spreadsheet ID', 
    'Script ID',
    'Last Script Update',
    'Status'
  ]]);
  
  sheet.getRange(1, 2, 1, 6)
    .setFontWeight('bold')
    .setBackground('#002529')
    .setFontColor('#ffffff');
  
  // Get existing data to preserve Last Updated timestamps
  const lastRow = sheet.getLastRow();
  let existingData = {};
  
  if (lastRow > 1) {
    const data = sheet.getRange(2, 2, lastRow - 1, 6).getValues();
    for (const row of data) {
      if (row[2]) { // Has spreadsheet ID (column D)
        existingData[row[2]] = {
          lastUpdated: row[4]    // Column F
        };
      }
    }
  }
  
  // Field Trips parent folder
  const fieldTripsFolderId = '1oy8tn_fNRH902LgRHgX_aRHHmYO3ugbB';
  const foundSheets = [];
  const seenSpreadsheetIds = new Set(); // Track duplicates
  
  Logger.log('🔍 Scanning Field Trips folder for Field Trip Data spreadsheets...');
  
  try {
    const parentFolder = DriveApp.getFolderById(fieldTripsFolderId);
    searchFolderForDataSheets(parentFolder, foundSheets, seenSpreadsheetIds);
  } catch (e) {
    Logger.log(`❌ Error accessing Field Trips folder: ${e.message}`);
    return;
  }
  
  Logger.log(`📊 Found ${foundSheets.length} unique Field Trip Data spreadsheets`);
  
  if (foundSheets.length === 0) {
    Logger.log('No spreadsheets found');
    return;
  }
  
  // Sort by event name (handle undefined)
  foundSheets.sort((a, b) => {
    const nameA = a.eventName || '';
    const nameB = b.eventName || '';
    return nameA.localeCompare(nameB);
  });
  
  // Build output data, fetching Script IDs from each spreadsheet's Setup!A2
  const outputData = [];
  
  for (const item of foundSheets) {
    let scriptId = '';
    let status = 'Needs Script ID';
    
    // Try to get Script ID from the spreadsheet's Setup!A2
    try {
      const targetSS = SpreadsheetApp.openById(item.spreadsheetId);
      const setupSheet = targetSS.getSheetByName('Setup');
      
      if (setupSheet) {
        const fetchedScriptId = setupSheet.getRange('A2').getValue();
        if (fetchedScriptId) {
          scriptId = fetchedScriptId;
          status = 'Ready';
          Logger.log(`   🔑 Found Script ID for ${item.eventName}: ${scriptId}`);
        }
      }
    } catch (e) {
      Logger.log(`   ⚠️ Could not access Setup sheet for ${item.eventName}: ${e.message}`);
    }
    
    const lastUpdated = existingData[item.spreadsheetId]?.lastUpdated || '';
    
    outputData.push({
      eventName: item.eventName || '',
      folderId: item.folderId || '',
      spreadsheetId: item.spreadsheetId || '',
      scriptId: scriptId,
      lastUpdated: lastUpdated,
      status: status
    });
    
    Logger.log(`Row: ${item.eventName} | ${status}`);
  }
  
  // Clear existing data in B2:G (leave column A alone)
  if (lastRow > 1) {
    Logger.log(`Clearing B2:G${lastRow}`);
    sheet.getRange(2, 2, lastRow - 1, 6).clearContent();
  }
  
  // Write data row by row with clickable ID links
  if (outputData.length > 0) {
    Logger.log(`Writing ${outputData.length} rows with clickable ID links`);
    
    for (let i = 0; i < outputData.length; i++) {
      const rowNum = i + 2;
      const data = outputData[i];
      
      // Column B - Event Name (plain text)
      sheet.getRange(rowNum, 2).setValue(data.eventName);
      
      // Column C - Folder ID (ID as clickable link)
      if (data.folderId) {
        const folderUrl = `https://drive.google.com/drive/folders/${data.folderId}`;
        const folderRichText = SpreadsheetApp.newRichTextValue()
          .setText(data.folderId)
          .setLinkUrl(folderUrl)
          .build();
        sheet.getRange(rowNum, 3).setRichTextValue(folderRichText);
      }
      
      // Column D - Spreadsheet ID (ID as clickable link)
      if (data.spreadsheetId) {
        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`;
        const spreadsheetRichText = SpreadsheetApp.newRichTextValue()
          .setText(data.spreadsheetId)
          .setLinkUrl(spreadsheetUrl)
          .build();
        sheet.getRange(rowNum, 4).setRichTextValue(spreadsheetRichText);
      }
      
      // Column E - Script ID (ID as clickable link)
      if (data.scriptId) {
        const scriptUrl = `https://script.google.com/home/projects/${data.scriptId}/edit`;
        const scriptRichText = SpreadsheetApp.newRichTextValue()
          .setText(data.scriptId)
          .setLinkUrl(scriptUrl)
          .build();
        sheet.getRange(rowNum, 5).setRichTextValue(scriptRichText);
      } else {
        sheet.getRange(rowNum, 5).setValue('');
      }
      
      // Column F - Last Updated
      sheet.getRange(rowNum, 6).setValue(data.lastUpdated);
      
      // Column G - Status
      sheet.getRange(rowNum, 7).setValue(data.status);
    }
    
    SpreadsheetApp.flush();
    Logger.log(`✅ Wrote ${outputData.length} rows with clickable ID links`);
  }
  
  // Set column widths for B-G
  sheet.setColumnWidth(2, 250);  // Event Name
  sheet.setColumnWidth(3, 280);  // Folder ID
  sheet.setColumnWidth(4, 280);  // Spreadsheet ID
  sheet.setColumnWidth(5, 280);  // Script ID
  sheet.setColumnWidth(6, 140);  // Last Updated
  sheet.setColumnWidth(7, 120);  // Status
  
  Logger.log(`\n📊 FolderTracker update complete!`);
  Logger.log(`   Total spreadsheets: ${foundSheets.length}`);
}


/**
 * Recursively searches a folder and its subfolders for Field Trip Data spreadsheets
 * @param {Folder} folder - The folder to search
 * @param {Array} results - Array to collect results
 * @param {Set} seenSpreadsheetIds - Set to deduplicate spreadsheet IDs
 * @param {number} depth - Current recursion depth (for logging)
 */
function searchFolderForDataSheets(folder, results, seenSpreadsheetIds = new Set(), depth = 0) {
  const indent = '  '.repeat(depth);
  Logger.log(`${indent}📂 Searching: ${folder.getName()}`);
  
  // Search files in this folder
  const files = folder.getFiles();
  
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    
    // Check if this is a Field Trip Data spreadsheet
    const isDataSheet =
      (fileName.includes('Field Trip Data_') || fileName.includes(' - Field Trip Data')) &&
      file.getMimeType() === MimeType.GOOGLE_SHEETS;
    
    if (!isDataSheet) continue;

    const ssId = file.getId();
    if (seenSpreadsheetIds.has(ssId)) {
      continue; // skip duplicates
    }
    seenSpreadsheetIds.add(ssId);

    let parentFolderId = '';
    let parentFolderName = '';
    
    try {
      const parents = file.getParents();
      if (parents.hasNext()) {
        const parentFolder = parents.next();
        parentFolderId = parentFolder.getId();
        parentFolderName = parentFolder.getName();
      }
    } catch (e) {
      Logger.log(`${indent}   ⚠️ Could not get parent folder for ${fileName}`);
    }
    
    const eventInfo = parseEventFolderName(parentFolderName);
    const eventName = eventInfo
      ? eventInfo.eventName
      : (parentFolderName || fileName.replace('Field Trip Data_', '').replace(' - Field Trip Data', ''));
    
    results.push({
      folderId: parentFolderId,
      eventName: eventName,
      spreadsheetId: ssId
    });
    
    Logger.log(`${indent}✅ Found: ${eventName}`);
  }
  
  // Search subfolders
  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    const subfolder = subfolders.next();
    Utilities.sleep(100); // Avoid rate limiting
    searchFolderForDataSheets(subfolder, results, seenSpreadsheetIds, depth + 1);
  }
}


/**
 * Gets all tracked spreadsheets that have Script IDs
 * @returns {Array} Array of {folderId, eventName, spreadsheetId, scriptId, lastUpdated, status} objects
 */
function getTrackedSpreadsheets() {
  const ss = SpreadsheetApp.openById(FOLDER_TRACKER_CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(FOLDER_TRACKER_CONFIG.sheetName);
  
  if (!sheet) {
    Logger.log('❌ FolderTracker sheet not found');
    return [];
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const tracked = [];
  
  for (const row of data) {
    if (row[0] && row[2] && row[3]) {
      tracked.push({
        folderId: row[0],
        eventName: row[1],
        spreadsheetId: row[2],
        scriptId: row[3],
        lastUpdated: row[4],
        status: row[5]
      });
    }
  }
  
  return tracked;
}


/**
 * Updates the "Last Script Update" timestamp for a spreadsheet in FolderTracker
 * @param {string} spreadsheetId - The spreadsheet that was updated
 */
function updateScriptPushTimestamp(spreadsheetId) {
  const ss = SpreadsheetApp.openById(FOLDER_TRACKER_CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(FOLDER_TRACKER_CONFIG.sheetName);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // Spreadsheet ID is column D
  const spreadsheetIds = sheet.getRange(2, 4, lastRow - 1, 1).getValues();

  for (let i = 0; i < spreadsheetIds.length; i++) {
    if (spreadsheetIds[i][0] === spreadsheetId) {
      const rowNum = i + 2;
      sheet.getRange(rowNum, 6).setValue(new Date());     // Column F
      sheet.getRange(rowNum, 7).setValue('Updated');      // Column G (or keep status as-is if you prefer)
      break;
    }
  }
}



/**
 * Attempts to get the bound script project ID for a spreadsheet
 * Uses the Apps Script API to find projects bound to the container
 * @param {string} spreadsheetId - The spreadsheet ID
 * @returns {string|null} The script project ID, or null if not found
 */
function getBoundScriptIdForSpreadsheet(spreadsheetId) {
  const token = ScriptApp.getOAuthToken();
  const url = `https://script.googleapis.com/v1/projects?parent=spreadsheets/${spreadsheetId}`;
  
  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    const content = response.getContentText();
    
    Logger.log(`Response for ${spreadsheetId}: ${code} - ${content.substring(0, 200)}`);
    
    if (code === 200) {
      const data = JSON.parse(content);
      if (data.projects && data.projects.length > 0) {
        return data.projects[0].scriptId;
      }
    }
  } catch (e) {
    Logger.log(`Error getting script ID for ${spreadsheetId}: ${e.message}`);
  }
  
  return null;
}


/**
 * Updates the FolderTracker with Script IDs by querying the Apps Script API
 */
function fetchScriptIdsForTrackedSheets() {
  const ss = SpreadsheetApp.openById(FOLDER_TRACKER_CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(FOLDER_TRACKER_CONFIG.sheetName);
  
  if (!sheet) {
    Logger.log('❌ FolderTracker sheet not found');
    return;
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No data in FolderTracker');
    return;
  }
  
  // Get spreadsheet IDs from column D (index 4)
  const data = sheet.getRange(2, 2, lastRow - 1, 6).getValues();
  
  let found = 0;
  let notFound = 0;
  
  for (let i = 0; i < data.length; i++) {
    const eventName = data[i][0];
    const spreadsheetId = data[i][2]; // Column D
    const existingScriptId = data[i][3]; // Column E
    
    if (!spreadsheetId) continue;
    
    if (existingScriptId) {
      Logger.log(`⏭️ ${eventName}: Already has Script ID`);
      continue;
    }
    
    Logger.log(`🔍 ${eventName}: Looking up Script ID...`);
    Utilities.sleep(500);
    
    const scriptId = getBoundScriptIdForSpreadsheet(spreadsheetId);
    
    if (scriptId) {
      const rowNum = i + 2;
      sheet.getRange(rowNum, 5).setValue(scriptId); // Column E
      sheet.getRange(rowNum, 7).setValue('Ready');  // Column G
      Logger.log(`   ✅ Found: ${scriptId}`);
      found++;
    } else {
      Logger.log(`   ❌ No script found`);
      notFound++;
    }
  }
  
  Logger.log(`\n📊 Script ID fetch complete: ${found} found, ${notFound} not found`);
}


/**
 * FIXED: Push script to a single tracked spreadsheet
 * Replaces broken reference to SCRIPT_TEMPLATE_CONFIG.dataSheet.scriptId
 */
function pushScriptToSingle(item) {
  const ui = SpreadsheetApp.getUi();

  try {
    const templateScriptId = getTemplateScriptId();
    if (!templateScriptId) throw new Error('Template Script ID not found in template Setup!A2');

    const content = getScriptContent(templateScriptId);
    if (!content) throw new Error('Could not read template script content.');

    Logger.log(`📝 Pushing script to: ${item.eventName}`);
    const result = pushScriptContent(item.scriptId, content);

    if (result) {
      updateScriptPushTimestamp(item.spreadsheetId);
      ui.alert('Success', `✅ Script pushed to "${item.eventName}"`, ui.ButtonSet.OK);
    } else {
      ui.alert('Failed', `❌ Could not push script to "${item.eventName}"`, ui.ButtonSet.OK);
    }
  } catch (e) {
    ui.alert('Error', `❌ Error: ${e.message}`, ui.ButtonSet.OK);
  }
}

/**
 * Trigger Audit → writes installed trigger inventory to:
 *   - Headers: Trigger Audit!K2 onward (row 2)
 *   - Data:    Trigger Audit!K3 onward
 *   - Column summaries (TEXTJOIN-style): row 1 (K1 onward), including header label
 *
 * Columns included:
 *  1) Trigger ID
 *  2) Function called
 *  3) Event type
 *  4) Source
 *  5) Unique ID
 *  6) Trigger type details
 *
 * Update: Preserves column widths (no auto-resize creep).
 */
function auditInstalledTriggersToSheet() {
  const SHEET_NAME = 'Trigger Audit';
  const START_CELL_A1 = 'K2'; // headers start here (row 2)

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet not found: ${SHEET_NAME}`);

  const triggers = ScriptApp.getProjectTriggers();

  const safe_ = (v) => (v === null || v === undefined) ? '' : String(v);

  const getEventTypeLabel_ = (t) => {
    try {
      return t.getEventType ? safe_(t.getEventType()) : '';
    } catch (e) {
      return '';
    }
  };

  const getSourceLabel_ = (t) => {
    try {
      return t.getTriggerSource ? safe_(t.getTriggerSource()) : '';
    } catch (e) {
      return '';
    }
  };

  const getSourceId_ = (t) => {
    try {
      return t.getTriggerSourceId ? safe_(t.getTriggerSourceId()) : '';
    } catch (e) {
      return '';
    }
  };

  const getDetails_ = (t) => {
    // There is no API to read clock frequency (hourly/daily) or form/spreadsheet event subtype.
    // But we can at least include sourceId for context, and a helpful label for clock triggers.
    const eventType = getEventTypeLabel_(t);
    const sourceId = getSourceId_(t);

    if (eventType === 'CLOCK') {
      return 'Time-driven (schedule details not exposed by ScriptApp)';
    }

    // For spreadsheet/form triggers, sourceId helps identify which container.
    return sourceId ? `sourceId=${sourceId}` : '';
  };

  const headers = [
    'Trigger ID',
    'Function called',
    'Event type',
    'Source',
    'Unique ID',
    'Trigger type details'
  ];

  const rows = triggers.map(t => {
    const triggerId = safe_(t.getUniqueId && t.getUniqueId()); // effectively the trigger's unique ID
    const handler = safe_(t.getHandlerFunction && t.getHandlerFunction());
    const eventType = getEventTypeLabel_(t);
    const source = getSourceLabel_(t);
    const uniqueId = safe_(t.getUniqueId && t.getUniqueId());
    const details = getDetails_(t);

    return [triggerId, handler, eventType, source, uniqueId, details];
  });

  // Write starting positions
  const start = sheet.getRange(START_CELL_A1);
  const startRow = start.getRow();
  const startCol = start.getColumn();
  const width = headers.length;

  // ✅ Preserve existing column widths (so the audit does not expand columns over time)
  const priorWidths = [];
  for (let c = 0; c < width; c++) {
    priorWidths.push(sheet.getColumnWidth(startCol + c));
  }

  // Clear previous audit block in this region (row 1 downward, same width)
  const maxRowsToClear = Math.max(sheet.getMaxRows(), 1);
  sheet.getRange(1, startCol, maxRowsToClear, width).clearContent();

  // Headers in row 2
  sheet.getRange(startRow, startCol, 1, width).setValues([headers]);

  // Data in row 3+
  if (rows.length) {
    sheet.getRange(startRow + 1, startCol, rows.length, width).setValues(rows);
  }

  // Row 1 summaries per column: "Header: v1 | v2 | v3"
  const summaries = headers.map((h, idx) => {
    const colValues = rows.map(r => safe_(r[idx])).filter(v => v !== '');
    const joined = colValues.length ? colValues.join(' | ') : '(none)';
    return `${h}: ${joined}`;
  });
  sheet.getRange(1, startCol, 1, width).setValues([summaries]);

  // Light formatting
  sheet.getRange(1, startCol, 2, width).setFontWeight('bold');

  // ✅ Restore prior widths (prevents auto-resize "creep")
  for (let c = 0; c < width; c++) {
    sheet.setColumnWidth(startCol + c, priorWidths[c]);
  }
}


function authorizeTriggerAudit() {
  // Any call that forces the ScriptApp scope prompt works.
  // This will prompt for the permissions needed to read project triggers.
  ScriptApp.getProjectTriggers();
}


/**
 * Nightly maintenance: move folders between Parent / Upcoming / Closed
 * and archive prior-year events into Archive/YY_YY_Field Trips.
 *
 * Safe to run daily (no template generation, no sharing).
 */
function nightlyFolderOrganizationMaintenance() {
  Logger.log('🌙 Nightly maintenance: organizing field trip folders...');
  organizeFieldTripFolders();
  Logger.log('✅ Nightly maintenance complete.');
}



