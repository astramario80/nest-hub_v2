// ========== Master Function ==========

/**
 * MASTER FUNCTION - Complete Field Trip Workflow
 * Runs all field trip management tasks in the correct order
 */
function runCompleteFieldTripWorkflow() {
  Logger.log('🚀 ========================================');
  Logger.log('🚀 STARTING COMPLETE FIELD TRIP WORKFLOW');
  Logger.log('🚀 ========================================\n');
  
  try {
    // STEP 1: Create/update event folders and ensure subfolders exist
    Logger.log('📋 STEP 1: Managing field trip folders...');
    manageFieldTripFolders();
    Logger.log('✅ Step 1 complete\n');
    Utilities.sleep(2000);
    
    // STEP 2: Organize folders by date (archive old, close past, organize upcoming)
    Logger.log('📋 STEP 2: Organizing folders by date...');
    organizeFieldTripFolders();
    Logger.log('✅ Step 2 complete\n');
    Utilities.sleep(2000);
    
    // STEP 3: Copy templates (PDF, Data sheet, Itinerary) to new folders
    Logger.log('📋 STEP 3: Copying templates to event folders...');
    copyTemplatesToEventFolders();
    Logger.log('✅ Step 3 complete\n');
    Utilities.sleep(2000);
    
    // STEP 4: Share folders with correct students (adds/removes as needed)
    Logger.log('📋 STEP 4: Sharing folders with students...');
    shareEventFoldersWithStudents();
    Logger.log('✅ Step 4 complete\n');
    
    Logger.log('🎉 ========================================');
    Logger.log('🎉 COMPLETE WORKFLOW FINISHED SUCCESSFULLY!');
    Logger.log('🎉 ========================================');
    
    try {
      SpreadsheetApp.getUi().alert(
        'Field Trip Workflow Complete!\n\n' +
        '✅ Folders created/updated\n' +
        '✅ Folders organized by date\n' +
        '✅ Templates copied\n' +
        '✅ Folders shared with students\n\n' +
        'ℹ️ Each event spreadsheet will auto-update attendance every 30 minutes'
      );
    } catch (e) {
      Logger.log('📝 Note: UI alert skipped (running from script editor)');
    }
    
  } catch (error) {
    Logger.log('❌ ERROR in workflow: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}


// ========== ANCHOR + PLACEHOLDER HELPERS (NEW) ==========

const NEST_FIELDTRIP_ANCHOR_START = '[[NEST_FIELDTRIP_START]]';
const NEST_FIELDTRIP_ANCHOR_END   = '[[NEST_FIELDTRIP_END]]';

/**
 * Escapes regex special characters for DocumentApp.replaceText()
 */
function escapeForDocRegex_(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replaces placeholders in a document body.
 * We do not truly restrict replacements to the anchored block (DocumentApp has no easy scoped replace),
 * but since your placeholders are unique tokens like {{TripName}}, this is safe.
 * Anchors are still useful for future "update-in-place" logic.
 */
function replacePlaceholdersInDoc_(doc, placeholderMap) {
  const body = doc.getBody();

  // If anchors are missing, still proceed (generation will still work).
  const hasStart = !!body.findText(escapeForDocRegex_(NEST_FIELDTRIP_ANCHOR_START));
  const hasEnd = !!body.findText(escapeForDocRegex_(NEST_FIELDTRIP_ANCHOR_END));
  if (!hasStart || !hasEnd) {
    Logger.log('⚠️ Anchors not found in doc (still replacing placeholders globally).');
  }

  Object.keys(placeholderMap).forEach(token => {
    const value = placeholderMap[token];
    body.replaceText(escapeForDocRegex_(token), String(value ?? ''));
  });
}

function parentHasAnyEventFolders_(parentFolder) {
  const it = parentFolder.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    const name = f.getName();
    // event folders start with YY_MM_DD...
    if (/^\d{2}_\d{2}_\d{2}/.test(name)) return true;
  }
  return false;
}


/**
 * Parses Field Trip folder names:
 *   YY_MM_DD_Event
 *   YY_MM_DD-DD_Event   (end day within same month)
 *
 * Returns { startDate: Date, endDate: Date, startYear: number, schoolYear: string } or null.
 */
function parseFieldTripFolderDates_(folderName) {
  const m = String(folderName).match(/^(\d{2})_(\d{2})_(\d{2})(?:-(\d{2}))?_/);
  if (!m) return null;

  const yy = parseInt(m[1], 10);
  const year = 2000 + yy;
  const monthIndex = parseInt(m[2], 10) - 1; // 0-based
  const startDay = parseInt(m[3], 10);
  const endDay = m[4] ? parseInt(m[4], 10) : startDay;

  const startDate = new Date(year, monthIndex, startDay);
  const endDate = new Date(year, monthIndex, endDay);

  // Normalize to midnight
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  // Determine school year based on START date (keeps your existing behavior)
  const eventYear = startDate.getFullYear();
  const eventMonth = startDate.getMonth(); // 0=Jan ... 7=Aug
  const schoolYear = (eventMonth >= 7)
    ? `${eventYear}_${eventYear + 1}`
    : `${eventYear - 1}_${eventYear}`;

  return {
    startDate,
    endDate,
    startYear: year,
    schoolYear
  };
}



// ========== FOLDER Function ==========

function manageFieldTripFolders() {
  Logger.log("🚀 Starting manageFieldTripFolders");
  
  var ss = SpreadsheetApp.openById('117q2rtYkkMCy67SDHF0UD3XXuxtESxh-psXUVCdzB-c');
  var builderSheet = ss.getSheetByName('FieldTripBuilder');
  
  if (!builderSheet) {
    Logger.log("❌ FieldTripBuilder sheet not found.");
    return;
  }
  
  var dbSS = SpreadsheetApp.openById('12yZuGqPRJnm0GfiAf6OSrsc10K13ZW0rlx5mwbVNqDE');
  var scheduleSheet = dbSS.getSheetByName('Schedule');
  var schoolYear = scheduleSheet.getRange('A2').getValue().toString().trim();
  
  Logger.log("📅 Current school year: " + schoolYear);
  
  var yearParts = schoolYear.split('_');
  var currentStartYear = parseInt(yearParts[0]);
  var currentEndYear = parseInt(yearParts[1]);
  
  var parentFolderId = '1oy8tn_fNRH902LgRHgX_aRHHmYO3ugbB';
  var archiveFolderId = '1Ao26lQSGvDiCxoFeLSOVuYza5Zv4Qihs';
  
  var parentFolder = DriveApp.getFolderById(parentFolderId);
  var archiveFolder = DriveApp.getFolderById(archiveFolderId);
  
  archiveOldFieldTripFolders(parentFolder, archiveFolder, currentStartYear, currentEndYear);
  
  var lastRow = builderSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("⚠️ No form responses found.");
    return;
  }
  
  var data = builderSheet.getRange(2, 1, lastRow - 1, 33).getDisplayValues();
  
  var foldersCreated = 0;
  var foldersUpdated = 0;
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var result = createOrUpdateFieldTripFolder(row, parentFolder);
    foldersCreated += result.created;
    foldersUpdated += result.updated;
  }
  
  var message = '🏁 Finished. Created ' + foldersCreated + ' folders, updated ' + foldersUpdated + ' folders.';
  Logger.log(message);
  
  try {
    SpreadsheetApp.getUi().alert('Field Trip Folders:\nCreated: ' + foldersCreated + '\nUpdated: ' + foldersUpdated);
  } catch (e) {
    Logger.log('📝 Note: UI alert skipped (running from script editor)');
  }
}

function createOrUpdateFieldTripFolder(row, parentFolder) {
  var result = { created: 0, updated: 0 };
  
  var tripName = row[2];
  if (!tripName) return result;
  
  var days = [
    { date: row[9] },
    { date: row[14] },
    { date: row[19] },
    { date: row[24] },
    { date: row[29] }
  ];
  
  var validDays = days.filter(d => d.date).map(d => new Date(d.date));
  
  if (validDays.length === 0) return result;
  
  validDays.sort(function(a, b) { return a - b; });
  
  var firstDay = validDays[0];
  var lastDay = validDays[validDays.length - 1];
  
  var folderName = formatFieldTripFolderName(tripName, firstDay, lastDay);
  
  Logger.log("📁 Processing folder: " + folderName);
  
  var existingFolder = findFolderByName(parentFolder, folderName);
  
  if (!existingFolder) {
    var upcomingFolder = DriveApp.getFolderById('12zXeHSjAUYyQDI7ALcIZ1l3R44MMpLGh');
    existingFolder = findFolderByName(upcomingFolder, folderName);
    if (existingFolder) {
      Logger.log("🔄 Folder exists in Upcoming Events: " + folderName);
    }
  }
  
  if (!existingFolder) {
    var closedFolder = DriveApp.getFolderById('15rPkgef5lSwchl8-TEH4CZ-bWGP0Whme');
    existingFolder = findFolderByName(closedFolder, folderName);
    if (existingFolder) {
      Logger.log("🔄 Folder exists in Closed Events: " + folderName);
    }
  }
  
  if (existingFolder) {
    ensureEventSubfolders(existingFolder);
    result.updated++;
  } else {
    Logger.log("✨ Creating new folder: " + folderName);
    var newFolder = parentFolder.createFolder(folderName);
    ensureEventSubfolders(newFolder);
    result.created++;
  }
  
  return result;
}

function organizeFieldTripFolders() {
  const FIELD_TRIPS_PARENT_ID = '1oy8tn_fNRH902LgRHgX_aRHHmYO3ugbB';
  const UPCOMING_EVENTS_ID = '12zXeHSjAUYyQDI7ALcIZ1l3R44MMpLGh';
  const CLOSED_EVENTS_ID = '15rPkgef5lSwchl8-TEH4CZ-bWGP0Whme';
  const ARCHIVE_FOLDER_ID = '1Ao26lQSGvDiCxoFeLSOVuYza5Zv4Qihs';
  
  Logger.log("📂 Starting organizeFieldTripFolders");
  
  const dbSS = SpreadsheetApp.openById('12yZuGqPRJnm0GfiAf6OSrsc10K13ZW0rlx5mwbVNqDE');
  const scheduleSheet = dbSS.getSheetByName('Schedule');
  const schoolYear = scheduleSheet.getRange('A2').getValue().toString().trim();
  
  Logger.log(`📅 Current school year: ${schoolYear}`);
  
  const yearParts = schoolYear.split('_');
  const currentStartYear = parseInt(yearParts[0], 10);
  const currentEndYear = parseInt(yearParts[1], 10);

  /**
   * Parses Field Trip folder names:
   *   YY_MM_DD_Event
   *   YY_MM_DD-DD_Event   (end day within same month)
   *
   * Returns { startDate: Date, endDate: Date, startYear: number, schoolYear: string } or null.
   *
   * - START date is used for "Parent vs Upcoming" window (relative to TODAY).
   * - END date is used for "Past vs Future" logic (closing).
   */
  function parseFieldTripFolderDates_(folderName) {
    const m = String(folderName).match(/^(\d{2})_(\d{2})_(\d{2})(?:-(\d{2}))?_/);
    if (!m) return null;

    const yy = parseInt(m[1], 10);
    const year = 2000 + yy;
    const monthIndex = parseInt(m[2], 10) - 1; // 0-based
    const startDay = parseInt(m[3], 10);
    const endDay = m[4] ? parseInt(m[4], 10) : startDay;

    const startDate = new Date(year, monthIndex, startDay);
    const endDate = new Date(year, monthIndex, endDay);

    // Normalize to midnight
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    // Determine school year based on START date (keeps existing behavior)
    const eventYear = startDate.getFullYear();
    const eventMonth = startDate.getMonth(); // 0=Jan ... 7=Aug
    const derivedSchoolYear = (eventMonth >= 7)
      ? `${eventYear}_${eventYear + 1}`
      : `${eventYear - 1}_${eventYear}`;

    return {
      startDate,
      endDate,
      startYear: year,
      schoolYear: derivedSchoolYear
    };
  }
  
  try {
    const parentFolder = DriveApp.getFolderById(FIELD_TRIPS_PARENT_ID);
    const upcomingFolder = DriveApp.getFolderById(UPCOMING_EVENTS_ID);
    const closedFolder = DriveApp.getFolderById(CLOSED_EVENTS_ID);
    const archiveFolder = DriveApp.getFolderById(ARCHIVE_FOLDER_ID);
    
    const allEventFolders = [];
    
    // Parent (excluding special subfolders)
    const parentFolders = parentFolder.getFolders();
    while (parentFolders.hasNext()) {
      const folder = parentFolders.next();
      if (folder.getId() !== UPCOMING_EVENTS_ID && 
          folder.getId() !== CLOSED_EVENTS_ID &&
          folder.getId() !== ARCHIVE_FOLDER_ID) {
        allEventFolders.push({ folder: folder, location: 'parent' });
      }
    }
    
    // Upcoming
    const upcomingFolders = upcomingFolder.getFolders();
    while (upcomingFolders.hasNext()) {
      allEventFolders.push({ folder: upcomingFolders.next(), location: 'upcoming' });
    }
    
    // Closed
    const closedFolders = closedFolder.getFolders();
    while (closedFolders.hasNext()) {
      allEventFolders.push({ folder: closedFolders.next(), location: 'closed' });
    }
    
    Logger.log(`📊 Found ${allEventFolders.length} total event folders to process`);
    
    const eventData = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < allEventFolders.length; i++) {
      const folderObj = allEventFolders[i];
      const folder = folderObj.folder;
      const folderName = folder.getName();
      
      Logger.log(`\n  🔍 ${folderName}`);
      
      let eventStartDate = null;
      let eventEndDate = null;
      let folderSchoolYear = null;
      let folderStartYear = null;

      // eventDate kept for compatibility and represents END date
      let eventDate = null;
      
      const parsed = parseFieldTripFolderDates_(folderName);
      if (parsed) {
        eventStartDate = parsed.startDate;
        eventEndDate = parsed.endDate;
        eventDate = eventEndDate;                 // ✅ END date drives Past/Close logic
        folderSchoolYear = parsed.schoolYear;
        folderStartYear = parsed.startYear;
        
        Logger.log(`    📅 Start: ${Utilities.formatDate(eventStartDate, Session.getScriptTimeZone(), 'MM/dd/yyyy')}`);
        Logger.log(`    📅 End:   ${Utilities.formatDate(eventEndDate, Session.getScriptTimeZone(), 'MM/dd/yyyy')}`);
        Logger.log(`    📚 School year: ${folderSchoolYear}`);
      } else {
        Logger.log(`    ⚠️ Cannot parse date from folder name`);
      }
      
      eventData.push({
        folder: folder,
        folderName: folderName,

        // ✅ END date (or null)
        eventDate: eventDate,
        eventEndDate: eventEndDate,

        // ✅ START date (or null)
        eventStartDate: eventStartDate,

        schoolYear: folderSchoolYear,
        folderStartYear: folderStartYear,
        currentLocation: folderObj.location
      });
    }
    
    // Old-year events: based on startYear vs currentStartYear (keeps existing rule)
    const oldYearEvents = eventData.filter(event => 
      event.folderStartYear && event.folderStartYear < currentStartYear
    );
    
    // Current-year events: based on derived schoolYear and parseable dates
    const currentYearEvents = eventData.filter(event => 
      event.schoolYear === schoolYear && event.eventDate !== null
    );
    
    const unparseableEvents = eventData.filter(event => !event.eventDate);
    
    Logger.log(`\n📊 Event categorization:`);
    Logger.log(`  🗄️ Old school year events: ${oldYearEvents.length}`);
    Logger.log(`  📅 Current school year events: ${currentYearEvents.length}`);
    Logger.log(`  ❓ Unparseable events: ${unparseableEvents.length}`);
    
    let movedCount = 0;
    
    // ========== 1) Archive old-year events ==========
    if (oldYearEvents.length > 0) {
      Logger.log(`\n🗄️ Archiving old school year events:`);
      for (let event of oldYearEvents) {
        Logger.log(`  📦 ${event.folderName} (Year: ${event.folderStartYear})`);
        
        const schoolYearFolder = getOrCreateSchoolYearFolder(archiveFolder, event.folderStartYear);
        
        try {
          event.folder.moveTo(schoolYearFolder);
          Logger.log(`    ✅ Moved to ${schoolYearFolder.getName()}`);
          movedCount++;
        } catch (e) {
          Logger.log(`    ❌ Error: ${e.message}`);
        }
      }
    }
    
    // ========== 2) Current year: Close past events (END date), and place future events ==========
    if (currentYearEvents.length === 0) {
      Logger.log('\n⚠️ No events found for current school year.');
    } else {
      // Past/future split uses END date so multi-day events don't close early.
      const pastEvents = currentYearEvents.filter(event => event.eventDate < today);       // ✅ END date
      const futureEvents = currentYearEvents.filter(event => event.eventDate >= today);   // ✅ END date
      
      Logger.log(`\n📋 Current school year breakdown:`);
      Logger.log(`  🔙 Past events (by END date): ${pastEvents.length}`);
      Logger.log(`  ⏭️ Future events (by END date): ${futureEvents.length}`);
      
      // ---- Move past events to Closed Events ----
      if (pastEvents.length > 0) {
        Logger.log(`\n📦 Moving past events to Closed Events (END date < today):`);
        for (let event of pastEvents) {
          if (event.currentLocation !== 'closed') {
            moveFieldTripFolder(event.folder, closedFolder, event.currentLocation);
            Logger.log(`  ✅ Closed: ${event.folderName}`);
            movedCount++;
          } else {
            Logger.log(`  ✓ Already closed: ${event.folderName}`);
          }
        }
      }

      // ---- Place future events: "Next event is always Parent" + 28-day window from TODAY ----
      if (futureEvents.length > 0) {
        // Sort by START date so "next upcoming" is futureEvents[0]
        futureEvents.sort((a, b) => (a.eventStartDate - b.eventStartDate));

        const windowEnd = new Date(today.getTime() + (28 * 24 * 60 * 60 * 1000)); // today + 28 days
        windowEnd.setHours(0, 0, 0, 0);

        const nextEvent = futureEvents[0];

        Logger.log(`\n📦 Future events placement:`);
        Logger.log(`   Today: ${Utilities.formatDate(today, Session.getScriptTimeZone(), 'MM/dd/yyyy')}`);
        Logger.log(`   Parent window END (+28d): ${Utilities.formatDate(windowEnd, Session.getScriptTimeZone(), 'MM/dd/yyyy')}`);
        if (nextEvent) {
          Logger.log(`   Next upcoming (by START date): ${nextEvent.folderName} (${Utilities.formatDate(nextEvent.eventStartDate || nextEvent.eventDate, Session.getScriptTimeZone(), 'MM/dd/yyyy')})`);
        }

        // ✅ Always pin the next upcoming event into Parent
        if (nextEvent && nextEvent.currentLocation !== 'parent') {
          Logger.log(`\n📌 Forcing NEXT upcoming event into Parent: ${nextEvent.folderName}`);
          moveFieldTripFolder(nextEvent.folder, parentFolder, nextEvent.currentLocation);
          nextEvent.currentLocation = 'parent'; // keep in-memory state consistent
          movedCount++;
        } else if (nextEvent) {
          Logger.log(`\n📌 Next upcoming event already in Parent: ${nextEvent.folderName}`);
        }

        // Now apply the window rule to all future events (including nextEvent, which should remain Parent)
        Logger.log(`\n📦 Applying rules (Parent if NEXT event OR START date within next 28 days):`);
        for (let event of futureEvents) {
          const start = event.eventStartDate || event.eventDate; // fallback safety
          if (!start) continue;

          const isNextEvent = nextEvent && (event.folder.getId() === nextEvent.folder.getId());
          const withinWindow = start.getTime() <= windowEnd.getTime();
          const shouldBeInParent = isNextEvent || withinWindow;

          if (shouldBeInParent) {
            if (event.currentLocation !== 'parent') {
              moveFieldTripFolder(event.folder, parentFolder, event.currentLocation);
              Logger.log(`  ✅ Parent: ${event.folderName}${isNextEvent ? ' (NEXT)' : withinWindow ? ' (within 28d)' : ''}`);
              movedCount++;
            } else {
              Logger.log(`  ✓ Already parent: ${event.folderName}${isNextEvent ? ' (NEXT)' : withinWindow ? ' (within 28d)' : ''}`);
            }
          } else {
            if (event.currentLocation !== 'upcoming') {
              moveFieldTripFolder(event.folder, upcomingFolder, event.currentLocation);
              Logger.log(`  ✅ Upcoming: ${event.folderName}`);
              movedCount++;
            } else {
              Logger.log(`  ✓ Already upcoming: ${event.folderName}`);
            }
          }
        }
      }
    }
    
    const message = `\n🏁 Organization complete! Moved ${movedCount} folders.`;
    Logger.log(message);

    try {
      SpreadsheetApp.getUi().alert(`Field Trip Organization Complete!\n\nTotal moved: ${movedCount} folders`);
    } catch (e) {
      Logger.log('📝 Note: UI alert skipped (running from script editor)');
    }
    
  } catch (e) {
    Logger.log(`❌ Error: ${e.message}`);
    throw e;
  }
}





