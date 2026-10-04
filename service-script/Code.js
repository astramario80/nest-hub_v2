/* ============================================================================
   [SECTION 1] CONFIGURATION & ENVIRONMENT GLOBAL SETUP
   ============================================================================ */

const CONFIG = {
  IDS: {
    SERVICE_SS:              "1hSTOG16yGajUsrlywCHThvbMx9JHXQzmpAN43yzAXb0",
    ENROLLED_SS:             "12XogWM3af3PLIvEyrFR39hzkI0kEmfiCZkr66y3eDcU",
    LEADERSHIP_SS:           "1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I",
    STAFF_ROSTER_SS:         "1SXaKUeh3tCsBVSdO90iWWX_pL8WhNe7aTSrELEIE98o",

    SERVICE_REQUEST_FORM_URL: "https://docs.google.com/forms/d/1yZAY6_oO-2BwdQdTPXrUkbKRh3LKC4O3AC8Hhb8XmLI/edit",
    SERVICE_REQUEST_STAFF_NAME_ITEM_ID: 1210417762,
    CLIENT_REVIEW_FORM_URL:   "https://docs.google.com/forms/d/1KJZ8ck7H1ncT8i2mktbiUlPaNnd8biabV1fF2YZKIjI/edit",
    CLIENT_REVIEW_FORM_ID:    "1KJZ8ck7H1ncT8i2mktbiUlPaNnd8biabV1fF2YZKIjI",

    NEST_BANNER_FILE_ID:      "13iPBi6C_RU3XZLL3CLxuE8D0BBZQ9q_f",
    NEST_MENU_BANNER_URL:     "https://docs.google.com/presentation/d/19iyg0iYq2L-jJBWIGbYBN4sIRUuW84W0rm9fLNO6QT0/present?slide=id.p1",
    SERVICE_REVIEW_FORM_URL:  "https://forms.gle/J3xe3qBiy7mReFLq6",
  },

  TABS: {
    SERVICE_REQUESTS:     "ServiceRequests",
    CLIENT_REVIEWS:       "ClientReviews",
    CLOSED_TICKETS:       "Closed Tickets",
    FORM_STRUCTURE:       "FormStructure",
    SERVICE_BAROMETER:    "ServiceBarometer",

    ENROLLED_STUDENTS:    "EnrolledStudents",
    COMBINED_STUDENT_LIST:"CombinedStudentList",
    LEADERSHIP_IMPORTED:  "Imported",
    STAFF_SHARED_DATA:    "Shared_data",

    EMAIL_QUEUE:          "EmailQueue",
  }
};

const STATUS_OPTIONS = ["New!", "Assigned", "In Progress", "Completed", "Closed"];
const SERVICE_REQUEST_FORM_URL_ = 'https://docs.google.com/forms/d/1yZAY6_oO-2BwdQdTPXrUkbKRh3LKC4O3AC8Hhb8XmLI/edit#responses';

/* ============================================================================
   [SECTION 2] CORE ROUTERS & TRIGGER ENTRYPOINTS
   ============================================================================ */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Status Log")
    .addItem("Send Update to Client", "triggerSendUpdateToClient")
    .addItem("Add to Log", "triggerAddToLog")
    .addToUi();
}

function TRG_onOpen(e) {
  try { onOpen(); } catch (err) { Logger.log("TRG_onOpen > onOpen error: " + err); }
  try { calculateDaysOpened(); } catch (err) { Logger.log("TRG_onOpen > calculateDaysOpened error: " + err); }
  try { updateServiceBarometer(); } catch (err) { Logger.log("TRG_onOpen > updateServiceBarometer error: " + err); }
}

