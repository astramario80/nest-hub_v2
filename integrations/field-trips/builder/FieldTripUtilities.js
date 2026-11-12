// ========== FIELD TRIP SHARED UTILITIES ==========
// These functions are used by both CalendarEvents.gs and FolderBuilding.gs

/**
 * Parses student selection string and extracts student names and periods
 * @param {string} studentSelection - The student selection string from the form
 * @return {Object} Object containing arrays of students and periods
 */
function parseStudentsAndPeriods(studentSelection) {
  var students = [];
  var periods = new Set();
  
  Logger.log('🔧 parseStudentsAndPeriods called');
  Logger.log('   Input: ' + studentSelection.substring(0, 100) + '...');
  
  if (!studentSelection) return { students: [], periods: [] };
  
  // Check if this is a group selection (contains a colon and group keywords)
  if ((studentSelection.includes('CURRENT ATTENDEES:') || 
       studentSelection.includes('LEADERSHIP:') || 
       studentSelection.includes('ALL PERIOD') || 
       studentSelection.includes('ALL CTSO') ||
       studentSelection.includes('DIVISION')) && 
      studentSelection.includes(':')) {
    
    Logger.log('   ✅ Detected group format');
    
    // This is a group format: "GROUP NAME: Name1, First1; Name2, First2; ..."
    
    // ========== Extract period from group name ==========
    
    // Check for specific period patterns
    if (studentSelection.includes('ALL PERIOD 1') || studentSelection.includes('DIVISION 1')) {
      periods.add('Period 1');
    } else if (studentSelection.includes('ALL PERIOD 2') || studentSelection.includes('DIVISION 2')) {
      periods.add('Period 2');
    } else if (studentSelection.includes('ALL PERIOD 3') || studentSelection.includes('DIVISION 3')) {
      periods.add('Period 3');
    } else if (studentSelection.includes('ALL PERIOD 4') || studentSelection.includes('DIVISION 4')) {
      periods.add('Period 4');
    } else if (studentSelection.includes('ALL PERIOD 5') || studentSelection.includes('DIVISION 5')) {
      periods.add('Period 5');
    } else if (studentSelection.includes('ALL PERIOD 7') || studentSelection.includes('DIVISION 7')) {
      periods.add('Period 7');
    }
    
    // Check for CTSO (but NOT leadership)
    if (studentSelection.includes('ALL CTSO STUDENTS')) {
      // "ALL CTSO STUDENTS" = CTSO period/prep
      periods.add('CTSO');
      Logger.log('   📚 CTSO period detected (ALL CTSO STUDENTS)');
    } else if (studentSelection.includes('CTSO') && !studentSelection.includes('LEADERSHIP')) {
      // Other CTSO references (not leadership)
      periods.add('CTSO');
      Logger.log('   📚 CTSO period detected');
    } else if (studentSelection.includes('LEADERSHIP')) {
      // Leadership is cross-period, don't add any period
      Logger.log('   📚 Leadership detected (cross-period, no specific period)');
    } else if (studentSelection.includes('CURRENT ATTENDEES')) {
      // Current attendees is cross-period
      Logger.log('   📚 Current attendees detected (cross-period, no specific period)');
    }
    
    // Extract names after the colon
    var colonIndex = studentSelection.indexOf(':');
    if (colonIndex > -1) {
      var namesPart = studentSelection.substring(colonIndex + 1).trim();
      Logger.log('   Names part: ' + namesPart.substring(0, 80) + '...');
      
      // Names are separated by semicolons: "Last, First; Last, First; ..."
      var names = namesPart.split(';');
      Logger.log('   Split into ' + names.length + ' names');
      
      for (var j = 0; j < names.length; j++) {
        var name = names[j].trim();
        Logger.log('   Processing name ' + (j + 1) + ': "' + name + '"');
        
        if (name && !students.includes(name)) {
          students.push(name);
          Logger.log('      ✅ Added to students array');
        } else {
          Logger.log('      ⏭️ Skipped (empty or duplicate)');
        }
      }
    }
    
  } else {
    Logger.log('   ℹ️ Not group format, trying individual format');
    
    // This might be individual selections or comma-separated format
    // Split by comma-space to handle individual entries
    var selections = studentSelection.split(', ');
    
    for (var i = 0; i < selections.length; i++) {
      var selection = selections[i].trim();
      
      if (selection.includes('_(')) {
        // Individual student selection like "Last, First_(Period)"
        var parts = selection.split('_(');
        var nameOnly = parts[0].trim();
        var periodPart = parts[1].replace(')', '').trim();
        
        if (nameOnly && !students.includes(nameOnly)) {
          students.push(nameOnly);
        }
        
        // Add period
        if (periodPart.includes('Period')) {
          periods.add(periodPart);
        } else if (periodPart === 'CTSO') {
          periods.add('CTSO');
        }
      }
    }
  }
  
  Logger.log('   📊 Final result: ' + students.length + ' students, ' + periods.size + ' periods');
  Logger.log('   📚 Periods: [' + Array.from(periods).join(', ') + ']');
  
  return {
    students: students,
    periods: Array.from(periods).sort()
  };
}


/**
 * Looks up student emails from the master database
 * @param {Array} studentNames - Array of student names
 * @return {Array} Array of student email addresses
 */
