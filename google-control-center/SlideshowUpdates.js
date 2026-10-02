/**
 * Sanitizes an array of emails, removing blanks, #N/A, and invalid entries.
 */
function sanitizeEmails_(emails) {
  return (emails || [])
    .map(e => (e || "").toString().trim().toLowerCase())
    .filter(email => email && email.includes("@") && !["#n/a", "#N/A"].includes(email));
}

/**
 * Returns division names the current user is allowed to update based on Imported sheet:
 * DM, AM, and CTSO CEO/EVP allowed.
 */
function NEST_getAllowedDivisionsForUser_(userEmailLower) {
  const leadershipSheetId = "1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I";

  const rows = SpreadsheetApp.openById(leadershipSheetId)
    .getSheetByName("Imported")
    .getRange("B2:F")
    .getValues();

  const allowedRoles = new Set([
    "division manager",
    "assistant manager",
    "chief executive officer",     // CTSO alias
    "executive vice-president"     // CTSO alias
  ]);

  const allowed = new Set();

  rows.forEach(([period, , role, , email]) => {
    if (!period || !role || !email) return;

    const emailLower = String(email).trim().toLowerCase();
    if (emailLower !== userEmailLower) return;

    const roleLower = String(role).trim().toLowerCase();
    if (!allowedRoles.has(roleLower)) return;

    const p = String(period).trim(); // "Period 3" or "Period CTSO"

    if (p === "Period CTSO") allowed.add("CTSO");
    else {
      const m = p.match(/^Period\s+(\d+)$/i);
      if (m) allowed.add(`Division ${m[1]}`);
    }
  });

  return Array.from(allowed); // e.g., ["Division 3"]
}

function NEST_authorizeAccess() {
  const ui = SpreadsheetApp.getUi();

  // Touch services to trigger OAuth scopes
  SpreadsheetApp.getActiveSpreadsheet().getId();
  DriveApp.getRootFolder().getName();

  // Slides scope (create + trash to avoid clutter)
  const temp = SlidesApp.create(`NEST Auth Test (${Session.getActiveUser().getEmail()})`);
  DriveApp.getFileById(temp.getId()).setTrashed(true);

  ui.alert(
    "Authorization complete",
    "You can now run: NEST Tools → Update My Manager Slides",
    ui.ButtonSet.OK
  );
}