function TRG_onEdit(e) {
  if (!e || !e.range) return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log("Skipped duplicate trigger execution.");
    return;
  }

  try {
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    const row = e.range.getRow();
    const col = e.range.getColumn();
    if (row < 2) return;

    const isTicketSheet =
      sheetName === CONFIG.TABS.SERVICE_REQUESTS ||
      sheetName === CONFIG.TABS.CLOSED_TICKETS;

    if (sheetName === CONFIG.TABS.SERVICE_REQUESTS && col === 1) {
      try { logProjectNotes(e); } catch (err) { Logger.log("Status log: " + err); }
      try { handleStatusChange(e); } catch (err) { Logger.log("handleStatusChange error: " + err); }
      try { sendFinalClosureNotificationAndArchive(e); } catch (err) { Logger.log("sendFinalClosureNotificationAndArchive error: " + err); }
      try { applyBackgroundAndFontColors(); } catch (err) { Logger.log("applyBackgroundAndFontColors error: " + err); }
      try { sortFormResponses(); } catch (err) { Logger.log("sortFormResponses error: " + err); }
      return;
    }

    if (isTicketSheet && col === 2) {
      try { logProjectNotes(e); } catch (err) { Logger.log("Assignment log: " + err); }
      try { updateStudentNameHyperlinks(); } catch (err) { Logger.log("updateStudentNameHyperlinks error: " + err); }
      try { notifyAndShareWithLeadershipAndProjectManagers(e); } catch (err) { Logger.log("notifyAndShareWithLeadershipAndProjectManagers error: " + err); }
      try { handlePmAssignmentChange_(sheetName, row); } catch (err) { Logger.log("handlePmAssignmentChange_ error: " + err); }
      try { updateServiceBarometer(); } catch (err) { Logger.log("updateServiceBarometer error: " + err); }
      return;
    }

    if (sheetName === CONFIG.TABS.SERVICE_REQUESTS && col !== 3) {
      try { logProjectNotes(e); } catch (err) { Logger.log("logProjectNotes error: " + err); }
      return;
    }

    if (sheetName === CONFIG.TABS.CLOSED_TICKETS && col === 1) {
      try { moveReopenedTickets(); } catch (err) { Logger.log("moveReopenedTickets error: " + err); }
      return;
    }

    if (sheetName === CONFIG.TABS.CLIENT_REVIEWS) {
      try { updateClientReviewsSheetHyperlinks(); } catch (err) { Logger.log("updateClientReviewsSheetHyperlinks error: " + err); }
      return;
    }

  } catch (err) {
    Logger.log("TRG_onEdit fatal error: " + err);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function TRG_onFormSubmit(e) {
  Logger.log("🚀 TRG_onFormSubmit trigger engaged...");
  try {
    if (typeof notifyLeadershipOnNewRequest === "function") {
      notifyLeadershipOnNewRequest(e);
    }
  } catch (err) {
    Logger.log("❌ Error running notifyLeadershipOnNewRequest: " + err.message);
  }
  try {
    syncStaffFormNamesDynamic();
  } catch (err) {
    Logger.log("❌ Error running syncStaffFormNamesDynamic: " + err.message);
  }
  Logger.log("🏁 TRG_onFormSubmit execution stack complete.");
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({status:401})).setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================================
   [SECTION 3] SERVICE TICKETS LOGIC, METRICS, & WORKFLOWS
   ============================================================================ */

function handleStatusChange(e) {
  const sheet = e.range.getSheet();
  const range = e.range;

  if (sheet.getName() === CONFIG.TABS.SERVICE_REQUESTS && range.getColumn() === 1 && range.getRow() > 1) {
    const newValue = range.getValue();
    const row = range.getRow();
    const rowRange = sheet.getRange(row, 1, 1, sheet.getLastColumn());
    rowRange.setFontWeight(newValue === "New!" ? "bold" : "normal");
  }
}

function calculateDaysOpened() {
  const sheet=getServiceSheet_(CONFIG.TABS.SERVICE_REQUESTS);if(!sheet||sheet.getLastRow()<2)return;
  const headers=serviceHeaders_(sheet),timestamp=headers.indexOf('Timestamp')+1,col=serviceEnsureColumn_(sheet,'Days Opened');
  const values=sheet.getRange(2,timestamp,sheet.getLastRow()-1,1).getValues().map(([created])=>{const date=created instanceof Date?created:new Date(created);return [created&&Number.isFinite(date.getTime())?Math.max(0,Math.floor((Date.now()-date.getTime())/86400000)):''];});
  sheet.getRange(2,col,values.length,1).setValues(values);
}

function sortFormResponses() {
  const sheet=getServiceSheet_(CONFIG.TABS.SERVICE_REQUESTS);if(!sheet||sheet.getLastRow()<2)return;
  calculateDaysOpened();const headers=serviceHeaders_(sheet),sort=serviceEnsureColumn_(sheet,'NEST Sort'),days=headers.indexOf('Days Opened')+1,urgency=headers.findIndex(h=>/How fast do you need/i.test(h))+1;
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
  sheet.getRange(2,sort,rows.length,1).setValues(rows.map(r=>[r[0]==='New!'?0:['Completed','Closed'].includes(r[0])?2:1]));
  const order=[{column:sort,ascending:true}];if(urgency>0)order.push({column:urgency,ascending:false});if(days>0)order.push({column:days,ascending:false});
  sheet.getRange(2,1,rows.length,sheet.getLastColumn()).sort(order);
}

function applyBackgroundAndFontColors() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const formStructureSheet = ss.getSheetByName(CONFIG.TABS.FORM_STRUCTURE);
  const serviceRequestsSheet = ss.getSheetByName(CONFIG.TABS.SERVICE_REQUESTS);

  const formStructureRange = formStructureSheet.getRange(2, 10, formStructureSheet.getLastRow() - 1, 3); 
  const formStructureData = formStructureRange.getValues();

  const serviceRequestsRange = serviceRequestsSheet.getRange(2, 1, serviceRequestsSheet.getLastRow() - 1, serviceRequestsSheet.getLastColumn());
  const serviceRequestsData = serviceRequestsRange.getValues();

  serviceRequestsData.forEach((row, index) => {
    const status = row[0];
    const timestamp = row[3];
    const rowRange = serviceRequestsSheet.getRange(index + 2, 1, 1, serviceRequestsSheet.getLastColumn());

    if (!timestamp) {
      rowRange.setBackground(null);
      rowRange.setFontColor(null);
    } else {
      const matchingStatus = formStructureData.find(item => item[0] === status);
      if (matchingStatus) {
        const backgroundColor = matchingStatus[1];
        const fontColor = matchingStatus[2];
        if (backgroundColor && fontColor) {
          rowRange.setBackground(backgroundColor);
          rowRange.setFontColor(fontColor);
        }
      }
    }
  });

  formStructureData.forEach((row, index) => {
    const backgroundColor = row[1];
    const fontColor = row[2];
    const rowRange = formStructureSheet.getRange(index + 2, 10, 1, 3);
    if (backgroundColor && fontColor) {
      rowRange.setBackground(backgroundColor);
      rowRange.setFontColor(fontColor);
    }
  });
}

function logProjectNotes(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  if (sheetName !== CONFIG.TABS.SERVICE_REQUESTS && sheetName !== CONFIG.TABS.CLIENT_REVIEWS) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row < 2) return;
  if (col === 3) return;

  const newValue = e.range.getValue();
  if (newValue === "" || newValue === null) return;

  const header = sheet.getRange(1, col).getValue();
  const oldValue = (typeof e.oldValue !== "undefined") ? e.oldValue : null;

  const icon = (col === 1) ? iconForStatus_(newValue) : iconForGeneralEdit_();
  const msg = oldValue === null
    ? `${header} changed to: ${newValue}`
    : `${header} changed: "${oldValue}" → "${newValue}"`;

  prependProjectLogEntry_({ sheet, row, icon, message: msg });
}

