/**
 * CALENDAR EVENT MANAGEMENT
 * Creates and updates calendar events for field trips
 * Intelligently selects calendar based on student selection
 */

// ========== CALENDAR CONFIGURATION ==========

/**
 * NEST Event Calendar ID - Used for individual students, guests, and mixed groups
 */
const NEST_EVENT_CALENDAR_ID = 'c_b1b4256a9d0f67ab533bd0e92bad5a544b4ea6f793f6ed63d7957e776bbe468e@group.calendar.google.com';

// ========== MAIN FUNCTIONS ==========

function createFieldTripCalendarEvents() {
  Logger.log("🚀 Starting createFieldTripCalendarEvents");
  
  var ss = SpreadsheetApp.openById('117q2rtYkkMCy67SDHF0UD3XXuxtESxh-psXUVCdzB-c');
  var builderSheet = ss.getSheetByName('FieldTripBuilder');
  
  if (!builderSheet) {
    Logger.log("❌ FieldTripBuilder sheet not found.");
    return;
  }
  
  // Get all form responses
  var lastRow = builderSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("⚠️ No form responses found.");
    return;
  }
  
  // UPDATED: Changed from 28 to 33 columns to include transportation fields
  var data = builderSheet.getRange(2, 1, lastRow - 1, 33).getDisplayValues();
  
  var eventsCreated = 0;
  var eventsUpdated = 0;
  var eventsSkipped = 0;
  
  // Process each submission
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var result = processFieldTripCalendarEvent(row, i + 2);
    eventsCreated += result.created;
    eventsUpdated += result.updated;
    eventsSkipped += result.skipped;
  }
  
  Logger.log("🏁 Finished. Created " + eventsCreated + " events, updated " + eventsUpdated + ", skipped " + eventsSkipped + ".");
  
  // Show UI alert only if running interactively (not from trigger)
  try {
    SpreadsheetApp.getUi().alert('Created ' + eventsCreated + ' calendar events.\nUpdated ' + eventsUpdated + ' events.\nSkipped ' + eventsSkipped + '.');
  } catch (e) {
    Logger.log('📝 Note: UI alert skipped (running from trigger)');
  }
}



function processFieldTripCalendarEvent(row, rowNum) {
  if(typeof ftManagedRow_==='function'&&ftManagedRow_(rowNum))return {created:0,updated:0,skipped:1};
  var result = { created: 0, updated: 0, skipped: 0 };
  
  // Extract trip details
  var tripName = row[2];
  var tripPurpose = row[3];
  var destination = row[4];
  var address = row[5];
  var materials = row[6];
  var food = row[7];
  var studentSelection = row[8];
  
  if (!studentSelection) {
    Logger.log("⏭️ Row " + rowNum + ": No students selected, skipping.");
    return result;
  }
  
  Logger.log("\n" + "=".repeat(80));
  Logger.log("📅 Row " + rowNum + ": Processing field trip: " + tripName);
  Logger.log("=".repeat(80));
  
  // Parse students and determine periods/preps involved
  var studentData = parseStudentsAndPeriods(studentSelection);
  
  Logger.log("👥 Found " + studentData.students.length + " students");
  Logger.log("📚 Periods identified: " + (studentData.periods.length > 0 ? studentData.periods.join(", ") : "None"));
  
  // Determine which calendar(s) to use
  var calendarSelection = determineEventCalendar(studentSelection, studentData);
  Logger.log("📅 Calendar Decision:");
  Logger.log("   Calendar Name: " + calendarSelection.calendarName);
  Logger.log("   Reason: " + calendarSelection.reason);
  Logger.log("   Use NEST Calendar: " + calendarSelection.useNestCalendar);
  
  // Get student emails for invitations
  var studentEmails = getStudentEmails(studentData.students);
  Logger.log("📧 Found " + studentEmails.length + " student email addresses");
  
  // FIX: CTSO Leadership special case
  if (calendarSelection.reason.includes('CTSO Leadership') && studentData.periods.length === 0) {
    studentData.periods = ['CTSO'];
    Logger.log("🔧 Fixed: Added CTSO to periods array for calendar creation");
  }
  
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
    Logger.log("⚠️ No valid dates found for this trip");
    return result;
  }
  
  Logger.log("📆 Valid days: " + validDays.length);
  validDays.forEach(function(day, idx) {
    Logger.log("   Day " + (idx + 1) + " transportation: " + (day.transportation || 'Not specified'));
  });
  
  // Get event folder and document links (UPDATED: includes folderId)
  var eventLinks = getEventFolderAndDocumentLinks(tripName, validDays);
  
  // Build description with links
  var description = '';
  if (tripPurpose) description += 'Purpose: ' + tripPurpose + '\n\n';
  if (destination) description += 'Destination: ' + destination + '\n';
  if (address) description += 'Address: ' + address + '\n\n';
  if (materials) description += 'Materials/Dress Code: ' + materials + '\n\n';
  if (food) description += 'Food: ' + food + '\n\n';
  
  var transportationSummary = buildTransportationSummary(validDays);
  if (transportationSummary) {
    description += '🚌 Transportation: ' + transportationSummary + '\n\n';
  }
  
  if (studentData.periods.length > 0) {
    description += 'Periods: ' + studentData.periods.join(", ") + '\n';
  } else {
    description += 'Selection: Individual students/guests/leadership\n';
  }
  
  description += 'Students: ' + studentData.students.length + ' attending\n\n';
  
  if (validDays.length > 1) {
    description += '━━━━━━━━━━━━━━━━━━━━━━\n';
    description += '📅 DAILY SCHEDULE:\n';
    description += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    validDays.forEach(function(day, dayNum) {
      var dayDate = new Date(day.date);
      var formattedDate = Utilities.formatDate(dayDate, Session.getScriptTimeZone(), 'EEE, MMM dd');
      description += 'Day ' + (dayNum + 1) + ' (' + formattedDate + '):\n';
      description += '  • Depart: ' + (day.departure || 'TBD') + '\n';
      description += '  • Return: ' + (day.arrival || 'TBD') + '\n';
      description += '  • ' + formatTransportationText(day.transportation) + '\n\n';
    });
  }
  
  description += '━━━━━━━━━━━━━━━━━━━━━━\n';
  description += '📎 IMPORTANT LINKS:\n';
  description += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
  
  if (eventLinks.folderUrl) description += '📁 Event Folder: ' + eventLinks.folderUrl + '\n\n';
  if (eventLinks.itineraryUrl) description += '📋 Trip Itinerary: ' + eventLinks.itineraryUrl + '\n\n';
  if (eventLinks.permissionFormUrl) description += '✍️ Permission Slip: ' + eventLinks.permissionFormUrl + '\n\n';
  
  description += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
  description += 'STUDENT ROSTER:\n';
  description += studentData.students.join('\n');
  
  // Calculate and add permission slip deadline
  if (validDays.length > 0) {
    var firstDate = new Date(validDays[0].date);
    var deadline = calculateBusinessDaysBefore(firstDate, 5);
    
    if (calendarSelection.useNestCalendar) {
      addDeadlineToNestCalendar(deadline, tripName, NEST_EVENT_CALENDAR_ID, studentEmails, eventLinks);
    } else {
      var periodPrepMap = getPeriodPrepMapping();
      var calendarMap = getCalendarMapping();
      addDeadlineToPreps(deadline, tripName, studentData.periods, periodPrepMap, calendarMap, studentEmails, eventLinks);
    }
  }
  
  // Create/update main event(s)
  if (calendarSelection.useNestCalendar) {
    result = createEventsInNestCalendar(
      NEST_EVENT_CALENDAR_ID,
      tripName,
      validDays,
      description,
      address || destination,
      studentEmails,
      eventLinks // UPDATED: pass links so we can store Day IDs
    );
  } else {
    var periodPrepMap = getPeriodPrepMapping();
    var calendarMap = getCalendarMapping();
    result = createEventsInPeriodCalendars(
      tripName,
      validDays,
      description,
      address || destination,
      studentData,
      periodPrepMap,
      calendarMap,
      studentEmails
    );
  }
  
  Logger.log("✅ Row " + rowNum + " complete: Created " + result.created + ", Updated " + result.updated + ", Skipped " + result.skipped);
  return result;
}