// ========== FOLDER Templates ==========

function copyTemplatesToEventFolders() {
  const spreadsheetId = '117q2rtYkkMCy67SDHF0UD3XXuxtESxh-psXUVCdzB-c';
  const eventFolderId = '1oy8tn_fNRH902LgRHgX_aRHHmYO3ugbB';
  const upcomingFolderId = '12zXeHSjAUYyQDI7ALcIZ1l3R44MMpLGh';
  const templateFolderId = '1MG7nZ5GueVeJEGjn7m3tEN0oBBB5tw3k';

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const builderSheet = ss.getSheetByName('FieldTripBuilder');
    
    if (!builderSheet) throw new Error('FieldTripBuilder sheet not found.');

    const eventParent = DriveApp.getFolderById(eventFolderId);
    const upcomingFolder = DriveApp.getFolderById(upcomingFolderId);
    const templateFolder = DriveApp.getFolderById(templateFolderId);
    const templateFiles = getFilesAsMap(templateFolder);

    Logger.log('🧩 Templates found in the template folder:');
    templateFiles.forEach((file, key) => {
      Logger.log(`  - ${file.getName()} (${file.getMimeType()})`);
    });

    // Get 33 columns (A:AG) for new form structure with transportation
    const formData = builderSheet.getRange(2, 1, builderSheet.getLastRow() - 1, 33).getDisplayValues();
    
    // Collect folders from Parent and Upcoming Events (IGNORE FolderTracker)
    const allFolders = [];
    
    Logger.log('\n📁 Collecting folders from Parent folder...');
    const parentFolders = eventParent.getFolders();
    while (parentFolders.hasNext()) {
      const folder = parentFolders.next();
      // Skip special subfolders
      if (folder.getId() !== upcomingFolderId && 
          folder.getId() !== '15rPkgef5lSwchl8-TEH4CZ-bWGP0Whme' && // Closed Events
          folder.getId() !== '1Ao26lQSGvDiCxoFeLSOVuYza5Zv4Qihs') { // Archive
        allFolders.push({ folder: folder, location: 'Parent' });
        Logger.log(`  ✓ ${folder.getName()}`);
      }
    }
    
    Logger.log('\n📁 Collecting folders from Upcoming Events...');
    const upcomingFolders = upcomingFolder.getFolders();
    while (upcomingFolders.hasNext()) {
      const folder = upcomingFolders.next();
      allFolders.push({ folder: folder, location: 'Upcoming' });
      Logger.log(`  ✓ ${folder.getName()}`);
    }
    
    Logger.log(`\n📊 Found ${allFolders.length} total event folders to process\n`);
    
    let templatesAdded = 0;
    let foldersProcessed = 0;
    
    // Process each folder
    for (let i = 0; i < allFolders.length; i++) {
      const folderObj = allFolders[i];
      const folder = folderObj.folder;
      const folderName = folder.getName();
      
      Logger.log(`\n${'='.repeat(80)}`);
      Logger.log(`➡️ Processing: ${folderName} (${folderObj.location})`);
      Logger.log(`   Folder ID: ${folder.getId()}`);
      Logger.log(`${'='.repeat(80)}`);

      const existingFiles = getFilesAsMap(folder);
      const existingNames = Array.from(existingFiles.values()).map(f => f.getName());
      Logger.log('  📄 Existing files in folder:');
      if (existingNames.length === 0) {
        Logger.log('     (no files)');
      } else {
        existingNames.forEach(n => Logger.log(`     - ${n}`));
      }

      // Extract event name from folder (format: YY_MM_DD_EventName or YY_MM_DD-DD_EventName)
      let eventName = '';
      const dateMatch = folderName.match(/^\d{2}_\d{2}_\d{2}(?:-\d{2})?_(.*)/);

      if (!dateMatch) {
        Logger.log(`  ⚠️ Skipping malformed folder name: ${folderName}`);
        continue;
      }

      eventName = dateMatch[1]; // Everything after the date prefix
      const fullEventName = folderName;

      // Find matching form row for this event
      var matchingRow = null;
      for (var j = 0; j < formData.length; j++) {
        if (formData[j][2] === eventName) {
          matchingRow = formData[j];
          Logger.log(`  ✅ Found matching form data for: ${eventName}`);
          break;
        }
      }

      // Get student emails for this event
      var studentEmails = [];
      if (matchingRow) {
        var studentSelection = matchingRow[8]; // Column I
        var studentData = parseStudentsAndPeriods(studentSelection);
        studentEmails = getStudentEmails(studentData.students);
        Logger.log(`  👥 Found ${studentEmails.length} student emails for this event`);
      } else {
        Logger.log(`  ⚠️ No matching form data found, skipping student sharing`);
      }

      let pdfUrl = '';
      let pdfAdded = false;
      let dataAdded = false;
      let itineraryAdded = false;

      const fieldTripDataTemplateFile = Array.from(templateFiles.values()).find(f =>
        f.getName().trim().toLowerCase().startsWith('field trip data')
      );

      // ========== 1. GENERATE ITINERARY ==========
      const itineraryExists = existingNames.some(n => n.includes('Itinerary'));
      
      if (!itineraryExists && matchingRow) {
        Logger.log(`\n  📝 Itinerary missing - generating from template...`);
        var itineraryDoc = generateItineraryFromFormData(matchingRow, folder);
        if (itineraryDoc) {
          itineraryAdded = true;
          templatesAdded++;
          Logger.log(`  ✅ Generated itinerary: ${itineraryDoc.getName()}`);
        }
      } else if (itineraryExists) {
        Logger.log(`  ✓ Itinerary already exists`);
      } else {
        Logger.log(`  ⚠️ Cannot generate itinerary - no form data found`);
      }

      // ========== 2. GENERATE PERMISSION FORM (PDF) ==========
      const pdfExists = existingNames.some(n => n.includes('Field Trip Form'));
      
      if (!pdfExists && matchingRow) {
        Logger.log(`\n  📋 Permission Form missing - generating custom form...`);
        
        const pdfFile = generateCustomPermissionForm(matchingRow, folder, fullEventName);
        
        if (pdfFile) {
          pdfAdded = true;
          templatesAdded++;
          pdfUrl = pdfFile.getUrl();
          Logger.log(`  ✅ Generated custom permission form: ${pdfFile.getName()}`);
        } else {
          Logger.log(`  ⚠️ Could not generate permission form - falling back to generic template`);
          
          // Fallback: Copy generic PDF if custom generation fails
          templateFiles.forEach((templateFile, templateFileName) => {
            const mime = templateFile.getMimeType();
            const lowerName = normalizeFileName(templateFileName);

            if (mime === MimeType.PDF && lowerName.includes('field trip parent permission')) {
              const copied = templateFile.makeCopy(folder);
              copied.setName(`${fullEventName} Field Trip Form.pdf`);
              pdfUrl = copied.getUrl();
              pdfAdded = true;
              templatesAdded++;
              Logger.log(`  ✅ Copied generic PDF template as fallback`);
            }
          });
        }
      } else if (pdfExists) {
        Logger.log(`  ✓ Permission Form already exists`);
      } else {
        Logger.log(`  ⚠️ Cannot generate permission form - no form data found`);
      }

      // ========== 3. CHECK AND COPY FIELD TRIP DATA SPREADSHEET ==========
      const dataSheetExists = existingNames.some(n => n.toLowerCase().includes('field trip data'));

      if (fieldTripDataTemplateFile && !dataSheetExists) {
        Logger.log(`\n  📊 Field Trip Data sheet missing - copying template...`);
        
        const copied = fieldTripDataTemplateFile.makeCopy(folder);
        copied.setName(`Field Trip Data_${eventName}`);
        dataAdded = true;
        templatesAdded++;
        
        // ... (your existing remaining code can go here)
      } else if (dataSheetExists) {
        Logger.log(`  ✓ Field Trip Data sheet already exists - skipping`);
      } else {
        Logger.log(`  ⚠️ Field Trip Data template not found in template folder`);
      }

      // ========== 4. SHARE FOLDER WITH STUDENTS ==========
      if (studentEmails.length > 0) {
        Logger.log(`\n  🔐 Checking folder sharing with students...`);
        
        const currentViewers = folder.getViewers().map(u => u.getEmail().toLowerCase());
        let newShares = 0;
        let alreadyShared = 0;
        
        studentEmails.forEach(email => {
          if (currentViewers.includes(email.toLowerCase())) {
            alreadyShared++;
          } else {
            try {
              folder.addViewer(email);
              newShares++;
              Logger.log(`    ✅ Shared folder with: ${email}`);
            } catch (e) {
              Logger.log(`    ⚠️ Could not share folder with ${email}: ${e.message}`);
            }
          }
        });
        
        if (newShares > 0) {
          Logger.log(`  📊 Folder sharing: ${newShares} new, ${alreadyShared} already shared`);
        } else {
          Logger.log(`  ✓ Folder already shared with all ${alreadyShared} students`);
        }
      }

      foldersProcessed++;
      
      Logger.log(`\n  📊 Summary for ${folderName}:`);
      Logger.log(`     Itinerary: ${itineraryAdded ? '✅ Added' : '✓ Exists'}`);
      Logger.log(`     PDF: ${pdfAdded ? '✅ Added' : '✓ Exists'}`);
      Logger.log(`     Data Sheet: ${dataAdded ? '✅ Added' : '✓ Exists'}`);
    }
    
    Logger.log(`\n\n${'='.repeat(80)}`);
    Logger.log(`🎉 TEMPLATE COPYING COMPLETE!`);
    Logger.log(`${'='.repeat(80)}`);
    Logger.log(`📊 Folders processed: ${foldersProcessed}`);
    Logger.log(`📝 Templates added: ${templatesAdded}`);
    Logger.log(`✅ All folders now have required templates`);

    try {
      SpreadsheetApp.getUi().alert(
        'Template Copying Complete!', 
        `Processed: ${foldersProcessed} folders\n` +
        `Templates added: ${templatesAdded}\n\n` +
        '✅ All event folders now have:\n' +
        '   • Trip Itinerary\n' +
        '   • PDF Permission Form\n' +
        '   • Field Trip Data Spreadsheet\n\n' +
        '📝 Each spreadsheet will auto-configure\n' +
        '   when first opened (formatting & students)', 
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {
      Logger.log('📝 Note: UI alert skipped (running from script editor)');
    }
    
  } catch (err) {
    Logger.log(`❌ Error: ${err.message}`);
    Logger.log(err.stack);
    throw err;
  }
}


// ========== UPDATED: Permission Form Generator (STATIC itinerary line) ==========

function generateCustomPermissionForm(row, eventFolder, fullEventName) {
  Logger.log("📝 Starting custom permission form generation...");
  
  const PERMISSION_FORM_TEMPLATE_ID = '1mufhIsWuPB6DAJiqjq1jk7A7r8Bb0tKJT3LqK-Q4Yao';
  
  try {
    // Extract form data
    var tripName = row[2] || '';
    var tripPurpose = row[3] || tripName;
    
    // Days array with transportation
    var days = [
      { date: row[9],  transportation: row[12] },
      { date: row[14], transportation: row[17] },
      { date: row[19], transportation: row[22] },
      { date: row[24], transportation: row[27] },
      { date: row[29], transportation: row[32] }
    ];
    
    var validDays = days.filter(d => d.date);
    
    if (validDays.length === 0) {
      Logger.log("⚠️ No valid dates for permission form");
      return null;
    }
    
    // Format dates
    var firstDate = new Date(validDays[0].date);
    var lastDate = new Date(validDays[validDays.length - 1].date);
    
    var eventDatesText = '';
    if (validDays.length === 1) {
      eventDatesText = Utilities.formatDate(firstDate, Session.getScriptTimeZone(), 'MM/dd/yyyy');
    } else {
      var firstFormatted = Utilities.formatDate(firstDate, Session.getScriptTimeZone(), 'MM/dd/yyyy');
      var lastFormatted = Utilities.formatDate(lastDate, Session.getScriptTimeZone(), 'MM/dd/yyyy');
      eventDatesText = firstFormatted + ' - ' + lastFormatted;
    }
    
    // Calculate deadline (5 business days before event)
    var deadline = calculateBusinessDaysBefore(firstDate, 5);
    var formattedDeadline = Utilities.formatDate(deadline, Session.getScriptTimeZone(), 'MMMM dd, yyyy');
    
    Logger.log(`📅 Event date(s): ${eventDatesText}`);
    Logger.log(`⏰ Permission slip deadline: ${formattedDeadline}`);
    
    // Analyze transportation across all days
    var hasSchoolBus = false;
    var hasDistrictVan = false;
    var hasCommercial = false;
    var hasPrivateVehicle = false;
    var hasParentDropoff = false;
    
    validDays.forEach(function(day) {
      var transport = day.transportation || '';
      if (transport.includes('School Bus')) hasSchoolBus = true;
      if (transport.includes('District Van')) hasDistrictVan = true;
      if (transport.includes('Commercial Transportation')) hasCommercial = true;
      if (transport.includes('Private Vehicle')) hasPrivateVehicle = true;
      if (transport.includes('Parent Pick-Up') || transport.includes('Parent Drop-Off') || transport.includes('No:')) hasParentDropoff = true;
    });
    
    Logger.log(`🚌 Transportation: SchoolBus=${hasSchoolBus}, DistrictVan=${hasDistrictVan}, Commercial=${hasCommercial}, PrivateVehicle=${hasPrivateVehicle}, ParentDropoff=${hasParentDropoff}`);
    
    // Copy Google Doc template to event folder
    var templateFile = DriveApp.getFileById(PERMISSION_FORM_TEMPLATE_ID);
    var docName = `${fullEventName} Field Trip Form_TEMP`;
    var copiedFile = templateFile.makeCopy(docName, eventFolder);
    
    Logger.log("📄 Copied Google Doc template to event folder");
    
    // Open the copied Google Doc to edit
    var doc = DocumentApp.openById(copiedFile.getId());
    
    // Build placeholder map matching the template
    var placeholderMap = {
      '{{Deadline}}': formattedDeadline,
      '{{StudentName}}': "student's first and last name",
      '{{TripName}}': tripName,
      '{{TripPurpose}}': tripPurpose,
      '{{EventDates}}': eventDatesText,
      '{{CB_Bus}}': hasSchoolBus ? '☑' : '☐',
      '{{CB_Comm}}': hasCommercial ? '☑' : '☐',
      '{{CB_Van}}': hasDistrictVan ? '☑' : '☐',
      '{{CB_Priv}}': hasPrivateVehicle ? '☑' : '☐',
      '{{CB_Parent}}': hasParentDropoff ? '☑' : '☐'
    };
    
    Logger.log("✏️ Replacing placeholders...");
    replacePlaceholdersInDoc_(doc, placeholderMap);

    doc.saveAndClose();
    
    // Convert to PDF
    Logger.log("📥 Converting to PDF...");
    var pdfBlob = copiedFile.getAs(MimeType.PDF);
    var pdfName = `${fullEventName} Field Trip Form.pdf`;
    pdfBlob.setName(pdfName);
    
    // Save PDF to event folder
    var pdfFile = eventFolder.createFile(pdfBlob);
    
    Logger.log(`✅ Custom permission form created: ${pdfName}`);
    Logger.log(`🔗 PDF URL: ${pdfFile.getUrl()}`);
    
    // Delete temporary Google Doc
    copiedFile.setTrashed(true);
    Logger.log('🗑️ Temporary document deleted');
    
    return pdfFile;
    
  } catch (e) {
    Logger.log(`❌ Error generating permission form: ${e.message}`);
    Logger.log(e.stack);
    return null;
  }
}


// ========== UPDATED: Itinerary Generator (regex-safe + correct tokens) ==========

function generateItineraryFromFormData(row, eventFolder) {
  Logger.log("📝 Starting itinerary generation from template...");
  
  const TEMPLATE_DOC_ID = '1_NDi3EJ0GAJFbUqF10Sykkg-QDQCcH8r3t3PUXKnxBs';
  
  // Extract form data
  var tripName = row[2] || '';
  var tripPurpose = row[3] || '';
  var destination = row[4] || '';
  var address = row[5] || '';
  var materials = row[6] || 'Standard school supplies';
  var food = row[7] || 'Bring your own lunch';
  
  // Days array with transportation
  var days = [
    { date: row[9],  departure: row[10], arrival: row[11], transportation: row[12] },
    { date: row[14], departure: row[15], arrival: row[16], transportation: row[17] },
    { date: row[19], departure: row[20], arrival: row[21], transportation: row[22] },
    { date: row[24], departure: row[25], arrival: row[26], transportation: row[27] },
    { date: row[29], departure: row[30], arrival: row[31], transportation: row[32] }
  ];
  
  var validDays = days.filter(d => d.date);
  
  if (validDays.length === 0) {
    Logger.log("⚠️ No valid dates for itinerary");
    return null;
  }
  
  // Format first date
  var firstDate = new Date(validDays[0].date);
  var formattedDate = Utilities.formatDate(firstDate, Session.getScriptTimeZone(), 'MMMM dd, yyyy');
  
  // Calculate deadline
  var deadline = calculateBusinessDaysBefore(firstDate, 5);
  var formattedDeadline = Utilities.formatDate(deadline, Session.getScriptTimeZone(), 'MMMM dd, yyyy');
  
  Logger.log(`📅 Event date: ${formattedDate}`);
  Logger.log(`⏰ Permission slip deadline: ${formattedDeadline}`);
  
  // Determine overall transportation type for "Stay Connected" section
  var hasDistrictTransport = false;
  var hasParentDropoff = false;
  
  validDays.forEach(function(day) {
    var transport = day.transportation || '';
    if (transport.includes('School Bus') || 
        transport.includes('District Van') || 
        transport.includes('Commercial Transportation') || 
        transport.includes('Private Vehicle')) {
      hasDistrictTransport = true;
    }
    if (transport.includes('Parent Pick-Up') || 
        transport.includes('Parent Drop-Off') || 
        transport.includes('No:')) {
      hasParentDropoff = true;
    }
  });
  
  Logger.log(`🚌 Transportation analysis: ProvidedTransport=${hasDistrictTransport}, ParentDropoff=${hasParentDropoff}`);

  // Icon for Day 1
  var primaryTransportIcon = getTransportationIcon(validDays[0].transportation);
  Logger.log(`🎨 Primary transportation icon: ${primaryTransportIcon}`);
  
  // Transportation summary text (matches {{Transportation}} placeholder in template)
  var transportationSummary = '';
  try {
    transportationSummary = buildTransportationSummary(validDays);
  } catch (e) {
    transportationSummary = formatTransportationForItinerary(validDays[0].transportation);
  }
  
  // Copy template
  var templateDoc = DriveApp.getFileById(TEMPLATE_DOC_ID);
  var docName = eventFolder.getName().replace(/^\d{2}_\d{2}_\d{2}(-\d{2})?_/, '') + ' Itinerary';
  var copiedFile = templateDoc.makeCopy(docName, eventFolder);
  var doc = DocumentApp.openById(copiedFile.getId());
  
  Logger.log("📄 Copied template as: " + docName);
  
  // Replace Stay Connected text based on transportation
  var stayConnectedText = buildStayConnectedText(hasDistrictTransport, hasParentDropoff);
  
  // Build schedule section (includes per-day icons)
  var scheduleText = '';
  for (var i = 0; i < validDays.length; i++) {
    var day = validDays[i];
    var dayDate = new Date(day.date);
    var dayFormatted = Utilities.formatDate(dayDate, Session.getScriptTimeZone(), 'EEEE, MMMM dd, yyyy');
    
    if (validDays.length > 1) {
      scheduleText += '\n\nDay ' + (i + 1) + ' - ' + dayFormatted + '\n';
    }
    
    var dayIcon = getTransportationIcon(day.transportation);
    var transportText = formatTransportationForItinerary(day.transportation);
    
    scheduleText += '• ' + dayIcon + ' Transportation: ' + transportText + '\n';
    scheduleText += '• ' + (day.departure || 'TBD') + ': Depart from Graham-Kapowsin High School.\n';
    scheduleText += '• ' + (day.departure || 'TBD') + ': Arrive at ' + (destination || 'destination') + '.\n';
    scheduleText += '• ' + (day.arrival || 'TBD') + ': Estimated arrival back at Graham-Kapowsin High School.';
    
    if (i < validDays.length - 1) {
      scheduleText += '\n';
    }
  }
  
  // Placeholder map EXACTLY matching your template tokens
  var placeholderMap = {
    '{{Event_Name}}': tripName,
    '{{Date_of_Event}}': formattedDate,
    '{{Event_Purpose}}': tripPurpose,
    '{{Destination}}': destination,
    '{{Address}}': address,
    '{{Transportation_Icon}}': primaryTransportIcon,
    '{{Transportation}}': transportationSummary || 'Transportation TBD',
    '{{Schedule_Details}}': scheduleText,
    '{{Materials}}': materials,
    '{{Food}}': food,
    '{{DEADLINE}}': formattedDeadline,
    '{{Stay Connected}}': stayConnectedText
  };
  
  // Primary replacement pass (your helper should escape for regex)
  replacePlaceholdersInDoc_(doc, placeholderMap);

  // Fallback pass for the common "token got split by styling/spacing" problem
  var body = doc.getBody();
  var stillThere = body.findText('\\{\\{Stay Connected\\}\\}');
  if (stillThere) {
    Logger.log('⚠️ Stay Connected placeholder still present; retrying with flexible whitespace regex...');
    body.replaceText('\\{\\{Stay\\s*Connected\\}\\}', stayConnectedText);
  }
  
  doc.saveAndClose();
  
  Logger.log("✅ Itinerary created from template: " + doc.getUrl());
  return doc;
}




/**
 * Formats transportation value for itinerary display
 * @param {string} transportValue - Raw value from form
 * @returns {string} Formatted text for itinerary
 */
function formatTransportationForItinerary(transportValue) {
  if (!transportValue) return 'To be determined';
  
  if (transportValue.includes('School Bus')) {
    return 'School bus transportation provided. Students will depart from and return to the school bus loading zone.';
  } else if (transportValue.includes('District Van')) {
    return 'District van transportation provided. Students will depart from and return to the NEST™ Lab (Room 174).';
  } else if (transportValue.includes('Commercial Transportation')) {
    return 'Commercial transportation (charter bus) provided. Students will depart from and return to the school bus loading zone.';
  } else if (transportValue.includes('Private Vehicle')) {
    return 'Private vehicle transportation arranged. See Mr. Peñalver for details on departure location.';
  } else if (transportValue.includes('Parent Pick-Up') || transportValue.includes('Parent Drop-Off') || transportValue.includes('No:')) {
    return 'Transportation is NOT provided. Parents/guardians must drop off and pick up students at the destination address.';
  }
  
  return transportValue;
}


function moveFieldTripFolder(folder, newParent, currentLocation) {
  try {
    newParent.addFolder(folder);
    
    const parents = folder.getParents();
    while (parents.hasNext()) {
      const parent = parents.next();
      if (parent.getId() !== newParent.getId()) {
        parent.removeFolder(folder);
      }
    }
    
  } catch (e) {
    Logger.log(`  ❌ Error moving folder ${folder.getName()}: ${e.message}`);
    throw e;
  }
}

function shareEventFoldersWithStudents() {
  const spreadsheetId = '117q2rtYkkMCy67SDHF0UD3XXuxtESxh-psXUVCdzB-c';
  const eventFolderId = '1oy8tn_fNRH902LgRHgX_aRHHmYO3ugbB';
  const upcomingFolderId = '12zXeHSjAUYyQDI7ALcIZ1l3R44MMpLGh';

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const builderSheet = ss.getSheetByName('FieldTripBuilder');
    
    if (!builderSheet) throw new Error('FieldTripBuilder sheet not found.');

    const eventParent = DriveApp.getFolderById(eventFolderId);
    const upcomingFolder = DriveApp.getFolderById(upcomingFolderId);
    const formData = builderSheet.getRange(2, 1, builderSheet.getLastRow() - 1, 33).getDisplayValues();
    
    const staffEmails = getStaffEmailsFromDatabase();
    Logger.log(`👥 Staff emails to share with: ${staffEmails.length}`);
    
    const allFolders = [];
    
    const parentFolders = eventParent.getFolders();
    while (parentFolders.hasNext()) {
      const folder = parentFolders.next();
      if (folder.getId() !== upcomingFolderId && 
          folder.getId() !== '15rPkgef5lSwchl8-TEH4CZ-bWGP0Whme' &&
          folder.getId() !== '1Ao26lQSGvDiCxoFeLSOVuYza5Zv4Qihs') {
        allFolders.push({ folder: folder, location: 'Parent' });
      }
    }
    
    const upcomingFolders = upcomingFolder.getFolders();
    while (upcomingFolders.hasNext()) {
      allFolders.push({ folder: upcomingFolders.next(), location: 'Upcoming' });
    }
    
    let processedCount = 0;
    let sharedCount = 0;
    
    for (let i = 0; i < allFolders.length; i++) {
      const folderObj = allFolders[i];
      const folder = folderObj.folder;
      const folderName = folder.getName();

      const dateMatch = folderName.match(/^\d{2}_\d{2}_\d{2}(?:-\d{2})?_(.*)/);
      if (!dateMatch) continue;

      const eventName = dateMatch[1];

      let matchingRow = null;
      for (let j = 0; j < formData.length; j++) {
        if (formData[j][2] === eventName) {
          matchingRow = formData[j];
          break;
        }
      }

      let allEmailsToShare = [];
      
      if (matchingRow) {
        const studentSelection = matchingRow[8];
        if (studentSelection) {
          const studentData = parseStudentsAndPeriods(studentSelection);
          const studentEmails = getStudentEmails(studentData.students);
          allEmailsToShare = allEmailsToShare.concat(studentEmails);
        }
      }
      
      allEmailsToShare = allEmailsToShare.concat(staffEmails);
      
      if (allEmailsToShare.length === 0) continue;

      const currentViewers = folder.getViewers().map(user => user.getEmail().toLowerCase());
      
      allEmailsToShare.forEach(email => {
        if (!currentViewers.includes(email.toLowerCase())) {
          try {
            folder.addViewer(email);
            sharedCount++;
          } catch (e) {
            Logger.log(`❌ Error sharing with ${email}: ${e.message}`);
          }
        }
      });
      
      processedCount++;
    }
    
    Logger.log(`\n🎉 COMPLETE! Processed ${processedCount} folders, made ${sharedCount} new shares`);
    
    try {
      SpreadsheetApp.getUi().alert(`Folder Sharing Complete!\n\nProcessed: ${processedCount} folders\nNew shares: ${sharedCount}`);
    } catch (e) {
      Logger.log('📝 Note: UI alert skipped');
    }
    
  } catch (err) {
    Logger.log(`❌ Error: ${err.message}`);
  }
}

