function exportFormStructureToSheet() {
  // IDs
  var formId = '1MjIP-pC-aEnARZJc0XB_PsnsLjy-ll8eWEAf45RXW54';
  var spreadsheetId = '117q2rtYkkMCy67SDHF0UD3XXuxtESxh-psXUVCdzB-c';
  
  // Open form and sheet
  var form = FormApp.openById(formId);
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName('FormStructure');
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet('FormStructure');
  }
  
  // Clear existing content
  sheet.clear();
  
  // Set entire sheet to clip cells
  var maxRows = sheet.getMaxRows();
  var maxCols = sheet.getMaxColumns();
  sheet.getRange(1, 1, maxRows, maxCols).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  
  // Set headers in Row 1
  var headers = ['Section Name', 'Question ID', 'Question Type', 'Question', 'Description', 'Options'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  
  // Get all form items
  var items = form.getItems();
  var data = [];
  var currentSection = '';
  
  // Process each item
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var itemType = item.getType();
    
    // Track section headers
    if (itemType == FormApp.ItemType.PAGE_BREAK) {
      var pageBreak = item.asPageBreakItem();
      currentSection = pageBreak.getTitle() || '';
      continue;
    }
    
    if (itemType == FormApp.ItemType.SECTION_HEADER) {
      var section = item.asSectionHeaderItem();
      currentSection = section.getTitle() || '';
      continue;
    }
    
    // Build row data
    var row = [];
    row.push(currentSection); // Section Name
    row.push(item.getId()); // Question ID
    row.push(itemType.toString()); // Question Type
    row.push(item.getTitle() || ''); // Question
    row.push(item.getHelpText() || ''); // Description
    
    // Get options based on question type
    var options = [];
    try {
      switch (itemType) {
        case FormApp.ItemType.MULTIPLE_CHOICE:
          var mcItem = item.asMultipleChoiceItem();
          var choices = mcItem.getChoices();
          for (var j = 0; j < choices.length; j++) {
            options.push(choices[j].getValue());
          }
          break;
          
        case FormApp.ItemType.CHECKBOX:
          var cbItem = item.asCheckboxItem();
          var choices = cbItem.getChoices();
          for (var j = 0; j < choices.length; j++) {
            options.push(choices[j].getValue());
          }
          break;
          
        case FormApp.ItemType.LIST:
          var listItem = item.asListItem();
          var choices = listItem.getChoices();
          for (var j = 0; j < choices.length; j++) {
            options.push(choices[j].getValue());
          }
          break;
          
        case FormApp.ItemType.CHECKBOX_GRID:
          var gridItem = item.asCheckboxGridItem();
          var rows = gridItem.getRows();
          var cols = gridItem.getColumns();
          options.push('Rows: ' + rows.join(', '));
          options.push('Columns: ' + cols.join(', '));
          break;
          
        case FormApp.ItemType.GRID:
          var gridItem = item.asGridItem();
          var rows = gridItem.getRows();
          var cols = gridItem.getColumns();
          options.push('Rows: ' + rows.join(', '));
          options.push('Columns: ' + cols.join(', '));
          break;
          
        case FormApp.ItemType.SCALE:
          var scaleItem = item.asScaleItem();
          options.push('Scale: ' + scaleItem.getLowerBound() + ' to ' + scaleItem.getUpperBound());
          if (scaleItem.getLeftLabel()) options.push('Left: ' + scaleItem.getLeftLabel());
          if (scaleItem.getRightLabel()) options.push('Right: ' + scaleItem.getRightLabel());
          break;
      }
    } catch (e) {
      // Item type doesn't support choices
    }
    
    row.push(options.join(' | ')); // Options joined with pipe separator
    data.push(row);
  }
  
  // Write data starting at Row 4
  if (data.length > 0) {
    sheet.getRange(4, 1, data.length, headers.length).setValues(data);
    
    // Create TEXTJOIN formulas in Row 2 for each column with headers
    var lastRow = 4 + data.length - 1;
    var textjoinFormulas = [];
    
    for (var col = 0; col < headers.length; col++) {
      var colLetter = String.fromCharCode(65 + col); // A, B, C, etc.
      var header = headers[col];
      var formula = '="' + header + ': " & TEXTJOIN(", ", FALSE, ' + colLetter + '4:' + colLetter + lastRow + ')';
      textjoinFormulas.push(formula);
    }
    
    // Write all TEXTJOIN formulas to Row 2
    for (var col = 0; col < textjoinFormulas.length; col++) {
      sheet.getRange(2, col + 1).setFormula(textjoinFormulas[col]);
    }
    
    // Format Row 2
    sheet.getRange(2, 1, 1, headers.length).setFontStyle('italic');
  }
  
  // ========== PIVOT FORM RESPONSES ==========
  Logger.log("📊 Starting pivot of form responses...");
  
  try {
    var builderSheet = ss.getSheetByName('FieldTripBuilder');
    if (!builderSheet) {
      Logger.log("⚠️ FieldTripBuilder sheet not found.");
      SpreadsheetApp.getUi().alert('Form structure exported. FieldTripBuilder sheet not found for response pivot.');
      return;
    }
    
    // Get headers from FieldTripBuilder A1:AG1
    var builderHeaders = builderSheet.getRange('A1:AG1').getValues()[0];
    
    // Find last column with a header
    var lastHeaderCol = 0;
    for (var i = 0; i < builderHeaders.length; i++) {
      if (builderHeaders[i] !== '') {
        lastHeaderCol = i;
      }
    }
    
    // Get response data rows 2-10 (first 9 responses) - using getDisplayValues to preserve formatting
    var responseData = builderSheet.getRange(2, 1, 9, lastHeaderCol + 1).getDisplayValues();
    
    // Create question ID lookup from form items
    var questionIdMap = {};
    for (var i = 0; i < data.length; i++) {
      var questionText = data[i][3]; // Question column
      var questionId = data[i][1]; // Question ID column
      questionIdMap[questionText] = questionId;
    }
    
    // Build pivoted data starting at H3
    // H3 will have header "Response Header (Question ID)"
    sheet.getRange(3, 8).setValue('Response Header (Question ID)').setFontWeight('bold');
    
    // Build pivot rows in H4 and down
    var pivotRows = [];
    for (var headerIdx = 0; headerIdx <= lastHeaderCol; headerIdx++) {
      var headerText = builderHeaders[headerIdx] || '';
      var questionId = questionIdMap[headerText] || '';
      var headerWithId = questionId ? headerText + ' (' + questionId + ')' : headerText;
      pivotRows.push([headerWithId]);
    }
    
    // Write headers with question IDs to H4:H
    if (pivotRows.length > 0) {
      sheet.getRange(4, 8, pivotRows.length, 1).setValues(pivotRows);
      
      // Add TEXTJOIN formula in H1 for all headers
      var lastDataRow = 4 + pivotRows.length - 1;
      var h1Formula = '=TEXTJOIN(", ", FALSE, H4:H' + lastDataRow + ')';
      sheet.getRange(1, 8).setFormula(h1Formula);
      sheet.getRange(1, 8).setFontWeight('bold');
    }
    
    // Now write each response in columns I, J, K, etc. (one column per response)
    for (var responseIdx = 0; responseIdx < responseData.length; responseIdx++) {
      var responseRow = responseData[responseIdx];
      var responseCol = [];
      
      for (var headerIdx = 0; headerIdx <= lastHeaderCol; headerIdx++) {
        responseCol.push([responseRow[headerIdx] || '']);
      }
      
      // Write to column I + responseIdx (I=9, J=10, K=11, etc.)
      var targetCol = 9 + responseIdx;
      if (responseCol.length > 0) {
        sheet.getRange(4, targetCol, responseCol.length, 1).setValues(responseCol);
      }
      
      // Add TEXTJOIN formula in Row 1 for this response column
      var colLetter = columnToLetter(targetCol);
      var lastDataRow = 4 + pivotRows.length - 1;
      
      // Include H4 value in the textjoin so we know which question each value belongs to
      var textjoinFormula = '=TEXTJOIN(", ", FALSE, ' + colLetter + '4:' + colLetter + lastDataRow + ')';
      sheet.getRange(1, targetCol).setFormula(textjoinFormula);
      sheet.getRange(1, targetCol).setFontWeight('bold');
      
      // Add a header label for the response column in Row 3
      sheet.getRange(3, targetCol).setValue('Response ' + (responseIdx + 1)).setFontWeight('bold');
    }
    
    Logger.log("✅ Pivoted " + responseData.length + " responses with " + (lastHeaderCol + 1) + " fields each.");
    
  } catch (e) {
    Logger.log("❌ Error pivoting form responses: " + e.message);
    SpreadsheetApp.getUi().alert('Form structure exported. Error pivoting responses: ' + e.message);
    return;
  }
  
  Logger.log('Form structure and responses exported successfully!');
  SpreadsheetApp.getUi().alert('Form structure and pivoted responses have been exported to the FormStructure tab.');
}

