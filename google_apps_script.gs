// ============================================================
//  PRODUCTION DASHBOARD — Google Apps Script
//  ✅ Data Source: "Master Record" ONLY
//  ❌ Daily Record fallback REMOVED permanently
// ============================================================

function doGet(e) {
  const params = e.parameter || {};
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const result = getDashboardData(params);
    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ error: err.message }));
  }

  return output;
}

// ─────────────────────────────────────────────────────────────
//  Main function — called by doGet
//  ALWAYS reads from "Master Record" sheet
// ─────────────────────────────────────────────────────────────
function getDashboardData(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone(); // ✅ Use Spreadsheet's own timezone

  // STRICT: Only "Master Record" — No fallback to any other sheet
  const sheetName = 'Master Record';
  const sheet = ss.getSheetByName(sheetName);

  // If "Master Record" sheet doesn't exist, return clear error
  if (!sheet) {
    return {
      rawData: [],
      error: '❌ "Master Record" sheet not found! Please check your Google Sheet.',
      debug: { sourceUsed: 'NONE', sheetRequested: sheetName }
    };
  }

  // --- Read all data from Master Record sheet ---
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return {
      rawData: [],
      debug: { sourceUsed: sheetName, totalRows: 0 },
      lastUpdated: new Date().toISOString()
    };
  }

  const headers = data[0].map(h => String(h).trim());
  const rows = data.slice(1);

  // --- Convert rows to objects ---
  const rawData = rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      // ✅ Use Spreadsheet's timezone to avoid date shift (e.g., 29 Apr becoming 28 Apr)
      if (val instanceof Date) {
        obj[h] = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
      } else {
        obj[h] = (val !== '' && val !== null && val !== undefined) ? val : '';
      }
    });
    return obj;
  }).filter(row => {
    // Remove completely empty rows
    return Object.values(row).some(v => v !== '' && v !== null && v !== undefined);
  });

  // --- Return response ---
  return {
    rawData: rawData,
    debug: {
      sourceUsed: sheetName,       // Always "Master Record"
      totalRows: rawData.length,
      timezone: tz,
      lastUpdated: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss')
    },
    lastUpdated: new Date().getTime()
  };
}