function getStaffEmailsFromDatabase() {
  const NEST_DATABASE_ID = '12yZuGqPRJnm0GfiAf6OSrsc10K13ZW0rlx5mwbVNqDE';
  
  try {
    const db = SpreadsheetApp.openById(NEST_DATABASE_ID);
    const notificationsSheet = db.getSheetByName('Notifications');
    
    if (!notificationsSheet) return [];
    
    const emailRange = notificationsSheet.getRange('G3:G50');
    const emailValues = emailRange.getValues();
    
    const staffEmails = emailValues
      .map(row => row[0])
      .filter(email => email && email.toString().trim() !== '')
      .map(email => email.toString().trim());
    
    return staffEmails;
    
  } catch (e) {
    Logger.log(`❌ Error getting staff emails: ${e.message}`);
    return [];
  }
}

// ========== FOLDER HELPERS ==========

function ensureEventSubfolders(eventFolder) {
  const completedSub = eventFolder.getFoldersByName('Field Trip Forms_Completed');
  if (!completedSub.hasNext()) {
    eventFolder.createFolder('Field Trip Forms_Completed');
    Logger.log(`  ✨ Created "Field Trip Forms_Completed" subfolder`);
  }
  
  const districtSub = eventFolder.getFoldersByName('District Forms');
  if (!districtSub.hasNext()) {
    eventFolder.createFolder('District Forms');
    Logger.log(`  ✨ Created "District Forms" subfolder`);
  }
}