/* ============================================================================
   [SECTION 4] FORM STRUCTURE & STAFF ROSTER MAINTENANCE
   ============================================================================ */

function populateServiceRequestFormStructure() {
  const form = FormApp.openByUrl(SERVICE_REQUEST_FORM_URL_);
  const sheet = getServiceRequestFormStructureSheet_();
  const items = form.getItems();

  sheet.getRange('A1:C1').breakApart();
  sheet.getRange('A1:C1').merge().setValue('Service Request Form Structure');
  sheet.getRange('A2:C2').setValues([['Question', 'Question Type', 'Form Question ID']]);
  sheet.getRange(3, 1, sheet.getMaxRows() - 2, 3).clearContent();
  sheet.getRange(3, 3, sheet.getMaxRows() - 2, 1).setNumberFormat('@');

  if (items.length) {
    const rows = items.map(item => [item.getTitle(), String(item.getType()), String(item.getId())]);
    sheet.getRange(3, 1, rows.length, 3).setValues(rows);
  }

  if (CONFIG.IDS.SERVICE_REQUEST_STAFF_NAME_ITEM_ID) {
    refreshServiceRequestStaffChoices_();
  } else {
    Logger.log('Set CONFIG.IDS.SERVICE_REQUEST_STAFF_NAME_ITEM_ID from FormStructure column C to enable staff-choice sync.');
  }
}

function updateServiceRequestFormQuestionsFromStructure() {
  const form = FormApp.openByUrl(SERVICE_REQUEST_FORM_URL_);
  const sheet = getServiceRequestFormStructureSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  const rows = sheet.getRange(3, 1, lastRow - 2, 3).getValues();
  const formItems = form.getItems();
  const itemsById = new Map(formItems.map(item => [String(item.getId()), item]));
  const entries = rows.map((row, index) => ({
    sheetRow: index + 3,
    title: String(row[0] == null ? '' : row[0]).trim(),
    type: String(row[1] == null ? '' : row[1]).trim().toUpperCase(),
    id: String(row[2] == null ? '' : row[2]).trim(),
    item: null
  })).filter(entry => (entry.title || entry.type || entry.id) && !(entry.sheetRow === 3 && entry.type === 'ITEM TYPE' && /ID/i.test(entry.id)));
  const seenIds = new Set();
  const changes = [];

  entries.forEach(entry => {
    if (!entry.title) throw new Error(`FormStructure!A${entry.sheetRow} needs a question title.`);
    if (!entry.type) throw new Error(`FormStructure!B${entry.sheetRow} needs a question type.`);
    if (!entry.id) return;
    if (!/^\d+$/.test(entry.id)) throw new Error(`FormStructure!C${entry.sheetRow} is not a numeric form item ID.`);
    const item = itemsById.get(entry.id);
    if (!item) return;
    if (seenIds.has(entry.id)) throw new Error(`Duplicate form item ID ${entry.id} in FormStructure row ${entry.sheetRow}.`);
    entry.item = item;
    seenIds.add(entry.id);
  });

  entries.filter(entry => !entry.item).forEach(entry => {
    const matches = formItems.filter(item =>
      !seenIds.has(String(item.getId())) &&
      String(item.getType()).toUpperCase() === entry.type &&
      item.getTitle().trim() === entry.title
    );
    if (matches.length === 1) {
      entry.item = matches[0];
      seenIds.add(String(entry.item.getId()));
    }
  });

  const sameOrderAndTypes = entries.length === formItems.length &&
    entries.every((entry, index) =>
      entry.sheetRow === index + (entries[0] ? entries[0].sheetRow : 3) &&
      entry.type === String(formItems[index].getType()).toUpperCase() &&
      (!entry.item || entry.item.getId() === formItems[index].getId())
    );
  if (sameOrderAndTypes) {
    entries.forEach((entry, index) => {
      if (!entry.item) {
        entry.item = formItems[index];
        seenIds.add(String(entry.item.getId()));
      }
    });
  }

  entries.forEach(entry => {
    if (!entry.item) throw new Error(`Could not safely match FormStructure row ${entry.sheetRow} to the new form.`);
    if (entry.type !== String(entry.item.getType()).toUpperCase()) throw new Error(`FormStructure!B${entry.sheetRow} misaligned type.`);
    if (!['IMAGE', 'PAGE_BREAK', 'SECTION_HEADER', 'VIDEO'].includes(entry.type) && entry.title !== entry.item.getTitle()) {
      changes.push({ item: entry.item, title: entry.title });
    }
  });

  entries.forEach(entry => {
    const id = String(entry.item.getId());
    if (entry.id !== id) sheet.getRange(entry.sheetRow, 3).setNumberFormat('@').setValue(id);
  });
  changes.forEach(({ item, title }) => item.setTitle(title));
  if (CONFIG.IDS.SERVICE_REQUEST_STAFF_NAME_ITEM_ID) refreshServiceRequestStaffChoices_();
  Logger.log(`Updated ${changes.length} form question title(s).`);
}

function refreshServiceRequestStaffChoices_() {
  const id = Number(CONFIG.IDS.SERVICE_REQUEST_STAFF_NAME_ITEM_ID);
  const form = FormApp.openByUrl(SERVICE_REQUEST_FORM_URL_);
  const item = form.getItemById(id);
  if (!item || item.getType() !== FormApp.ItemType.LIST) throw new Error(`Staff item ${id} structure mismatch.`);

  const staffSheet = SpreadsheetApp.openById(CONFIG.IDS.STAFF_ROSTER_SS).getSheetByName(CONFIG.TABS.STAFF_SHARED_DATA);
  const lastRow = staffSheet.getLastRow();
  if (lastRow < 2) return;
  const values = staffSheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const names = values.map(([last, first, email]) => {
    return last && first && String(email || '').trim() ? `${String(last).trim()}, ${String(first).trim()} (${String(email).trim()})` : null;
  }).filter(Boolean);
  const choices = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  item.asListItem().setChoiceValues(choices);
}

