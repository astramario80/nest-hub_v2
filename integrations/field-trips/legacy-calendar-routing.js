// Read-only snapshot of the original builder functions. Not deployed or executed by the preview.
const NEST_EVENT_CALENDAR_ID = "c_b1b4256a9d0f67ab533bd0e92bad5a544b4ea6f793f6ed63d7957e776bbe468e@group.calendar.google.com";

function determineEventCalendar(studentSelection, studentData) {
  var result = {
    calendarId: NEST_EVENT_CALENDAR_ID,
    calendarName: 'NEST™ Event Calendar',
    reason: 'Default',
    useNestCalendar: true
  };
  
  if (!studentSelection) {
    return result;
  }
  
  Logger.log(`🔍 Analyzing student selection: "${studentSelection.substring(0, 100)}..."`);
  Logger.log(`   Parsed periods: [${studentData.periods.join(', ')}]`);
  Logger.log(`   Parsed students: ${studentData.students.length}`);
  
  // ========== PRIORITY 1: Check periods FIRST (most reliable) ==========
  
  // Single period/prep (including CTSO)
  if (studentData.periods.length === 1) {
    var period = studentData.periods[0];
    
    if (period === 'CTSO') {
      result.calendarName = 'NEST™ Robotics Calendar';
      result.reason = 'CTSO period selected (NEST™ Robotics prep)';
    } else {
      result.calendarName = period + ' Calendar (via prep)';
      result.reason = period + ' selected';
    }
    
    result.useNestCalendar = false; // Use period-specific calendar
    Logger.log(`   ✅ ${result.reason}`);
    return result;
  }
  
  // Multiple periods
  if (studentData.periods.length > 1) {
    result.reason = 'Multiple periods selected (' + studentData.periods.join(', ') + ')';
    result.useNestCalendar = false; // Use multiple period calendars
    Logger.log(`   ✅ ${result.reason}`);
    return result;
  }
  
  // ========== PRIORITY 2: No periods = check for special CTSO groups ==========
  
  // Check for CTSO Leadership BEFORE generic leadership
  if (studentSelection.includes('DIVISION CTSO LEADERSHIP')) {
    result.calendarName = 'NEST™ Robotics Calendar';
    result.reason = 'CTSO Leadership (NEST™ Robotics prep)';
    result.useNestCalendar = false; // Use NEST™ Robotics calendar
    Logger.log(`   ✅ ${result.reason}`);
    return result;
  }
  
  // ========== PRIORITY 3: Cross-period or individual selection ==========
  
  // Check for generic leadership (cross-period, non-CTSO)
  if (studentSelection.includes('LEADERSHIP:')) {
    result.reason = 'Leadership selected (cross-period group)';
    result.useNestCalendar = true;
    Logger.log(`   ✅ ${result.reason}`);
    return result;
  }
  
  // Check for current attendees (cross-period)
  if (studentSelection.includes('CURRENT ATTENDEES:')) {
    result.reason = 'Current attendees selected (cross-period group)';
    result.useNestCalendar = true;
    Logger.log(`   ✅ ${result.reason}`);
    return result;
  }
  
  // Check for guest
  if (studentSelection.includes('(Guest)')) {
    result.reason = 'Guest detected';
    result.useNestCalendar = true;
    Logger.log(`   ✅ ${result.reason}`);
    return result;
  }
  
  // Check for specific individuals (like Mario Penalver)
  if (studentSelection.includes('Penalver, Mario')) {
    result.reason = 'Individual student detected (Penalver, Mario)';
    result.useNestCalendar = true;
    Logger.log(`   ✅ ${result.reason}`);
    return result;
  }
  
  // Default: No periods and not a recognized pattern
  result.reason = 'No period associated (individual students)';
  result.useNestCalendar = true;
  Logger.log(`   ✅ ${result.reason}`);
  return result;
}

function getPeriodPrepMapping() {
  var dbSS = SpreadsheetApp.openById('12yZuGqPRJnm0GfiAf6OSrsc10K13ZW0rlx5mwbVNqDE');
  var scheduleSheet = dbSS.getSheetByName('Schedule');
  
  var periods = scheduleSheet.getRange('A9:A15').getValues().flat();
  var preps = scheduleSheet.getRange('B9:B15').getValues().flat();
  
  var mapping = {};
  
  for (var i = 0; i < periods.length; i++) {
    if (periods[i] && preps[i]) {
      mapping[periods[i].toString().trim()] = preps[i].toString().trim();
    }
  }
  
  Logger.log("🗺️ Period-Prep Mapping: " + JSON.stringify(mapping));
  
  return mapping;
}

function getCalendarMapping() {
  var dbSS = SpreadsheetApp.openById('12yZuGqPRJnm0GfiAf6OSrsc10K13ZW0rlx5mwbVNqDE');
  var folderIDSheet = dbSS.getSheetByName('FolderIDs');
  
  var calendarNames = folderIDSheet.getRange('F6:F').getValues().flat();
  var calendarIds = folderIDSheet.getRange('G6:G').getValues().flat();
  
  var mapping = {};
  
  for (var i = 0; i < calendarNames.length; i++) {
    var calName = calendarNames[i].toString().trim();
    var calId = calendarIds[i].toString().trim();
    
    if (!calName || !calId) continue;
    
    // Check if this is a NEST™ Course calendar
    if (calName.indexOf('NEST™ Course: ') === 0) {
      var prepName = calName.replace('NEST™ Course: ', '').trim();
      mapping[prepName] = calId;
    }
  }
  
  Logger.log("📅 Calendar Mapping: " + JSON.stringify(mapping));
  
  return mapping;
}