// ========== CALENDAR SELECTION LOGIC ==========

/**
 * Determines which calendar(s) to use for an event
 * @param {string} studentSelection - The student selection string from Column I
 * @param {Object} studentData - Parsed student data with periods and students arrays
 * @returns {Object} { calendarId, calendarName, reason, useNestCalendar }
 */
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


// ========== TRANSPORTATION HELPER FUNCTIONS ==========

/**
 * Builds a transportation summary string from valid days
 * @param {Array} validDays - Array of day objects with transportation property
 * @returns {string} Transportation summary text with icons
 */
function buildTransportationSummary(validDays) {
  if (!validDays || validDays.length === 0) return '';
  
  var hasSchoolBus = false;
  var hasDistrictVan = false;
  var hasCommercial = false;
  var hasPrivateVehicle = false;
  var hasParentDropoff = false;
  
  validDays.forEach(function(day) {
    var transport = day.transportation || '';
    
    if (transport.includes('School Bus')) {
      hasSchoolBus = true;
    }
    if (transport.includes('District Van')) {
      hasDistrictVan = true;
    }
    if (transport.includes('Commercial Transportation')) {
      hasCommercial = true;
    }
    if (transport.includes('Private Vehicle')) {
      hasPrivateVehicle = true;
    }
    if (transport.includes('Parent Pick-Up') || transport.includes('Parent Drop-Off') || transport.includes('No:')) {
      hasParentDropoff = true;
    }
  });
  
  var transportModes = [];
  if (hasSchoolBus) transportModes.push('🚌 School Bus');
  if (hasDistrictVan) transportModes.push('🚐 District Van');
  if (hasCommercial) transportModes.push('🚎 Commercial Transportation');
  if (hasPrivateVehicle) transportModes.push('🚙 Private Vehicle');
  if (hasParentDropoff) transportModes.push('🚗 Parent Pick-Up/Drop-Off');
  
  if (transportModes.length === 0) return '';
  
  // If mixed transportation across days or multi-day trip, note to see schedule
  if (transportModes.length > 1 || validDays.length > 1) {
    return transportModes.join(' / ') + ' (see daily schedule)';
  }
  
  return transportModes[0];
}


/**
 * Gets formatted transportation text for a single day (with icon)
 * @param {string} transportValue - Raw transportation value from form
 * @returns {string} Formatted transportation text with appropriate icon
 */
function formatTransportationText(transportValue) {
  if (!transportValue) return '🚌 Transportation TBD';
  
  if (transportValue.includes('School Bus')) {
    return '🚌 School Bus provided';
  } else if (transportValue.includes('District Van')) {
    return '🚐 District Van provided';
  } else if (transportValue.includes('Commercial Transportation')) {
    return '🚎 Commercial Transportation provided';
  } else if (transportValue.includes('Private Vehicle')) {
    return '🚙 Private Vehicle transportation';
  } else if (transportValue.includes('Parent Pick-Up') || transportValue.includes('Parent Drop-Off') || transportValue.includes('No:')) {
    return '🚗 Parent pick-up/drop-off required at destination';
  }
  
  return '🚌 ' + transportValue;
}




// ========== CREATE EVENTS IN NEST CALENDAR ==========

/**
 * Creates events in the NEST Event Calendar
 * UPDATED: prefers stored Calendar Event IDs from FolderTracker (Day1=I ... Day5=M)
 */