function syncStaffFormNamesDynamic() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const structureSheet = ss.getSheetByName(CONFIG.TABS.FORM_STRUCTURE);
  if (!structureSheet) return;

  const lastRowStructure = structureSheet.getLastRow();
  let staffNameQuestionId = null;
  const targetTitle = "Choose your name below:";
  
  if (lastRowStructure >= 4) {
    const structureData = structureSheet.getRange(4, 1, lastRowStructure - 3, 3).getValues();
    for (let i = 0; i < structureData.length; i++) {
      if (structureData[i][0] === targetTitle) {
        staffNameQuestionId = structureData[i][2];
        break;
      }
    }
  }
  if (!staffNameQuestionId) return;

  const serviceFormUrl = CONFIG.IDS.SERVICE_REQUEST_FORM_URL;
  const staffSheetId  = CONFIG.IDS.STAFF_ROSTER_SS;
  const staffTabName  = CONFIG.TABS.STAFF_SHARED_DATA;

  let staffSs = SpreadsheetApp.openById(staffSheetId);
  const staffSheet = staffSs.getSheetByName(staffTabName);
  const lastRowStaff = staffSheet.getLastRow();
  if (lastRowStaff < 2) return;

  const rosterData = staffSheet.getRange("A2:C" + lastRowStaff).getValues();
  let choices = [];
  for (let i = 0; i < rosterData.length; i++) {
    let lastName  = (rosterData[i][0] || "").toString().trim();
    let firstName = (rosterData[i][1] || "").toString().trim();
    if (lastName && firstName && String(rosterData[i][2] || '').trim()) {
      choices.push(`${lastName}, ${firstName} (${String(rosterData[i][2]).trim()})`);
    }
  }

  choices = [...new Set(choices)].sort((a, b) => a.localeCompare(b));
  if (choices.length === 0) return;

  try {
    const form = FormApp.openByUrl(serviceFormUrl);
    const targetItem = form.getItemById(Number(staffNameQuestionId));
    if (targetItem && targetItem.getType() === FormApp.ItemType.LIST) {
      targetItem.asListItem().setChoiceValues(choices);
    } else if (targetItem && targetItem.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      targetItem.asMultipleChoiceItem().setChoiceValues(choices);
    }
  } catch (formErr) {
    Logger.log("❌ Dynamic Form sync failed: " + formErr.message);
  }
}

function updateFormStructuresAndLogIds() {
  const serviceFormUrl  = CONFIG.IDS.SERVICE_REQUEST_FORM_URL;
  const targetSheetName = CONFIG.TABS.FORM_STRUCTURE;
  const targetTitle     = "Choose your name below:";
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let structureSheet = ss.getSheetByName(targetSheetName) || ss.insertSheet(targetSheetName);
  structureSheet.clear();

  structureSheet.getRange("A1:C1").merge().setValue("Service Request Form Structure Map").setFontWeight("bold");
  const headers = ["Question Text / Title", "Item Type", "New Form ID / Property ID"];
  structureSheet.getRange("A3:C3").setValues([headers]).setFontWeight("bold");

  const form = FormApp.openByUrl(serviceFormUrl);
  const items = form.getItems();
  const outputRowData = [];
  
  items.forEach(item => {
    const title = item.getTitle() || "[Untitled]";
    const itemType = item.getType().toString();
    const itemId = item.getId();
    outputRowData.push([title, itemType, itemId]);
  });

  if (outputRowData.length > 0) {
    structureSheet.getRange(4, 1, outputRowData.length, 3).setValues(outputRowData);
  }
  SpreadsheetApp.getUi().alert("Form structure compiled.");
}

function populateClientReviewFormStructure() {
  const form = FormApp.openByUrl(CONFIG.IDS.CLIENT_REVIEW_FORM_URL);
  const sheet = SpreadsheetApp.openById(CONFIG.IDS.SERVICE_SS).getSheetByName(CONFIG.TABS.FORM_STRUCTURE);
  sheet.getRange("E1:G").clearContent();
  sheet.getRange("E1:G1").merge().setValue("Client Review Form Structure").setFontWeight("bold").setHorizontalAlignment("center");
  
  const headers = ["Form ID", "Question Type", "Question"];
  sheet.getRange("E4:G4").setValues([headers]).setFontWeight("bold");

  const items = form.getItems();
  const data = items.map(item => [item.getId(), item.getType().toString(), item.getTitle()]);

  if (data.length > 0) {
    sheet.getRange(5, 5, data.length, 3).setValues(data);
    const joinedE = [headers[0], ...data.map(row => row[0]).filter(val => val)].join("; ");
    const joinedF = [headers[1], ...data.map(row => row[1]).filter(val => val)].join("; ");
    const joinedG = [headers[2], ...data.map(row => row[2]).filter(val => val)].join("; ");
    sheet.getRange("E3:G3").setValues([[joinedE, joinedF, joinedG]]);
  }
}

/* ============================================================================
   [SECTION 5] SECURITY & SHEET PROTECTIONS (INLINE DEEP LAYER)
   ============================================================================ */

function handlePmAssignmentChange_(sheetName,row) {
  const sheet=getServiceSheet_(sheetName);if(!sheet)return;
  ensureAllSheetsBaselineProtection_();syncTicketRowProtection_(sheet,row,2);reconcileServiceSpreadsheetEditors_();
}

function ensureAllSheetsBaselineProtection_() {
  const ss = SpreadsheetApp.openById(CONFIG.IDS.SERVICE_SS);
  ss.getSheets().forEach(sh => ensureSheetBaselineProtection_(sh));
}

