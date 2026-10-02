// Replacement for the existing daily importer: include every partner row.
function importLeadershipApplications() {
  const mainSheetId = "1RRyYSYV2jDMPebFH8WuGyI9mLH904IXBwewXdMbPn-I";
  const targetSheet = SpreadsheetApp.openById(mainSheetId).getSheetByName("Imported");

  const sheetDetails = [
    {name: "Period CTSOApplications", id: "1Fz65n04x1wCLcuVjYpKEcEexlyZvsoMKhOfJZkhovfg"},
    {name: "Period 5Applications", id: "1BAzRoHsx3lbAG-PH48_8fQHRW6WAmEJL3Fi0eIxBcGY"},
    {name: "Period 7Applications", id: "12IHgmIYtgh840IR9A52G5nON3Q0foQKNSGU-2LCx4ks"},
    {name: "Period 4Applications", id: "1DBkq8zvNVi48aegk0AkMObEDH0krVmRnmigVPUHyuCI"},
    {name: "Period 3Applications", id: "1-GGowYJrqxrE9fzS7Gqco1CMRqflPd45HK4NvXj4WMc"},
    {name: "Period 1Applications", id: "1Ut9K28LgaYbNHJRw6cn1l48wD_aaO484ZMjJi8zcIxo"},
    {name: "Period 2Applications", id: "13RUztc3CXnd9bzM9IcYXEIqhO-045KbStHeB7GKA_W4"}
  ];

  let importedData = [];
  sheetDetails.forEach(sheetDetail => {
    const ss = SpreadsheetApp.openById(sheetDetail.id);
    const appSheet = ss.getSheetByName("Division Team");
    const appUrl = ss.getUrl();
    const data = appSheet.getRange(3,6,Math.max(1,appSheet.getLastRow()-2),3).getValues();

    data.forEach(row => {
      if (row[0] || row[1] || row[2]) {
        importedData.push([
          sheetDetail.name.replace("Applications", ""),
          appUrl,
          row[0], // Position
          row[1], // Name
          row[2]  // Email address
        ]);
      }
    });
  });

  importedData.sort((a, b) => a[0].localeCompare(b[0]));

  if(importedData.length+1>targetSheet.getMaxRows())targetSheet.insertRowsAfter(targetSheet.getMaxRows(),importedData.length+1-targetSheet.getMaxRows());

  // Clear the entire range Imported!B2:F
  targetSheet.getRange("B2:F" + targetSheet.getMaxRows()).clearContent();

  if (importedData.length > 0) {
    targetSheet.getRange(2, 2, importedData.length, 5).setValues(importedData);
  }

  // Batch apply rich-text hyperlinks for names → emails
  const richText = importedData.map(item =>
    [SpreadsheetApp.newRichTextValue()
      .setText(item[3])
      .setLinkUrl("mailto:" + item[4])
      .build()]
  );
  if (richText.length > 0) {
    targetSheet.getRange(2, 5, richText.length, 1).setRichTextValues(richText);
  }

  SpreadsheetApp.flush();
}