function createEventsInNestCalendar(calendarId, tripName, validDays, description, location, studentEmails, eventLinks) {
  var result = { created: 0, updated: 0, skipped: 0 };
  
  try {
    var calendar = CalendarApp.getCalendarById(calendarId);
    
    if (!calendar) {
      Logger.log("❌ Could not access NEST Event Calendar");
      return result;
    }
    
    Logger.log("📆 Creating/updating events in NEST Event Calendar");
    
    validDays.forEach(function(day, dayNum) {
      try {
        var eventDate = new Date(day.date);
        var departureTime = parseTimeString(day.departure);
        var arrivalTime = parseTimeString(day.arrival);
        
        if (!departureTime || !arrivalTime) {
          Logger.log("⚠️ Could not parse times for Day " + (dayNum + 1));
          result.skipped++;
          return;
        }
        
        var startDateTime = new Date(eventDate);
        startDateTime.setHours(departureTime.hours, departureTime.minutes, 0, 0);
        
        var endDateTime = new Date(eventDate);
        endDateTime.setHours(arrivalTime.hours, arrivalTime.minutes, 0, 0);
        
        if (endDateTime <= startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }
        
        // Create event title (no period tag for NEST calendar)
        var eventTitle = tripName;
        if (validDays.length > 1) {
          eventTitle += ' - Day ' + (dayNum + 1);
        }
        // 1) Prefer FolderTracker stored ID (Day1..Day5)
        var existingEvent = null;
        try {
          if (eventLinks && eventLinks.folderId && typeof getCalendarIdsForFolder_ === 'function') {
            var ids = getCalendarIdsForFolder_(eventLinks.folderId);
            var storedId = (ids.dayIds && ids.dayIds.length > dayNum) ? ids.dayIds[dayNum] : '';
            existingEvent = getEventByIdSafe_(storedId);
            if (existingEvent) {
              Logger.log("🔗 Found existing event by stored ID for Day " + (dayNum + 1));
            }
          }
        } catch (e) {
          // ignore and fall back
        }
        // 2) Fallback to your existing search logic
        if (!existingEvent) {
          existingEvent = findExistingEvent(calendar, eventTitle, startDateTime, endDateTime);
        }
        
        if (existingEvent) {
          Logger.log("🔄 Updating existing event: " + eventTitle);
          existingEvent.setDescription(description);
          existingEvent.setLocation(location);
          updateEventGuests(existingEvent, studentEmails);
          Logger.log("✅ Updated: " + eventTitle);
          result.updated++;
          // If we updated but no stored ID yet, store it
          try {
            if (eventLinks && eventLinks.folderId && typeof setCalendarIdForFolderDay_ === 'function') {
              setCalendarIdForFolderDay_(eventLinks.folderId, dayNum + 1, existingEvent.getId());
            }
          } catch (e) {}
          
        } else {
          try {
            var event = calendar.createEvent(
              eventTitle,
              startDateTime,
              endDateTime,
              {
                description: description,
                location: location,
                guests: studentEmails.join(','),
                sendInvites: true
              }
            );
            
            Logger.log("✅ Created: " + eventTitle);
            result.created++;
            // Store ID in FolderTracker (I..M)
            try {
              if (eventLinks && eventLinks.folderId && typeof setCalendarIdForFolderDay_ === 'function') {
                setCalendarIdForFolderDay_(eventLinks.folderId, dayNum + 1, event.getId());
              }
            } catch (e) {}
          } catch (createError) {
            Logger.log("❌ Could not create event: " + createError.message);
            result.skipped++;
          }
        }
        
      } catch (e) {
        Logger.log("❌ Error processing day " + (dayNum + 1) + ": " + e.message);
        result.skipped++;
      }
    });
    
  } catch (e) {
    Logger.log("❌ Error accessing calendar: " + e.message);
  }
  
  return result;
}

// ========== CREATE EVENTS IN PERIOD CALENDARS ==========

/**
 * Creates events in period-specific prep calendars
 */
function createEventsInPeriodCalendars(tripName, validDays, description, location, studentData, periodPrepMap, calendarMap, studentEmails) {
  var result = { created: 0, updated: 0, skipped: 0 };
  
  // Create events for each period involved
  studentData.periods.forEach(function(period) {
    var prep = periodPrepMap[period];
    
    if (!prep) {
      Logger.log("⚠️ No prep found for " + period);
      return;
    }
    
    var calendarId = calendarMap[prep];
    
    if (!calendarId) {
      Logger.log("⚠️ No calendar found for prep: " + prep);
      return;
    }
    
    var calendar = CalendarApp.getCalendarById(calendarId);
    
    if (!calendar) {
      Logger.log("❌ Could not access calendar for " + prep);
      return;
    }
    
    Logger.log("📆 Creating/updating events for " + period + " (" + prep + ")");
    
    // Create or update event for each day
    validDays.forEach(function(day, dayNum) {
      try {
        var eventDate = new Date(day.date);
        var departureTime = parseTimeString(day.departure);
        var arrivalTime = parseTimeString(day.arrival);
        
        if (!departureTime || !arrivalTime) {
          Logger.log("⚠️ Could not parse times for Day " + (dayNum + 1));
          result.skipped++;
          return;
        }
        
        var startDateTime = new Date(eventDate);
        startDateTime.setHours(departureTime.hours, departureTime.minutes, 0, 0);
        
        var endDateTime = new Date(eventDate);
        endDateTime.setHours(arrivalTime.hours, arrivalTime.minutes, 0, 0);
        
        if (endDateTime <= startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }
        
        // Create event title with period reference
        var eventTitle = tripName + ' [' + period + ']';
        if (validDays.length > 1) {
          eventTitle += ' - Day ' + (dayNum + 1);
        }
        
        // Check if event already exists
        var existingEvent = findExistingEvent(calendar, eventTitle, startDateTime, endDateTime);
        
        if (existingEvent) {
          Logger.log("🔄 Updating existing event: " + eventTitle);
          existingEvent.setDescription(description);
          existingEvent.setLocation(location);
          updateEventGuests(existingEvent, studentEmails);
          Logger.log("✅ Updated: " + eventTitle + " in " + prep + " calendar");
          result.updated++;
        } else {
          try {
            var event = calendar.createEvent(
              eventTitle,
              startDateTime,
              endDateTime,
              {
                description: description,
                location: location,
                guests: studentEmails.join(','),
                sendInvites: true
              }
            );
            
            Logger.log("✅ Created: " + eventTitle + " in " + prep + " calendar");
            result.created++;
          } catch (createError) {
            Logger.log("❌ Could not create event: " + createError.message);
            result.skipped++;
          }
        }
        
      } catch (e) {
        Logger.log("❌ Error processing event: " + e.message);
        result.skipped++;
      }
    });
  });
  
  return result;
}

