/**
 * UNIVERSAL DATA ENGINE - Minimal Version
 * This script only provides raw data from the Google Sheet.
 * All logic, filtering, and calculation happens in the dashboard (app.js).
 */

const SPREADSHEET_ID = "1x3HKq_aAgtmrDCkCf_O2nKDGQ90fPdzDc5S47s2P_Jc";

function doGet(e) {
  const date = e.parameter.date || new Date().toISOString().split("T")[0];
  const shift = e.parameter.shift || "Day";
  return ContentService.createTextOutput(
    JSON.stringify(getDashboardData({ date, shift })),
  ).setMimeType(ContentService.MimeType.JSON);
}

function getDashboardData(params) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const date = params.date;
    
    // Determine source sheet
    const todayStr = new Date().toISOString().split("T")[0];
    const isToday = (date === todayStr);
    const sourceSheet = isToday ? "Daily Record" : "Master Record";
    
    const rawData = fetchRawSheetData(ss, sourceSheet);

    return {
      rawData: rawData,
      debug: {
        sourceUsed: sourceSheet,
        recordCount: rawData.length,
        requestedDate: date,
        requestedShift: params.shift,
        availableSheets: ss.getSheets().map(s => s.getName())
      },
      lastUpdated: new Date().getTime()
    };
  } catch (err) {
    return { error: err.toString() };
  }
}

function fetchRawSheetData(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  
  // Fallback: fuzzy match sheet name
  if (!sheet) {
    const search = sheetName.toLowerCase().replace(/\s+/g, "");
    sheet = ss.getSheets().find(s => s.getName().toLowerCase().replace(/\s+/g, "") === search);
  }
  
  if (!sheet) return [];
  
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  
  const headers = values[0].map(h => h.toString().trim());
  const rows = values.slice(1);
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}