// Helper function to convert column number to letter
function columnToLetter(column) {
  var temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

function syncFieldTripFormStudentOptions() {
  Logger.log("🚀 Starting syncFieldTripFormStudentOptions");

  const form = FormApp.openById('1MjIP-pC-aEnARZJc0XB_PsnsLjy-ll8eWEAf45RXW54');

  let currentAttendeesLabel = '';
  try {
    const signOutSheet = SpreadsheetApp.openById('1Ol_UUo9LNFROm_7Bwk0wzuILP7x-YJmmC_b8xFB-5Pc').getSheetByName('SignOuts');
    const data = signOutSheet.getRange('A7:D' + signOutSheet.getLastRow()).getValues();
    const attendanceRows = data.filter(row => row[2] === "Attendance_NEST Robotics");
    if (attendanceRows.length === 0) {
      Logger.log("⚠️ No rows found for Attendance_NEST Robotics.");
    } else {
      const getDate = ts => Utilities.formatDate(new Date(ts), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const grouped = {};
      attendanceRows.forEach(row => {
        const date = getDate(row[0]);
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(row[3]);
      });

      const latestDate = Object.keys(grouped).sort().pop();
      const currentAttendees = grouped[latestDate].filter(Boolean).map(name => name.trim());
      currentAttendeesLabel = `CURRENT ATTENDEES: ${currentAttendees.join('; ')}`;
      Logger.log(`👥 Found ${currentAttendees.length} attendees on ${latestDate}.`);
    }
  } catch (e) {
    Logger.log("❌ Failed to pull CURRENT ATTENDEES: " + e.message);
  }

  let divisionBlocks = [];
  try {
    const leadershipSheet = SpreadsheetApp.openById('1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I').getSheetByName('Imported');
    const periods = leadershipSheet.getRange('B2:B').getValues().flat();
    const names = leadershipSheet.getRange('E2:E').getValues().flat();

    const divisionMap = {};

    periods.forEach((period, i) => {
      if (period && names[i]) {
        const cleanPeriod = period.toString().replace("Period ", "DIVISION ");
        if (!divisionMap[cleanPeriod]) divisionMap[cleanPeriod] = [];
        divisionMap[cleanPeriod].push(names[i].trim());
      }
    });

    for (const division of Object.keys(divisionMap).sort()) {
      const block = `${division} LEADERSHIP: ${divisionMap[division].join('; ')}`;
      divisionBlocks.push(block);
    }

    Logger.log(`🏛️ Added ${divisionBlocks.length} division blocks.`);
  } catch (e) {
    Logger.log("❌ Failed to build division leadership sections: " + e.message);
  }

  // Build period-based student groups
  let periodGroups = [];
  let labelData = [];
  try {
    const studentSheet = SpreadsheetApp.openById('12XogWM3af3PLIvEyrFR39hzkI0kEmfiCZkr66y3eDcU').getSheetByName('EnrolledStudents');
    const names = studentSheet.getRange('F9:F').getValues().flat();
    const periods = studentSheet.getRange('G9:G').getValues().flat();

    // Create a map of periods to students
    const periodMap = {};
    
    names.forEach((name, i) => {
      const period = periods[i] || '';
      const studentLabel = `${name.trim()}_(${period.toString().trim()})`;
      
      if (name && name.trim() !== '' && studentLabel !== '_()') {
        // Add to individual student list
        labelData.push(studentLabel);
        
        // Add to period grouping
        const periodKey = period.toString().trim();
        if (periodKey) {
          if (!periodMap[periodKey]) periodMap[periodKey] = [];
          periodMap[periodKey].push(name.trim());
        }
      }
    });

    // Remove duplicates from individual student list
    labelData = [...new Set(labelData)];

    // Create period group options
    const periodOrder = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 7', 'CTSO'];
    
    periodOrder.forEach(period => {
      if (periodMap[period] && periodMap[period].length > 0) {
        const periodLabel = `ALL ${period.toUpperCase()} STUDENTS: ${periodMap[period].join('; ')}`;
        periodGroups.push(periodLabel);
      }
    });

    Logger.log(`📅 Added ${periodGroups.length} period group options.`);
    Logger.log(`🎓 Loaded ${labelData.length} individual student entries from EnrolledStudents.`);
  } catch (e) {
    Logger.log("❌ Failed to read EnrolledStudents: " + e.message);
  }

  try {
    // Question ID for "Select the students included in this field trip."
    const checkboxItem = form.getItemById(78756040);
    
    if (checkboxItem.getType() === FormApp.ItemType.CHECKBOX) {
      let allChoices = [];

      // Add CURRENT ATTENDEES
      if (currentAttendeesLabel) allChoices.push(currentAttendeesLabel);

      // Add division leadership blocks
      allChoices = allChoices.concat(divisionBlocks);

      // Add period-based student groups
      allChoices = allChoices.concat(periodGroups);

      // Add individual student roster
      allChoices = allChoices.concat(labelData);

      checkboxItem.asCheckboxItem().setChoiceValues(allChoices);
      Logger.log(`✅ Updated field trip checkbox with ${allChoices.length} choices.`);
      Logger.log(`   - Current Attendees: ${currentAttendeesLabel ? 1 : 0}`);
      Logger.log(`   - Division Leadership: ${divisionBlocks.length}`);
      Logger.log(`   - Period Groups: ${periodGroups.length}`);
      Logger.log(`   - Individual Students: ${labelData.length}`);
    } else {
      Logger.log('❌ Checkbox question not found or not a checkbox.');
    }
  } catch (e) {
    Logger.log("❌ Failed to update checkbox question: " + e.message);
  }

  Logger.log("🏁 Finished syncFieldTripFormStudentOptions");
}