// ========== DEADLINE MANAGEMENT ==========

/**
 * Adds permission slip deadline to NEST Event Calendar
 * UPDATED: uses FolderTracker!H stored event ID when available
 */
function addDeadlineToNestCalendar(deadlineDate, tripName, calendarId, studentEmails, eventLinks) {
  Logger.log("📚 Adding deadline to NEST Event Calendar");
  
  try {
    var calendar = CalendarApp.getCalendarById(calendarId);
    
    if (!calendar) {
      Logger.log("❌ Could not access NEST Event Calendar");
      return;
    }
    
    var eventTitle = "📋 " + tripName + " - Permission Slip Deadline";
    
    // Build deadline description with links
    var eventDescription = "⚠️ PERMISSION SLIP DEADLINE ⚠️\n\n";
    eventDescription += "Permission slips for " + tripName + " must be returned by end of day.\n\n";
    
    eventDescription += '━━━━━━━━━━━━━━━━━━━━━━\n';
    eventDescription += '📎 IMPORTANT LINKS:\n';
    eventDescription += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
    
    if (eventLinks && eventLinks.folderUrl) {
      eventDescription += '📁 Event Folder: ' + eventLinks.folderUrl + '\n\n';
    }
    
    if (eventLinks && eventLinks.itineraryUrl) {
      eventDescription += '📋 Trip Itinerary: ' + eventLinks.itineraryUrl + '\n\n';
    }
    
    if (eventLinks && eventLinks.permissionFormUrl) {
      eventDescription += '✍️ Permission Slip (FILL THIS OUT): ' + eventLinks.permissionFormUrl + '\n\n';
    }
    
    eventDescription += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
    eventDescription += 'This is an automated reminder.';
    
    // 1) Prefer stored ID from FolderTracker!H
    var storedDeadlineEvent = null;
    try {
      if (eventLinks && eventLinks.folderId && typeof getCalendarIdsForFolder_ === 'function') {
        var ids = getCalendarIdsForFolder_(eventLinks.folderId);
        storedDeadlineEvent = getEventByIdSafe_(ids.deadlineId);
        if (storedDeadlineEvent) {
          Logger.log("🔗 Found existing deadline by stored ID (FolderTracker!H). Updating...");
          storedDeadlineEvent.setDescription(eventDescription);
          updateEventGuests(storedDeadlineEvent, studentEmails);
          Logger.log("✅ Updated deadline in NEST Event Calendar (by ID)");
          return;
        }
      }
    } catch (e) {
      // ignore and fall back
    }
    
    // 2) Fallback: check if deadline event already exists by title/date
    var existingDeadline = findExistingDeadlineEvent(calendar, eventTitle, deadlineDate);
    
    if (existingDeadline) {
      Logger.log("  🔄 Deadline exists (by title/date), updating...");
      existingDeadline.setDescription(eventDescription);
      updateEventGuests(existingDeadline, studentEmails);
      Logger.log("  ✅ Updated deadline in NEST Event Calendar");

      // Store ID if we have folderId available
      try {
        if (eventLinks && eventLinks.folderId && typeof setDeadlineCalendarIdForFolder_ === 'function') {
          setDeadlineCalendarIdForFolder_(eventLinks.folderId, existingDeadline.getId());
        }
      } catch (e) {}
      
      return;
    }
    
    // 3) Create all-day deadline event
    var deadlineEvent = calendar.createAllDayEvent(
      eventTitle,
      deadlineDate,
      {
        description: eventDescription,
        location: 'Graham-Kapowsin High School',
        guests: studentEmails.join(','),
        sendInvites: true
      }
    );
    
    Logger.log("  ✅ Added deadline to NEST Event Calendar with " + studentEmails.length + " guests");

    // Store in FolderTracker!H
    try {
      if (deadlineEvent && eventLinks && eventLinks.folderId && typeof setDeadlineCalendarIdForFolder_ === 'function') {
        setDeadlineCalendarIdForFolder_(eventLinks.folderId, deadlineEvent.getId());
      }
    } catch (e) {}
    
  } catch (e) {
    Logger.log("  ❌ Error adding deadline: " + e.message);
  }
}


/**
 * Adds permission slip deadline to calendars for involved preps
 * UPDATED: Still creates/updates per-prep deadline events by title/date,
 * and stores ONE canonical deadline event ID in FolderTracker!H if it's empty.
 *
 * @param {Date} deadlineDate - The calculated deadline date
 * @param {string} tripName - Name of the field trip
 * @param {Array} periods - Array of period names
 * @param {Object} periodPrepMap - Mapping of periods to preps
 * @param {Object} calendarMap - Mapping of preps to calendar IDs
 * @param {Array} studentEmails - Array of student email addresses to invite
 * @param {Object} eventLinks - Object containing folderUrl, folderId, itineraryUrl, permissionFormUrl
 */