function getStudentEmails(studentNames) {
  var masterSS = SpreadsheetApp.openById('12XogWM3af3PLIvEyrFR39hzkI0kEmfiCZkr66y3eDcU');
  var combinedSheet = masterSS.getSheetByName('CombinedStudentList');
  
  var names = combinedSheet.getRange('A2:A').getValues().flat();
  var emails = combinedSheet.getRange('C2:C').getValues().flat();
  
  var emailList = [];
  
  for (var i = 0; i < studentNames.length; i++) {
    var studentName = studentNames[i].trim();
    
    for (var j = 0; j < names.length; j++) {
      if (names[j].toString().trim() === studentName && emails[j]) {
        var email = emails[j].toString().trim();
        if (email && !emailList.includes(email)) {
          emailList.push(email);
        }
        break;
      }
    }
  }
  
  return emailList;
}

/**
 * Gets the appropriate emoji icon for transportation type
 * Used by both calendar events and itinerary generation
 * @param {string} transportValue - Raw transportation value from form
 * @returns {string} Emoji icon for the transportation type
 */
function getTransportationIcon(transportValue) {
  if (!transportValue) return '🚌'; // Default to bus icon for TBD
  
  if (transportValue.includes('School Bus')) {
    return '🚌';  // School bus
  } else if (transportValue.includes('District Van')) {
    return '🚐';  // Van/minibus
  } else if (transportValue.includes('Commercial Transportation')) {
    return '🚎';  // Commercial bus/charter
  } else if (transportValue.includes('Private Vehicle')) {
    return '🚙';  // Private vehicle
  } else if (transportValue.includes('Parent Pick-Up') || transportValue.includes('Parent Drop-Off') || transportValue.includes('No:')) {
    return '🚗';  // Car for parent drop-off
  }
  
  return '🚌'; // Default fallback
}



// ========== DEBUGGING FUNCTIONS ==========

/**
 * Debug function to test parsing with actual data
 */
function debugStudentParsing() {
  Logger.log('🧪 ========== TESTING STUDENT PARSING ==========\n');
  
  // Test case 1: ALL CTSO STUDENTS
  const test1 = "ALL CTSO STUDENTS: Ballas, Jude; Barrington, Noah; Beltran , Gabriel";
  Logger.log('TEST 1: ALL CTSO STUDENTS');
  Logger.log('Input: ' + test1);
  const result1 = parseStudentsAndPeriods(test1);
  Logger.log('✅ Students: ' + result1.students.length);
  Logger.log('✅ Periods: [' + result1.periods.join(', ') + ']');
  Logger.log('Expected: CTSO period\n');
  
  // Test case 2: DIVISION CTSO LEADERSHIP
  const test2 = "DIVISION CTSO LEADERSHIP: Ovechka, Taylor; Foote, Gabriel; Haueter, Nathan";
  Logger.log('TEST 2: DIVISION CTSO LEADERSHIP');
  Logger.log('Input: ' + test2);
  const result2 = parseStudentsAndPeriods(test2);
  Logger.log('✅ Students: ' + result2.students.length);
  Logger.log('✅ Periods: [' + result2.periods.join(', ') + ']');
  Logger.log('Expected: No periods (leadership is cross-period)\n');
  
  // Test case 3: ALL PERIOD 3 STUDENTS
  const test3 = "ALL PERIOD 3 STUDENTS: Smith, John; Doe, Jane; Brown, Alex";
  Logger.log('TEST 3: ALL PERIOD 3 STUDENTS');
  Logger.log('Input: ' + test3);
  const result3 = parseStudentsAndPeriods(test3);
  Logger.log('✅ Students: ' + result3.students.length);
  Logger.log('✅ Periods: [' + result3.periods.join(', ') + ']');
  Logger.log('Expected: Period 3\n');
  
  // Test case 4: Individual students with CTSO
  const test4 = "Smith, John_(CTSO), Doe, Jane_(CTSO)";
  Logger.log('TEST 4: Individual CTSO students');
  Logger.log('Input: ' + test4);
  const result4 = parseStudentsAndPeriods(test4);
  Logger.log('✅ Students: ' + result4.students.length);
  Logger.log('✅ Periods: [' + result4.periods.join(', ') + ']');
  Logger.log('Expected: CTSO period\n');
  
  // Test case 5: CURRENT ATTENDEES
  const test5 = "CURRENT ATTENDEES: Smith, John; Doe, Jane; Brown, Alex";
  Logger.log('TEST 5: CURRENT ATTENDEES');
  Logger.log('Input: ' + test5);
  const result5 = parseStudentsAndPeriods(test5);
  Logger.log('✅ Students: ' + result5.students.length);
  Logger.log('✅ Periods: [' + result5.periods.join(', ') + ']');
  Logger.log('Expected: No periods (cross-period)\n');
  
  Logger.log('🏁 ========== TESTING COMPLETE ==========');
}

/**
 * Calculates a date that is X business days before a given date
 * Skips weekends (Saturday and Sunday)
 * @param {Date} targetDate - The target date to count back from
 * @param {number} businessDays - Number of business days to go back
 * @returns {Date} The calculated deadline date
 */
function calculateBusinessDaysBefore(targetDate, businessDays) {
  var deadline = new Date(targetDate);
  var daysToSubtract = 0;
  
  while (daysToSubtract < businessDays) {
    deadline.setDate(deadline.getDate() - 1);
    
    // Check if it's a weekday (0 = Sunday, 6 = Saturday)
    var dayOfWeek = deadline.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysToSubtract++;
    }
  }
  
  return deadline;
}
