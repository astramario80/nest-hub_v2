// FieldTripMaster.gs - Complete workflow

function createCompleteFieldTripSetup() {
  Logger.log("🚀 Starting COMPLETE field trip setup");
  
  // 1. Manage folders (create, archive, color-code)
  manageFieldTripFolders();

  // ✅ Best practice: organize right after managing so Parent/Upcoming/Closed is correct immediately
  organizeFieldTripFolders();
  
  // 2. Copy templates into new folders
  copyTemplatesToEventFolders();
  
  // 3. Create/update calendar events
  createFieldTripCalendarEvents();
  
  // 4. Update FolderTracker database with spreadsheet info
  updateFolderTrackerDatabase();
  
  Logger.log("✅ Complete field trip setup finished");
}





function onFormSubmit(e) {
  // Trigger when new field trip form is submitted
  createCompleteFieldTripSetup();
}