function addDeadlineToPreps(deadlineDate, tripName, periods, periodPrepMap, calendarMap, studentEmails, eventLinks) {
  // Get unique preps involved
  var uniquePreps = new Set();
  
  periods.forEach(function(period) {
    var prep = periodPrepMap[period];
    if (prep) {
      uniquePreps.add(prep);
    }
  });
  
  var uniquePrepList = Array.from(uniquePreps);
  Logger.log("📚 Adding deadline to preps: " + uniquePrepList.join(", "));
  
  var deadlinesCreated = 0;
  var deadlinesUpdated = 0;
  
  uniquePrepList.forEach(function(prep) {
    var calendarId = calendarMap[prep];
    
    if (!calendarId) {
      Logger.log("⚠️ No calendar found for prep: " + prep);
      return;
    }
    
    try {
      var calendar = CalendarApp.getCalendarById(calendarId);
      
      if (!calendar) {
        Logger.log("❌ Could not access calendar for " + prep);
        return;
      }
      
      var eventTitle = "📋 " + tripName + " - Permission Slip Deadline";
      
      // Build deadline description with links
      var eventDescription = "⚠️ PERMISSION SLIP DEADLINE ⚠️\n\n";
      eventDescription += "Permission slips for " + tripName + " must be returned by end of day.\n\n";
      eventDescription += "Students from " + prep + " are attending this field trip.\n\n";
      
      eventDescription += '━━━━━━━━━━━━━━━━━━━━━━\n';
      eventDescription += '📎 IMPORTANT LINKS:\n';
      eventDescription += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
      
      if (eventLinks && eventLinks.folderUrl) {
        eventDescription += '📁 Event Folder: ' + eventLinks.folderUrl + '\n\n';
      }
      
      if (eventLinks && eventLinks.itineraryUrl) {
        eventDescription += '📋 Trip Itinerary: ' + eventLinks.itineraryUrl + '\n\n';
      }
      
      if (eventLinks && eventLinks.permissionFormUrl) {
        eventDescription += '✍️ Permission Slip (FILL THIS OUT): ' + eventLinks.permissionFormUrl + '\n\n';
      }
      
      eventDescription += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
      eventDescription += 'This is an automated reminder.';
      
      // Check if deadline event already exists
      var existingDeadline = findExistingDeadlineEvent(calendar, eventTitle, deadlineDate);
      
      if (existingDeadline) {
        Logger.log("  🔄 Deadline exists in " + prep + " calendar, updating...");
        existingDeadline.setDescription(eventDescription);
        updateEventGuests(existingDeadline, studentEmails);
        deadlinesUpdated++;
        Logger.log("  ✅ Updated deadline in " + prep + " calendar");

        // ✅ Store ONE canonical deadline ID in FolderTracker!H if empty
        try {
          if (eventLinks && eventLinks.folderId &&
              typeof getCalendarIdsForFolder_ === 'function' &&
              typeof setDeadlineCalendarIdForFolder_ === 'function') {
            var ids = getCalendarIdsForFolder_(eventLinks.folderId);
            if (!ids.deadlineId) {
              setDeadlineCalendarIdForFolder_(eventLinks.folderId, existingDeadline.getId());
              Logger.log("  🧾 Stored canonical deadline event ID in FolderTracker!H");
            }
          }
        } catch (e) {
          // ignore storage errors
        }
        
        return;
      }
      
      // Create all-day event with student guests and links
      var deadlineEvent = calendar.createAllDayEvent(
        eventTitle,
        deadlineDate,
        {
          description: eventDescription,
          location: 'Graham-Kapowsin High School',
          guests: studentEmails.join(','),
          sendInvites: true
        }
      );
      
      Logger.log("  ✅ Added deadline to " + prep + " calendar with " + studentEmails.length + " guests");
      deadlinesCreated++;

      // ✅ Store ONE canonical deadline ID in FolderTracker!H if empty
      try {
        if (deadlineEvent && eventLinks && eventLinks.folderId &&
            typeof getCalendarIdsForFolder_ === 'function' &&
            typeof setDeadlineCalendarIdForFolder_ === 'function') {
          var ids2 = getCalendarIdsForFolder_(eventLinks.folderId);
          if (!ids2.deadlineId) {
            setDeadlineCalendarIdForFolder_(eventLinks.folderId, deadlineEvent.getId());
            Logger.log("  🧾 Stored canonical deadline event ID in FolderTracker!H");
          }
        }
      } catch (e) {
        // ignore storage errors
      }
      
    } catch (e) {
      Logger.log("  ❌ Error adding deadline to " + prep + " calendar: " + e.message);
    }
  });
  
  if (deadlinesCreated > 0 || deadlinesUpdated > 0) {
    Logger.log("📊 Deadline summary: " + deadlinesCreated + " created, " + deadlinesUpdated + " updated");
  }
}




// ========== HELPER FUNCTIONS ==========

function findExistingEvent(calendar, eventTitle, startDateTime, endDateTime) {
  // Search for events on the same day
  var dayStart = new Date(startDateTime);
  dayStart.setHours(0, 0, 0, 0);
  
  var dayEnd = new Date(startDateTime);
  dayEnd.setHours(23, 59, 59, 999);
  
  var events = calendar.getEvents(dayStart, dayEnd);
  
  // Extract base name without brackets for comparison
  var baseName = eventTitle.replace(/\s*\[.*?\]\s*/g, '').trim();
  
  // Extract day suffix if present (e.g., " - Day 2")
  var daySuffix = '';
  var dayMatch = baseName.match(/(.*?)(\s*-\s*Day\s+\d+)$/i);
  if (dayMatch) {
    baseName = dayMatch[1].trim();
    daySuffix = dayMatch[2].trim();
  }
  
  Logger.log("🔍 Searching for base name: \"" + baseName + "\"" + (daySuffix ? " with suffix: \"" + daySuffix + "\"" : ""));
  
  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    var existingTitle = event.getTitle();
    
    // Extract base name from existing event (remove brackets)
    var existingBaseName = existingTitle.replace(/\s*\[.*?\]\s*/g, '').trim();
    
    // Extract day suffix from existing event
    var existingDaySuffix = '';
    var existingDayMatch = existingBaseName.match(/(.*?)(\s*-\s*Day\s+\d+)$/i);
    if (existingDayMatch) {
      existingBaseName = existingDayMatch[1].trim();
      existingDaySuffix = existingDayMatch[2].trim();
    }
    
    // Compare base names (ignoring brackets and case)
    if (existingBaseName.toLowerCase() === baseName.toLowerCase() && 
        existingDaySuffix.toLowerCase() === daySuffix.toLowerCase()) {
      
      var eventStart = event.getStartTime();
      var timeDiff = Math.abs(eventStart.getTime() - startDateTime.getTime());
      
      // If start times are within 1 hour, consider it the same event
      if (timeDiff < 3600000) { // 1 hour in milliseconds
        Logger.log("✅ Found matching event: \"" + existingTitle + "\" (matches base: \"" + baseName + daySuffix + "\")");
        return event;
      }
    }
  }
  
  Logger.log("❌ No matching event found for: \"" + baseName + daySuffix + "\"");
  return null;
}