function formatFieldTripFolderName(tripName, firstDay, lastDay) {
  var firstYear = firstDay.getFullYear().toString().slice(-2);
  var firstMonth = ('0' + (firstDay.getMonth() + 1)).slice(-2);
  var firstDate = ('0' + firstDay.getDate()).slice(-2);
  var lastDate = ('0' + lastDay.getDate()).slice(-2);
  
  if (firstDay.getTime() === lastDay.getTime()) {
    return firstYear + '_' + firstMonth + '_' + firstDate + '_' + tripName;
  } else {
    return firstYear + '_' + firstMonth + '_' + firstDate + '-' + lastDate + '_' + tripName;
  }
}

function findFolderByName(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return null;
}

function archiveOldFieldTripFolders(parentFolder, archiveFolder, currentStartYear, currentEndYear) {
  Logger.log("🗄️ Starting archive process...");
  
  var folders = parentFolder.getFolders();
  var foldersArchived = 0;
  
  while (folders.hasNext()) {
    var folder = folders.next();
    var folderName = folder.getName();
    
    var match = folderName.match(/^(\d{2})_(\d{2})_(\d{2})/);
    
    if (!match) {
      Logger.log("⏭️ Skipping folder (doesn't match pattern): " + folderName);
      continue;
    }
    
    var folderYear = parseInt('20' + match[1]);
    
    if (folderYear < currentStartYear) {
      Logger.log("📦 Archiving old folder: " + folderName + " (Year: " + folderYear + ")");
      
      var schoolYearFolder = getOrCreateSchoolYearFolder(archiveFolder, folderYear);
      folder.moveTo(schoolYearFolder);
      foldersArchived++;
      
      Logger.log("✅ Moved to: " + schoolYearFolder.getName());
    }
  }
  
  Logger.log("🗄️ Archived " + foldersArchived + " old folders.");
}