function ensureSheetBaselineProtection_(sheet) {
  if(!sheet)return;const allowed=serviceEditorEmails_(),tag='BASELINE_SHEET_PROTECT:'+sheet.getName();
  const prot=sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).find(p=>p.getDescription()===tag)||sheet.protect();prot.setDescription(tag);prot.setWarningOnly(false);
  prot.getEditors().forEach(user=>{if(!allowed.has(user.getEmail().toLowerCase()))prot.removeEditor(user);});prot.addEditors([...allowed]);if(prot.canDomainEdit())prot.setDomainEdit(false);
}

function syncTicketRowProtection_(sheet,row,pmCol) {
  if(!sheet||row<2)return;const allowed=serviceEditorEmails_(),range=sheet.getRange(row,1,1,sheet.getLastColumn()),tag='TICKET_ROW_PROTECT:'+sheet.getName()+':r='+row;
  const prot=sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).find(p=>p.getDescription()===tag)||range.protect();prot.setDescription(tag);prot.setRange(range);prot.setWarningOnly(false);
  prot.getEditors().forEach(user=>{if(!allowed.has(user.getEmail().toLowerCase()))prot.removeEditor(user);});prot.addEditors([...allowed]);if(prot.canDomainEdit())prot.setDomainEdit(false);
}

function reconcileServiceSpreadsheetEditors_() {
  const file=getServiceFile_(),allowed=serviceEditorEmails_(),current=file.getEditors().map(u=>u.getEmail().toLowerCase());
  allowed.forEach(email=>{if(!current.includes(email))file.addEditor(email);});current.forEach(email=>{if(!allowed.has(email))file.removeEditor(email);});
}

function Tool_RebuildAllTicketRowProtections() {
  const PM_COL = 2;
  [CONFIG.TABS.SERVICE_REQUESTS, CONFIG.TABS.CLOSED_TICKETS].forEach(tabName => {
    const sheet = getServiceSheet_(tabName);
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    for (let r = 2; r <= lastRow; r++) {
      if (!sheet.getRange(r, 4).getValue()) continue;
      syncTicketRowProtection_(sheet, r, PM_COL);
    }
  });
  Logger.log("✅ Rebuilt row protections.");
}

function notifyAndShareWithLeadershipAndProjectManagers(e) {
  reconcileServiceSpreadsheetEditors_();ensureAllSheetsBaselineProtection_();
}

/* ============================================================================
   [SECTION 6] EMAIL QUEUE PLATFORM SYSTEM
   ============================================================================ */

function queueEmail_({to,subject,htmlBody,sourceSheet='',sourceRow=0,logIcon='✉️'}) {
  const ss=getServiceSs_(),queue=ss.getSheetByName(CONFIG.TABS.EMAIL_QUEUE)||createEmailQueueSheet();serviceEnsureColumn_(queue,'Request ID');
  const sheet=sourceSheet&&ss.getSheetByName(sourceSheet),id=sheet&&sourceRow>=2?serviceTicketId_(sheet,sourceRow):'';
  queue.appendRow(['Pending',to,subject,htmlBody,sourceSheet,sourceRow,logIcon,new Date(),'',id]);
}

function processEmailQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const queueSheet = ss.getSheetByName(CONFIG.TABS.EMAIL_QUEUE);
    if (!queueSheet) return;

    const lastRow = queueSheet.getLastRow();
    if (lastRow < 2) return;

    const data = queueSheet.getRange(2, 1, lastRow - 1, 10).getValues();
    let bannerBlob = null;
    try { bannerBlob = DriveApp.getFileById(CONFIG.IDS.NEST_BANNER_FILE_ID).getBlob(); } catch (_) {}

    data.forEach((row, i) => {
      const sheetRow  = i + 2;
      if (row[0] !== "Pending") return;

      const to          = row[1];
      const subject     = row[2];
      const htmlBody    = row[3];
      const sourceSheet = row[4];
      const sourceRow   = Number(row[5]);
      const logIcon     = row[6] || "✉️";
      try {
        const emailOptions = { htmlBody };
        if (bannerBlob) emailOptions.inlineImages = { nestBanner: bannerBlob };
        GmailApp.sendEmail(to, subject, "", emailOptions);

        queueSheet.getRange(sheetRow, 1).setValue("Sent");
        queueSheet.getRange(sheetRow, 9).setValue(new Date());

        if (row[9]) {
          const resolved = serviceRowById_(row[9]);
          const ticketSheet = resolved.sheet;
          if (ticketSheet) {
            prependProjectLogEntry_({
              sheet: ticketSheet, row: resolved.row, icon: logIcon || "✉️",
              message: `Email delivered to ${to} — Subject: "${subject}"`
            });
          }
        }
      } catch (sendErr) {
        queueSheet.getRange(sheetRow, 1).setValue("Error: " + sendErr.message);
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function createEmailQueueSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(CONFIG.TABS.EMAIL_QUEUE)) return ss.getSheetByName(CONFIG.TABS.EMAIL_QUEUE);

  const sheet = ss.insertSheet(CONFIG.TABS.EMAIL_QUEUE);
  const headers = ["Status", "To", "Subject", "HtmlBody", "SourceSheet", "SourceRow", "LogIcon", "QueuedAt", "SentAt"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#4a86e8").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  return sheet;
}

function installEmailQueueTrigger() {
  const existing = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "processEmailQueue");
  if (existing.length > 0) return;
  ScriptApp.newTrigger("processEmailQueue").timeBased().everyMinutes(1).create();
}

/* ============================================================================
   [SECTION 7] NOTIFICATIONS ENGINE & ALERTS ARCHIVE
   ============================================================================ */

function notifyLeadershipOnNewRequest(e) {
  if(!e||!e.range||e.range.getSheet().getName()!==CONFIG.TABS.SERVICE_REQUESTS)return;
  const sheet=e.range.getSheet(),row=e.range.getRow();serviceTicketId_(sheet,row);
  if(!sheet.getRange(row,1).getValue())sheet.getRange(row,1).setValue('New!');
  const values=sheet.getRange(row,1,1,sheet.getLastColumn()).getValues()[0],headers=serviceHeaders_(sheet),urgency=Number(values[headers.findIndex(h=>/How fast do you need/i.test(h))]);
  const leaders=[...serviceEditorEmails_()];if(!leaders.length)return;
  queueEmail_({to:leaders.join(','),subject:(urgency>=4?'URGENT: ':'')+'New NEST service request',htmlBody:'A new service request is ready. <a href="https://gknest.org/service#client-relations">Open Client Relations</a>.',sourceSheet:CONFIG.TABS.SERVICE_REQUESTS,sourceRow:row,logIcon:'📣'});
}

function sendClientNotificationForRow(row) {
  serviceRequireEditor_();const sheet=getServiceSheet_(CONFIG.TABS.SERVICE_REQUESTS),id=serviceTicketId_(sheet,row),ss=getServiceSs_(),log=ss.getSheetByName('ServiceWebLog');
  if(!log||log.getLastRow()<2)throw new Error('Save a client-facing update at gknest.org/service before emailing.');
  const events=log.getRange(2,1,log.getLastRow()-1,10).getValues(),event=events.filter(e=>e[1]===id&&e[2]==='update'&&e[5]).slice(-1)[0];
  if(!event)throw new Error('No client-facing update is stored. Internal notes are never emailed.');
  throw new Error('Use Email latest client update at gknest.org/service to prevent duplicate email attempts.');
}

function sendFinalClosureNotificationAndArchive(e) {
  const sheet=e.range.getSheet();if(sheet.getName()!==CONFIG.TABS.SERVICE_REQUESTS||e.range.getValue()!=='Closed')return;
  const row=e.range.getRow();serviceTicketId_(sheet,row);const target=getServiceSheet_(CONFIG.TABS.CLOSED_TICKETS);
  target.appendRow(serviceMapRow_(sheet,target,row));sheet.deleteRow(row);
}

function moveReopenedTickets() {
  const source=getServiceSheet_(CONFIG.TABS.CLOSED_TICKETS),target=getServiceSheet_(CONFIG.TABS.SERVICE_REQUESTS);if(source.getLastRow()<2)return;
  for(let row=source.getLastRow();row>=2;row--){const status=source.getRange(row,1).getValue();if(status&&status!=='Closed'){serviceTicketId_(source,row);target.appendRow(serviceMapRow_(source,target,row));source.deleteRow(row);}}
  calculateDaysOpened();
}

/* ============================================================================
   [SECTION 8] SERVICE BAROMETER ANALYSIS & COMPILATION
   ============================================================================ */

function updateServiceBarometer() {
  const openSheet = getServiceSheet_(CONFIG.TABS.SERVICE_REQUESTS);
  const closedSheet = getServiceSheet_(CONFIG.TABS.CLOSED_TICKETS);
  const barometerSheet = getServiceSheet_(CONFIG.TABS.SERVICE_BAROMETER);

  const managers = getProjectManagers(openSheet, closedSheet);
  const superMap = getSupervisors(getLeadershipSheet_());

  barometerSheet.getRange("B5:H").clearContent();
  if (!managers.length) return;

  const metrics=getMetrics(closedSheet,openSheet,managers);
  const rows = managers.map((m,i) => [
    `Period ${m.period}`, cleanName(m.name),
    cleanName(superMap.get(m.period)?.crd || ""), cleanName(superMap.get(m.period)?.dm || ""),
    metrics.closedTickets[i], metrics.avgDaysOpened[i], metrics.uniqueStaffHelped[i]
  ]);

  barometerSheet.getRange(5, 2, rows.length, 7).setValues(rows);
  sortServiceBarometer();
}

function sortServiceBarometer() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.SERVICE_BAROMETER);
  if (!sheet || sheet.getLastRow() < 5) return;
  const colName = sheet.getRange("D2").getValue();
  const headers = sheet.getRange("B4:H4").getValues()[0];
  const idx = headers.indexOf(colName);
  if (idx === -1) return;

  const desc = ["Requests Closed to Date", "Average Days Opened", "Staff Members Helped"].includes(colName);
  sheet.getRange(5, 2, sheet.getLastRow() - 4, headers.length).sort([
    { column: idx + 2, ascending: !desc }, { column: 2, ascending: false }
  ]);
}

function getProjectManagers(serviceSheet, closedSheet) {
  const seen = new Set();
  const list = [];
  [serviceSheet, closedSheet].forEach(sh => {
    if (!sh || sh.getLastRow() < 2) return;
    sh.getRange("B2:B" + sh.getLastRow()).getValues().flat().forEach(m => {
      const txt = String(m).trim();
      if (txt && !seen.has(txt)) {
        seen.add(txt);
        const match = txt.match(/Period\s+(\d+)/i);
        list.push({ name: txt, period: match ? parseInt(match[1], 10) : "" });
      }
    });
  });
  return list;
}

function getSupervisors(sheet) {
  const map = new Map();
  if (!sheet || sheet.getLastRow() < 2) return map;
  sheet.getRange("B2:E" + sheet.getLastRow()).getValues().forEach(row => {
    const pMatch = String(row[0]).match(/Period\s+(\d+)/i);
    if (!pMatch) return;
    const p = parseInt(pMatch[1], 10);
    const position = row[2];
    const name = row[3];
    if (!map.has(p)) map.set(p, { dm: "", crd: "" });
    if (position === "Division Manager") map.get(p).dm = `${name} (${position})`;
    if (position === "Director of Client Relations") map.get(p).crd = `${name} (${position})`;
  });
  return map;
}