function getEventByIdSafe_(eventId) {
  try {
    if (!eventId) return null;
    return CalendarApp.getEventById(eventId);
  } catch (e) {
    return null;
  }
}


function updateEventGuests(event, expectedEmails) {
  // Get current guests
  var currentGuests = event.getGuestList();
  var currentEmails = currentGuests.map(function(guest) {
    return guest.getEmail().toLowerCase();
  });
  
  // Normalize expected emails
  var expectedEmailsLower = expectedEmails.map(function(email) {
    return email.toLowerCase();
  });
  
  Logger.log("👥 Current guests: " + currentEmails.length);
  Logger.log("👥 Expected guests: " + expectedEmailsLower.length);
  
  // Find guests to remove (in current but not in expected)
  var guestsToRemove = [];
  for (var i = 0; i < currentGuests.length; i++) {
    var guestEmail = currentGuests[i].getEmail().toLowerCase();
    if (expectedEmailsLower.indexOf(guestEmail) === -1) {
      guestsToRemove.push(currentGuests[i]);
    }
  }
  
  // Find guests to add (in expected but not in current)
  var guestsToAdd = [];
  for (var j = 0; j < expectedEmails.length; j++) {
    var expectedEmail = expectedEmails[j].toLowerCase();
    if (currentEmails.indexOf(expectedEmail) === -1) {
      guestsToAdd.push(expectedEmails[j]); // Use original case
    }
  }
  
  // Remove guests who are no longer on the list
  if (guestsToRemove.length > 0) {
    Logger.log("➖ Removing " + guestsToRemove.length + " guests");
    guestsToRemove.forEach(function(guest) {
      event.removeGuest(guest.getEmail());
      Logger.log("   Removed: " + guest.getEmail());
    });
  }
  
  // Add new guests
  if (guestsToAdd.length > 0) {
    Logger.log("➕ Adding " + guestsToAdd.length + " guests");
    guestsToAdd.forEach(function(email) {
      event.addGuest(email);
      Logger.log("   Added: " + email);
    });
  }
  
  if (guestsToRemove.length === 0 && guestsToAdd.length === 0) {
    Logger.log("✅ Guest list unchanged");
  }
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

/**
 * Finds existing deadline event in calendar
 * @param {Calendar} calendar - Google Calendar object
 * @param {string} eventTitle - Title to search for
 * @param {Date} deadlineDate - Date to search on
 * @returns {CalendarEvent|null} Existing event or null
 */
function findExistingDeadlineEvent(calendar, eventTitle, deadlineDate) {
  try {
    var dayStart = new Date(deadlineDate);
    dayStart.setHours(0, 0, 0, 0);
    
    var dayEnd = new Date(deadlineDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    var events = calendar.getEvents(dayStart, dayEnd);
    
    for (var i = 0; i < events.length; i++) {
      if (events[i].getTitle() === eventTitle && events[i].isAllDayEvent()) {
        return events[i];
      }
    }
    
    return null;
  } catch (e) {
    Logger.log("⚠️ Error searching for existing deadline: " + e.message);
    return null;
  }
}

// Form submission trigger
function onFieldTripFormSubmitCreateAllCalendars(e) {
  Logger.log("📬 Form submitted, creating/updating calendar events...");
  
  var sheet = e.range.getSheet();
  var row = e.range.getRow();
  // UPDATED: Changed from 28 to 33 columns
  var rowData = sheet.getRange(row, 1, 1, 33).getDisplayValues()[0];
  
  var result = processFieldTripCalendarEvent(rowData, row);
  
  Logger.log("🏁 Created " + result.created + " events, updated " + result.updated + ", skipped " + result.skipped + ".");
}

// Helper functions
function parseTimeString(timeStr) {
  if (!timeStr) return null;
  
  try {
    var match = timeStr.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;
    
    var hours = parseInt(match[1]);
    var minutes = parseInt(match[2]);
    var period = match[4].toUpperCase();
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return { hours: hours, minutes: minutes };
  } catch (e) {
    Logger.log("⚠️ Error parsing time: " + timeStr);
    return null;
  }
}

/**
 * Finds the event folder and retrieves links to folder, itinerary, and permission form
 * @param {string} tripName - Name of the field trip
 * @param {Array} validDays - Array of valid day objects
 * @returns {Object} Object containing folderUrl, folderId, itineraryUrl, and permissionFormUrl
 */
function getEventFolderAndDocumentLinks(tripName, validDays) {
  var links = {
    folderUrl: null,
    folderId: null,
    itineraryUrl: null,
    permissionFormUrl: null
  };
  
  if (!validDays || validDays.length === 0) return links;
  
  // Sort days to get first and last
  var sortedDays = validDays.slice().sort(function(a, b) {
    return new Date(a.date) - new Date(b.date);
  });
  
  var firstDay = new Date(sortedDays[0].date);
  var lastDay = new Date(sortedDays[sortedDays.length - 1].date);
  
  // Format folder name to match the naming convention
  var firstYear = firstDay.getFullYear().toString().slice(-2);
  var firstMonth = ('0' + (firstDay.getMonth() + 1)).slice(-2);
  var firstDate = ('0' + firstDay.getDate()).slice(-2);
  var lastDate = ('0' + lastDay.getDate()).slice(-2);
  
  var folderName;
  if (firstDay.getTime() === lastDay.getTime()) {
    folderName = firstYear + '_' + firstMonth + '_' + firstDate + '_' + tripName;
  } else {
    folderName = firstYear + '_' + firstMonth + '_' + firstDate + '-' + lastDate + '_' + tripName;
  }
  
  Logger.log("🔍 Looking for folder: " + folderName);
  
  // Search for folder in all three locations
  var folderLocations = [
    '1oy8tn_fNRH902LgRHgX_aRHHmYO3ugbB', // Parent
    '12zXeHSjAUYyQDI7ALcIZ1l3R44MMpLGh', // Upcoming Events
    '15rPkgef5lSwchl8-TEH4CZ-bWGP0Whme'  // Closed Events
  ];
  
  var eventFolder = null;
  
  for (var i = 0; i < folderLocations.length; i++) {
    try {
      var location = DriveApp.getFolderById(folderLocations[i]);
      var folders = location.getFoldersByName(folderName);
      
      if (folders.hasNext()) {
        eventFolder = folders.next();
        links.folderUrl = eventFolder.getUrl();
        links.folderId = eventFolder.getId();
        Logger.log("  ✅ Found folder in location " + (i + 1));
        break;
      }
    } catch (e) {
      Logger.log("  ⚠️ Error searching location " + (i + 1) + ": " + e.message);
    }
  }
  
  if (!eventFolder) {
    Logger.log("  ❌ Event folder not found");
    return links;
  }
  
  // Search for itinerary + permission form
  try {
    var files = eventFolder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      var fileName = file.getName();
      
      if (fileName.includes('Itinerary') && file.getMimeType() === MimeType.GOOGLE_DOCS) {
        links.itineraryUrl = file.getUrl();
        Logger.log("  ✅ Found itinerary: " + fileName);
      }
      
      if (fileName.includes('Field Trip Form') && file.getMimeType() === MimeType.PDF) {
        links.permissionFormUrl = file.getUrl();
        Logger.log("  ✅ Found permission form: " + fileName);
      }
    }
  } catch (e) {
    Logger.log("  ⚠️ Error searching for documents: " + e.message);
  }
  
  return links;
}



// ========== DIAGNOSTIC FUNCTIONS ==========

/**
 * DIAGNOSTIC: Simulates the entire calendar event process without making changes
 * Shows what WOULD happen for each event in the spreadsheet
 */
function diagnoseCalendarEventLogic() {
  Logger.log('🔍 ========================================');
  Logger.log('🔍 DIAGNOSTIC: Calendar Event Logic');
  Logger.log('🔍 ========================================\n');
  
  var ss = SpreadsheetApp.openById('117q2rtYkkMCy67SDHF0UD3XXuxtESxh-psXUVCdzB-c');
  var builderSheet = ss.getSheetByName('FieldTripBuilder');
  
  if (!builderSheet) {
    Logger.log("❌ FieldTripBuilder sheet not found.");
    return;
  }
  
  var lastRow = builderSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("⚠️ No form responses found.");
    return;
  }
  
  // UPDATED: Changed from 28 to 33 columns
  var data = builderSheet.getRange(2, 1, lastRow - 1, 33).getDisplayValues();
  
  Logger.log(`📊 Found ${data.length} events in spreadsheet\n`);
  
  // Get mappings once
  var periodPrepMap = getPeriodPrepMapping();
  var calendarMap = getCalendarMapping();
  
  Logger.log('\n' + '='.repeat(100) + '\n');
  
  // Process each event
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowNum = i + 2;
    var tripName = row[2];
    var studentSelection = row[8];
    
    if (!studentSelection) {
      Logger.log(`⏭️ Row ${rowNum}: "${tripName}" - No students selected, would skip.\n`);
      continue;
    }
    
    Logger.log(`\n📅 ROW ${rowNum}: "${tripName}"`);
    Logger.log('─'.repeat(100));
    
    // Parse students and periods
    var studentData = parseStudentsAndPeriods(studentSelection);
    Logger.log(`👥 Students: ${studentData.students.length}`);
    Logger.log(`📚 Periods: [${studentData.periods.join(', ')}]`);
    
    // Determine calendar
    var calendarSelection = determineEventCalendar(studentSelection, studentData);
    Logger.log(`\n📅 CALENDAR DECISION:`);
    Logger.log(`   ✓ Calendar: ${calendarSelection.calendarName}`);
    Logger.log(`   ✓ Reason: ${calendarSelection.reason}`);
    Logger.log(`   ✓ Use NEST Calendar: ${calendarSelection.useNestCalendar}`);
    
    // ========== FIX: Handle CTSO Leadership case ==========
    if (calendarSelection.reason.includes('CTSO Leadership') && studentData.periods.length === 0) {
      studentData.periods = ['CTSO'];
      Logger.log(`   🔧 Fixed: Added CTSO to periods array for calendar creation`);
    }
    
    // UPDATED: Days array with transportation
    var days = [
      { date: row[9],  departure: row[10], arrival: row[11], transportation: row[12] },
      { date: row[14], departure: row[15], arrival: row[16], transportation: row[17] },
      { date: row[19], departure: row[20], arrival: row[21], transportation: row[22] },
      { date: row[24], departure: row[25], arrival: row[26], transportation: row[27] },
      { date: row[29], departure: row[30], arrival: row[31], transportation: row[32] }
    ];
    
    var validDays = days.filter(d => d.date);
    Logger.log(`\n📆 Event Days: ${validDays.length}`);
    
    // Log transportation info
    validDays.forEach(function(day, idx) {
      Logger.log(`   Day ${idx + 1}: ${day.transportation || 'No transportation specified'}`);
    });
    
    if (validDays.length === 0) {
      Logger.log(`   ⚠️ No valid dates - would skip this event`);
      continue;
    }
    
    // Process each day
    validDays.forEach(function(day, dayNum) {
      var eventDate = new Date(day.date);
      var departureTime = parseTimeString(day.departure);
      var arrivalTime = parseTimeString(day.arrival);
      
      if (!departureTime || !arrivalTime) {
        Logger.log(`   ⚠️ Day ${dayNum + 1}: Could not parse times - would skip`);
        return;
      }
      
      var startDateTime = new Date(eventDate);
      startDateTime.setHours(departureTime.hours, departureTime.minutes, 0, 0);
      
      var endDateTime = new Date(eventDate);
      endDateTime.setHours(arrivalTime.hours, arrivalTime.minutes, 0, 0);
      
      if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }
      
      // BUILD EVENT TITLE - different for NEST vs period calendars
      var eventTitleForNest = tripName;
      if (validDays.length > 1) {
        eventTitleForNest += ' - Day ' + (dayNum + 1);
      }
      
      Logger.log(`\n   📆 Day ${dayNum + 1}: ${Utilities.formatDate(eventDate, Session.getScriptTimeZone(), 'MM/dd/yyyy')}`);
      Logger.log(`      Start: ${Utilities.formatDate(startDateTime, Session.getScriptTimeZone(), 'MM/dd/yyyy hh:mm a')}`);
      Logger.log(`      End: ${Utilities.formatDate(endDateTime, Session.getScriptTimeZone(), 'MM/dd/yyyy hh:mm a')}`);
      Logger.log(`      Transportation: ${day.transportation || 'Not specified'}`);
      
      // Check what would happen based on calendar selection
      if (calendarSelection.useNestCalendar) {
        // Would use NEST Event Calendar
        Logger.log(`      Event Title: "${eventTitleForNest}"`);
        Logger.log(`      🎯 Would check: NEST™ Event Calendar`);
        
        try {
          var nestCalendar = CalendarApp.getCalendarById(NEST_EVENT_CALENDAR_ID);
          if (!nestCalendar) {
            Logger.log(`      ❌ ERROR: Cannot access NEST™ Event Calendar`);
            return;
          }
          
          var existingEvent = findExistingEvent(nestCalendar, eventTitleForNest, startDateTime, endDateTime);
          
          if (existingEvent) {
            Logger.log(`      ✅ FOUND existing event in NEST™ Event Calendar`);
            Logger.log(`         Would UPDATE this event`);
            Logger.log(`         Current title: "${existingEvent.getTitle()}"`);
            Logger.log(`         Current start: ${Utilities.formatDate(existingEvent.getStartTime(), Session.getScriptTimeZone(), 'MM/dd/yyyy hh:mm a')}`);
          } else {
            Logger.log(`      ➕ NOT FOUND in NEST™ Event Calendar`);
            Logger.log(`         Would CREATE new event`);
          }
        } catch (e) {
          Logger.log(`      ❌ ERROR checking calendar: ${e.message}`);
        }
        
      } else {
        // Would use period-specific calendars
        Logger.log(`      🎯 Would check period-specific calendars:`);
        
        studentData.periods.forEach(function(period) {
          var prep = periodPrepMap[period];
          
          if (!prep) {
            Logger.log(`         ⚠️ ${period}: No prep mapping found`);
            return;
          }
          
          var calendarId = calendarMap[prep];
          
          if (!calendarId) {
            Logger.log(`         ⚠️ ${period} (${prep}): No calendar ID found`);
            return;
          }
          
          // BUILD PERIOD-SPECIFIC EVENT TITLE (with [Period] tag)
          var periodEventTitle = tripName + ' [' + period + ']';
          if (validDays.length > 1) {
            periodEventTitle += ' - Day ' + (dayNum + 1);
          }
          
          Logger.log(`         📅 ${period} → ${prep}`);
          Logger.log(`            Event Title: "${periodEventTitle}"`);
          
          try {
            var periodCalendar = CalendarApp.getCalendarById(calendarId);
            
            if (!periodCalendar) {
              Logger.log(`            ❌ ERROR: Cannot access calendar`);
              return;
            }
            
            var existingPeriodEvent = findExistingEvent(periodCalendar, periodEventTitle, startDateTime, endDateTime);
            
            if (existingPeriodEvent) {
              Logger.log(`            ✅ FOUND existing event`);
              Logger.log(`               Would UPDATE this event`);
              Logger.log(`               Current title: "${existingPeriodEvent.getTitle()}"`);
            } else {
              Logger.log(`            ➕ NOT FOUND`);
              Logger.log(`               Would CREATE: "${periodEventTitle}"`);
            }
          } catch (e) {
            Logger.log(`            ❌ ERROR: ${e.message}`);
          }
        });
      }
    });
    
    Logger.log('\n' + '='.repeat(100));
  }
  
  Logger.log('\n\n🏁 DIAGNOSTIC COMPLETE');
  Logger.log('✅ No calendar events were created or modified');
  Logger.log('✅ This was a read-only analysis\n');
}