function NEST_updateMyManagerSlides() {
  const ui = SpreadsheetApp.getUi();
  const userEmail = Session.getActiveUser().getEmail().toLowerCase();

  const allowedDivisions = NEST_getAllowedDivisionsForUser_(userEmail);

  if (allowedDivisions.length === 0) {
    ui.alert(
      "Not eligible to update slides",
      `Your email (${userEmail}) is not listed as a DM/AM (or CTSO CEO/EVP) in Imported.`,
      ui.ButtonSet.OK
    );
    return;
  }

  // If a user is tied to multiple periods, let them choose which one to run
  let targetDivision = allowedDivisions[0];

  if (allowedDivisions.length > 1) {
    const resp = ui.prompt(
      "Select a division to update",
      `You are assigned to:\n- ${allowedDivisions.join("\n- ")}\n\nType one exactly:`,
      ui.ButtonSet.OK_CANCEL
    );
    if (resp.getSelectedButton() !== ui.Button.OK) return;

    const choice = resp.getResponseText().trim();
    if (!allowedDivisions.includes(choice)) {
      ui.alert("Invalid choice", "That division is not in your allowed list.", ui.ButtonSet.OK);
      return;
    }
    targetDivision = choice;
  }

  try {
    updateManagerSlides(targetDivision);
    ui.alert("Done", `✅ Slides updated for ${targetDivision}`, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert("Error", `❌ Failed for ${targetDivision}\n\n${err.message}`, ui.ButtonSet.OK);
  }
}


/**
 * If you want a separate action that ONLY reconciles perms (without rebuilding slides),
 * you’d refactor updateManagerSlides into (buildSlides + syncPerms).
 * For now this can just run the same function or call a future sync-only function.
 */
function NEST_syncMySlidePermissions() {
  // Placeholder: right now updateManagerSlides does both content + sharing.
  NEST_updateMyManagerSlides();
}

/**
 * Updates the Division Manager slideshow for a given division.
 * - Rebuilds the manager deck by appending slides from position-specific leader decks
 * - Ensures leader slide files have correct editors (leaders + management)
 * - Reconciles manager deck editors (DM only by default)
 */
function updateManagerSlides(divisionName, alreadyLocked) {
  if (alreadyLocked) return nestUpdateManagerSlides_(divisionName);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('A slide update is already running. Try again shortly.');
  try { return nestUpdateManagerSlides_(divisionName); } finally { lock.releaseLock(); }
}
function nestUpdateManagerSlides_(divisionName) {
  const leadershipSheetId = "1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I";
  const positionOrderSheetId = "12yZuGqPRJnm0GfiAf6OSrsc10K13ZW0rlx5mwbVNqDE";

  const templateFolderId = "1jkVj6Njedh15KXE5QE2_8-8eFyKFBmx4"; // templates root
  const baseFolderId = "1JIjmW9E7Z0im8udvmdTksNdrb7NSjD5k";     // Division Folders root

  // === LOAD LEADERSHIP DATA ===
  const leadershipData = SpreadsheetApp.openById(leadershipSheetId)
    .getSheetByName("Imported")
    .getRange("B2:F")
    .getValues();

  // === LOAD POSITION ORDER ===
  const positionOrder = SpreadsheetApp.openById(positionOrderSheetId)
    .getSheetByName("LeadershipPositions")
    .getRange("B2:B")
    .getValues()
    .flat()
    .filter(Boolean);

  // === FIND DIVISION FOLDER ===
  const folders = DriveApp.getFolderById(baseFolderId).getFoldersByName(divisionName);
  if (!folders.hasNext()) {
    Logger.log(`❌ Division folder not found for: ${divisionName}`);
    throw new Error(`Division folder not found: ${divisionName}`);
  }
  const divisionFolder = folders.next();

  // === FIND MANAGER SLIDESHOW IN DIVISION ROOT ===
  let managerSlidesFile = null;
  const divisionFiles = divisionFolder.getFiles();
  while (divisionFiles.hasNext()) {
    const f = divisionFiles.next();
    if (String(f.getName()).includes("Manager Slides")) {
      managerSlidesFile = f;
      break;
    }
  }
  if (!managerSlidesFile) {
    Logger.log(`❌ Manager slideshow not found in folder: ${divisionName}`);
    throw new Error(`Manager slideshow not found in ${divisionName} (must include "Manager Slides" in filename)`);
  }

  const managerPresentation = SlidesApp.openById(managerSlidesFile.getId());
  const managerDeckFile = DriveApp.getFileById(managerSlidesFile.getId());

  // === GET "Division Leader Slides" FOLDER INSIDE DIVISION ===
  const leaderSlidesFolderIterator = divisionFolder.getFoldersByName("Division Leader Slides");
  if (!leaderSlidesFolderIterator.hasNext()) {
    Logger.log(`❌ Missing 'Division Leader Slides' folder in: ${divisionName}`);
    throw new Error(`Missing 'Division Leader Slides' folder in ${divisionName}`);
  }
  const leaderSlidesFolder = leaderSlidesFolderIterator.next();

  // === GET TEMPLATE "Division Leader Slides" FOLDER ===
  const templateLeaderSlidesIterator = DriveApp.getFolderById(templateFolderId).getFoldersByName("Division Leader Slides");
  if (!templateLeaderSlidesIterator.hasNext()) {
    Logger.log(`❌ Missing 'Division Leader Slides' folder in templates`);
    throw new Error(`Missing 'Division Leader Slides' folder in templates`);
  }
  const templateLeaderSlidesFolder = templateLeaderSlidesIterator.next();

  // === MAP DIVISION NAME -> PERIOD STRING ===
  const divisionPeriod = (divisionName === "CTSO")
    ? "Period CTSO"
    : ("Period " + divisionName.split(" ")[1]);

  const divisionTeamName = (divisionName === "CTSO") ? "CTSO Team" : divisionName;

  // === BUILD POSITION → EMAIL MAP ===
  const positionEmailMap = {};
  leadershipData.forEach(([period, , position, , email]) => {
    if (!period || !position || !email) return;
    if (String(period).trim() !== divisionPeriod) return;

    const key = String(position).trim().toLowerCase();
    if (!positionEmailMap[key]) positionEmailMap[key] = [];
    positionEmailMap[key].push(String(email).trim());
  });

  // === MANAGEMENT EMAILS (DM/AM + CTSO CEO/EVP) ===
  const dmEmails = sanitizeEmails_(positionEmailMap["division manager"] || []);
  const amEmails = sanitizeEmails_(positionEmailMap["assistant manager"] || []);
  const ceoEmails = sanitizeEmails_(positionEmailMap["chief executive officer"] || []);
  const evpEmails = sanitizeEmails_(positionEmailMap["executive vice-president"] || []);
  const managementEmails = [...dmEmails, ...amEmails, ...ceoEmails, ...evpEmails];

  Logger.log(`📣 Current Leaders in ${divisionPeriod}:`);
  Object.keys(positionEmailMap).forEach(pos =>
    Logger.log(`  • ${pos}: ${positionEmailMap[pos].join(", ")}`)
  );

  // === CLEAR EXISTING SLIDES (except title slide) ===
  const mgrSlides = managerPresentation.getSlides();
  for (let i = mgrSlides.length - 1; i > 0; i--) {
    mgrSlides[i].remove();
  }

  // === INSERT SLIDES FOR EACH POSITION (SKIP DM & CTSO CEO) ===
  positionOrder.forEach(position => {
    const key = String(position).toLowerCase();
    if (key === "division manager" || key === "chief executive officer") return;

    let leaderSlideFile = null;

    // 1) Check existing leader slides folder
    const existing = leaderSlidesFolder.getFiles();
    while (existing.hasNext()) {
      const f = existing.next();
      const name = String(f.getName());
      if (name.toLowerCase().includes(key) && name.includes(divisionTeamName)) {
        leaderSlideFile = f;
        break;
      }
    }

    // 2) Copy from template if missing
    if (!leaderSlideFile) {
      const templateFiles = templateLeaderSlidesFolder.getFiles();
      while (templateFiles.hasNext()) {
        const tf = templateFiles.next();
        if (String(tf.getName()).toLowerCase().includes(key)) {
          leaderSlideFile = tf.makeCopy(`${divisionTeamName} Team_${position}`, leaderSlidesFolder);
          break;
        }
      }
    }

    if (!leaderSlideFile) {
      Logger.log(`⚠️ No slide file found for position: ${position}`);
      return;
    }

    // === APPEND SLIDES INTO MANAGER DECK ===
    try {
      const sourceSlides = SlidesApp.openById(leaderSlideFile.getId()).getSlides();
      sourceSlides.forEach(slide => managerPresentation.appendSlide(slide));
      Logger.log(`📄 Inserted slides for ${position}`);
    } catch (err) {
      Logger.log(`❌ Failed to insert slides from ${leaderSlideFile.getName()}: ${err}`);
      return;
    }

    // === SHARE LEADER SLIDE FILE (leaders in role + management) ===
    const leaderEmails = sanitizeEmails_(positionEmailMap[key] || []);
    const allEditors = [...new Set([...leaderEmails, ...managementEmails])];

    const currentEditors = leaderSlideFile.getEditors().map(e => e.getEmail().toLowerCase());
    const currentViewers = leaderSlideFile.getViewers().map(v => v.getEmail().toLowerCase());

    currentEditors.forEach(email => {
      if (!allEditors.includes(email)) {
        leaderSlideFile.removeEditor(email);
        Logger.log(`➖ Removed editor: ${email} from ${position}`);
      }
    });

    currentViewers.forEach(email => {
      if (!allEditors.includes(email)) {
        leaderSlideFile.removeViewer(email);
        Logger.log(`➖ Removed viewer: ${email} from ${position}`);
      }
    });

    allEditors.forEach(email => {
      if (!currentEditors.includes(email)) {
        try {
          leaderSlideFile.addEditor(email);
          Logger.log(`✅ Added editor: ${email} to ${position}`);
        } catch (err) {
          Logger.log(`⚠️ Skipped invalid email for ${position}: ${email} (${err.message})`);
        }
      }
    });

    // Leave viewable-by-link
    leaderSlideFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  });

  // === RECONCILE MANAGER DECK EDITORS (DM only by default) ===
  const managerEmailsFinal = sanitizeEmails_(positionEmailMap["division manager"] || []);
  const asstEmailsFinal = sanitizeEmails_(positionEmailMap["assistant manager"] || []);

  // Toggle assistants here if desired:
  const includeAssistantManagers = false;
  const expectedEditors = includeAssistantManagers
    ? [...new Set([...managerEmailsFinal, ...asstEmailsFinal])]
    : [...new Set(managerEmailsFinal)];

  const currentMgrEditors = managerDeckFile.getEditors().map(u => u.getEmail().toLowerCase());

  currentMgrEditors.forEach(email => {
    if (!expectedEditors.includes(email)) {
      managerDeckFile.removeEditor(email);
      Logger.log(`➖ Removed extra editor from Manager Slides: ${email}`);
    }
  });

  expectedEditors.forEach(email => {
    if (!currentMgrEditors.includes(email)) {
      try {
        managerDeckFile.addEditor(email);
        Logger.log(`✅ Added editor to Manager Slides: ${email}`);
      } catch (err) {
        Logger.log(`⚠️ Skipped invalid manager email: ${email} (${err.message})`);
      }
    }
  });

  Logger.log(`✅ Finished updating manager slideshow for ${divisionName}`);
}