function getMetrics(closedSheet,serviceSheet,managerData) {
  const groups=new Map(managerData.map(m=>[m.name,{total:0,days:[],clients:new Set()}]));
  [closedSheet,serviceSheet].forEach(sheet=>{if(sheet.getLastRow()<2)return;sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues().forEach(row=>{const g=groups.get(row[1]);if(!g)return;g.total++;if(row[4])g.clients.add(String(row[4]).toLowerCase());const created=new Date(row[3]);if(sheet===serviceSheet&&row[3]&&Number.isFinite(created.getTime()))g.days.push(Math.max(0,Math.floor((Date.now()-created.getTime())/86400000)));});});
  return {closedTickets:managerData.map(m=>groups.get(m.name).total),avgDaysOpened:managerData.map(m=>{const days=groups.get(m.name).days;return days.length?Number((days.reduce((a,b)=>a+b,0)/days.length).toFixed(1)):0;}),uniqueStaffHelped:managerData.map(m=>groups.get(m.name).clients.size)};
}

/* ============================================================================
   [SECTION 9] MODAL ENTRY INTERFACES
   ============================================================================ */

function triggerAddToLog() {
  const html = HtmlService.createHtmlOutputFromFile('LogEntryDialog').setWidth(460).setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, 'Add to Log');
}

function getOpenTicketsForDialog() {
  serviceRequireEditor_();const sheet=getServiceSheet_(CONFIG.TABS.SERVICE_REQUESTS);if(sheet.getLastRow()<2)return [];
  const data=sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getDisplayValues();
  const headers=serviceHeaders_(sheet),col=headers.indexOf('Request ID');if(col<0)throw new Error('Run service integration setup first.');
  return data.filter(row=>row[col]&&!['Completed','Closed'].includes(row[0])).map(row=>({id:row[col],label:row[col].slice(0,8).toUpperCase()+' — '+(row[7]||row[6]||row[4])+' — '+row[3]}));
}

function logManualEntryFromDialog(updateText,id) {
  serviceRequireEditor_();if(typeof updateText!=='string'||!updateText.trim()||updateText.length>2000)throw new Error('Enter a log entry of 1–2000 characters.');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{const item=serviceRowById_(id);prependProjectLogEntry_({sheet:item.sheet,row:item.row,icon:'📝',message:updateText.trim()});}finally{lock.releaseLock();}
}

function triggerSendUpdateToClient() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TABS.SERVICE_REQUESTS);
  const range = sheet.getActiveRange();
  if (!range || range.getRow() < 2) return;
  const row = range.getRow();

  const email = sheet.getRange(row, 5).getValue();
  const name = sheet.getRange(row, 7).getValue();
  if (!email) return;

  const ui = SpreadsheetApp.getUi();
  serviceRequireEditor_();
  if (ui.alert("Send Update?", `Email ${name}?`, ui.ButtonSet.YES_NO) === ui.Button.YES) {
    sendClientNotificationForRow(row);
  }
}

/* ============================================================================
   [SECTION 10] SYSTEM UTILITIES & LOOKUP HELPERS
   ============================================================================ */