function getOrCreateSchoolYearFolder(archiveFolder, tripYear) {
  var startYear = tripYear;
  var endYear = tripYear + 1;
  
  var folderName = startYear.toString().slice(-2) + '_' + endYear.toString().slice(-2) + '_Field Trips';
  
  var existingFolder = findFolderByName(archiveFolder, folderName);
  
  if (existingFolder) {
    return existingFolder;
  }
  
  var altStartYear = tripYear - 1;
  var altFolderName = altStartYear.toString().slice(-2) + '_' + tripYear.toString().slice(-2) + '_Field Trips';
  var altExistingFolder = findFolderByName(archiveFolder, altFolderName);
  
  if (altExistingFolder) {
    return altExistingFolder;
  }
  
  Logger.log("✨ Creating new archive folder: " + folderName);
  return archiveFolder.createFolder(folderName);
}

function normalizeFileName(fileName) {
  return fileName.trim().toLowerCase();
}

function getFilesAsMap(folder) {
  let fileMap = new Map();
  let files = folder.getFiles();
  
  while (files.hasNext()) {
    let file = files.next();
    let fileNameParts = file.getName().split(' ');
    let key = fileNameParts.slice(0, 2).join(' ');
    if (!fileMap.has(key)) {
      fileMap.set(key, file);
    }
  }
  
  return fileMap;
}

/**
 * Builds the "Stay Connected" section text based on transportation type
 * @param {boolean} hasDistrictTransport - True if any day uses School Bus, District Van, Commercial, or Private Vehicle
 * @param {boolean} hasParentDropoff - True if any day requires parent drop-off
 * @returns {string} Appropriate stay connected message
 */
function buildStayConnectedText(hasDistrictTransport, hasParentDropoff) {
  if (hasDistrictTransport && hasParentDropoff) {
    return 'Parents, your child will contact you during the event. On days with provided transportation, they will call on the way back to let you know a more accurate arrival time at Graham-Kapowsin. On days requiring parent pick-up, they will call as the event comes to an end so you can meet them at the destination.';
  }
  
  if (hasDistrictTransport) {
    return 'Parents, your child will call on the way back from the event to let you know a more accurate arrival time back at Graham-Kapowsin.';
  }
  
  if (hasParentDropoff) {
    return 'Parents, your child will call as the event comes to an end so you can meet them for pick-up at the destination.';
  }
  
  return 'Parents, your child will contact you during the event with updates on timing.';
}