function getEventByIdSafe_(eventId) {
  try {
    if (!eventId) return null;
    return CalendarApp.getEventById(eventId);
  } catch (e) {
    return null;
  }
}

function authTest_Calendar() {
  const cal = CalendarApp.getCalendarById(NEST_EVENT_CALENDAR_ID);
  Logger.log(cal ? cal.getName() : 'Calendar not found / no access');
}

function authTest_RoboticsCalendar() {
  const cal = CalendarApp.getCalendarById('c_2b422570f48c710a09f9a4ad62f01b3a99eba983da39e7cc648454dcf129a079@group.calendar.google.com');
  Logger.log(cal ? ('OK: ' + cal.getName()) : 'NO ACCESS / NOT FOUND');
}

function authTest_CreateEvent_RoboticsCal() {
  const calId = 'c_2b422570f48c710a09f9a4ad62f01b3a99eba983da39e7cc648454dcf129a079@group.calendar.google.com';
  const cal = CalendarApp.getCalendarById(calId);
  Logger.log('Calendar name: ' + (cal ? cal.getName() : 'NULL'));

  const start = new Date(Date.now() + 5 * 60 * 1000);
  const end = new Date(Date.now() + 10 * 60 * 1000);

  const ev = cal.createEvent('[AUTH TEST] write check', start, end, { description: 'If you see this, write works.' });
  Logger.log('✅ Created event id: ' + ev.getId());
}