function prependProjectLogEntry_({ sheet, row, icon, message }) {
  const entryBody = String(message || "").trim();
  if (!entryBody) return;
  const notesCell = sheet.getRange(row, 3);
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);
  try {
    SpreadsheetApp.flush();
    const currentNotes = String(notesCell.getValue() || notesCell.getDisplayValue() || "");
    const updated = currentNotes.trim() ? `${icon || "📝"} ${getLogTimestamp_()} — ${getActorLabel_()}\n${entryBody}\n\n--------------------\n\n${currentNotes}` : `${icon || "📝"} ${getLogTimestamp_()} — ${getActorLabel_()}\n${entryBody}`;
    notesCell.setValue(updated);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function cleanPmLabelToName_(val) {
  const v = String(val || "").trim();
  const m = v.match(/^(.+?)\s*\(.*\)\s*$/);
  return (m ? m[1] : v).trim();
}

function emailFromMailto_(url) {
  const s = String(url || "").trim();
  return s.toLowerCase().startsWith("mailto:") ? s.slice(7).trim().toLowerCase() : "";
}

function getPmEmailFromCell_(sheet, row, pmCol) {
  const cell = sheet.getRange(row, pmCol);
  const rt = cell.getRichTextValue();
  let email = emailFromMailto_(rt ? rt.getLinkUrl() : "");
  if (!email) email = String(findStudentEmailByName(cleanPmLabelToName_(cell.getDisplayValue())) || "").trim().toLowerCase();
  return email;
}

function updateStudentNameHyperlinks() {
  const serviceSheet = getServiceSheet_(CONFIG.TABS.SERVICE_REQUESTS);
  const databaseSheet = getCombinedStudentListSheet_();
  if (!serviceSheet || !databaseSheet) return;

  const lastRow = serviceSheet.getLastRow();
  const managerRange = serviceSheet.getRange(2, 2, lastRow - 1);
  const valRange = managerRange.getValues();
  const richRange = managerRange.getRichTextValues();

  const studentMap = new Map(databaseSheet.getRange("A2:C" + databaseSheet.getLastRow()).getValues().map(r => [r[0].trim(), r[2].trim()]));
  const originalValidation = managerRange.getDataValidations();
  managerRange.clearDataValidations();

  for (let i = 0; i < valRange.length; i++) {
    const value = valRange[i][0].toString().trim();
    if (!value || (richRange[i][0].getLinkUrl() && richRange[i][0].getLinkUrl().startsWith("mailto:"))) continue;
    const nameMatch = value.match(/^(.+?)\s*\(.*\)$/);
    const studentName = nameMatch ? nameMatch[1].trim() : value;

    if (studentMap.has(studentName)) {
      const richText = SpreadsheetApp.newRichTextValue().setText(value).setLinkUrl(`mailto:${studentMap.get(studentName)}`).build();
      serviceSheet.getRange(i + 2, 2).setRichTextValue(richText);
    }
  }
  managerRange.setDataValidations(originalValidation);
}

function findStudentEmailByName(nameOrEmail) {
  const studentSheet = getEnrolledStudentsSheet_();
  if (!studentSheet) return "";
  const students = studentSheet.getRange("A8:H" + studentSheet.getLastRow()).getValues();
  for (const row of students) {
    if (row[5] === nameOrEmail) return row[0];
    if (row[0] === nameOrEmail) return row[5];
  }
  return "";
}

function lookupActorNameByEmail_(email) {
  const e = String(email || "").trim().toLowerCase();
  if (e === "mpenalver@bethelsd.org") return "Mario Penalver";
  const sheet = getCombinedStudentListSheet_();
  if (!sheet || sheet.getLastRow() < 2) return "";
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  for (const row of values) {
    if (String(row[2]).toLowerCase() === e) return String(row[0]).trim();
  }
  return "";
}

function extractLatestDateFromLog(logText) {
  if (!logText || typeof logText !== "string") return null;
  const matches = logText.match(/\b([01]?\d)[\/-]([0-3]?\d)[\/-]((?:19|20)\d{2})\b/g);
  if (!matches) return null;
  const parsed = matches.map(s => {
    const [m, d, y] = s.split(/[\/-]/).map(Number);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }).filter(Boolean).sort((a, b) => b - a);
  return parsed[0] || null;
}

function capRosterAtFirstGuestBlock_(values, periodIndex) {
  let firstGuest = -1;
  for (let i = 0; i < values.length; i++) {
    if ((values[i][periodIndex] || "").toString().trim() === "Guest") { firstGuest = i; break; }
  }
  if (firstGuest === -1) return values;
  let endGuest = firstGuest;
  for (let i = firstGuest; i < values.length; i++) {
    if ((values[i][periodIndex] || "").toString().trim() === "Guest") { endGuest = i; } else { break; }
  }
  return values.slice(0, endGuest + 1);
}

function periodSortKey_(p) {
  const s = (p || "").toString().trim();
  const m = s.match(/Period\s+(\d+)/i);
  if (m) return Number(m[1]);
  if (s === "CTSO") return 8;
  return s === "Guest" ? 99 : 98;
}

function Tool_InstallConsolidatedTriggers() {
  const ss = SpreadsheetApp.openById(CONFIG.IDS.SERVICE_SS);
  ScriptApp.newTrigger("TRG_onOpen").forSpreadsheet(ss).onOpen().create();
  ScriptApp.newTrigger("TRG_onEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("TRG_onFormSubmit").forSpreadsheet(ss).onFormSubmit().create();
  SpreadsheetApp.getUi().alert("System engines paired successfully.");
}

function Tool_DeleteAllInstalledTriggers_NoUi() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
}

function getLeadershipEditorEmails_() {return serviceEditorEmails_();}

function getAllProjectManagerEmails_() {
  const set = new Set();
  [CONFIG.TABS.SERVICE_REQUESTS, CONFIG.TABS.CLOSED_TICKETS].forEach(t => {
    const sh = getServiceSheet_(t);
    if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().flat().forEach(val => {
      let email = emailFromMailto_(sh.getRange(2,2).getRichTextValue()?.getLinkUrl());
      if (!email) email = findStudentEmailByName(cleanPmLabelToName_(val));
      if (email) set.add(String(email).trim().toLowerCase());
    });
  });
  return set;
}

function ensureSpreadsheetEditor_(email) {reconcileServiceSpreadsheetEditors_();}

function getServiceSs_() { return SpreadsheetApp.openById(CONFIG.IDS.SERVICE_SS); }
function getServiceSheet_(tabName) { return getServiceSs_().getSheetByName(tabName); }
function getLeadershipSheet_() { return SpreadsheetApp.openById(CONFIG.IDS.LEADERSHIP_SS).getSheetByName(CONFIG.TABS.LEADERSHIP_IMPORTED); }
function getEnrolledStudentsSheet_() { return SpreadsheetApp.openById(CONFIG.IDS.ENROLLED_SS).getSheetByName(CONFIG.TABS.ENROLLED_STUDENTS); }
function getCombinedStudentListSheet_() { return SpreadsheetApp.openById(CONFIG.IDS.ENROLLED_SS).getSheetByName(CONFIG.TABS.COMBINED_STUDENT_LIST); }
function getServiceFile_() { return DriveApp.getFileById(CONFIG.IDS.SERVICE_SS); }
function getEnrolledStudentsFile_() { return DriveApp.getFileById(CONFIG.IDS.ENROLLED_SS); }
function isNonEmptyString_(v) { return typeof v === "string" && v.trim() !== ""; }
function cleanName(name) { return (name || "").toString().replace(/\s*\(.*?\)\s*/g, "").trim(); }
function iconForStatus_(s) { const t = String(s).toLowerCase(); return t==="new!"?"🆕":t==="assigned"?"📌":t==="in progress"?"🛠️":t==="completed"?"✅":t==="closed"?"🔒":"🔄"; }
function iconForGeneralEdit_() { return "ℹ️"; }
function iconForEmailSent_() { return "✉️"; }
function getActorEmail_() { return Session.getActiveUser().getEmail() || ""; }
function getActorLabel_() { const e = getActorEmail_(), n = lookupActorNameByEmail_(e); return n ? `${n} <${e}>` : (e || "System User"); }
function getLogTimestamp_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy hh:mm:ss a"); }
function updateClientReviewsSheetHyperlinks() { Logger.log("Hyperlink synchronization completed."); }
