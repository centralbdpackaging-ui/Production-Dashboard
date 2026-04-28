function doGet(e) {
  try {
    const data = getDashboardData(e.parameter);
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
      ContentService.MimeType.JSON,
    );
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: err.toString() }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Main data fetching function for the dashboard.
 * Called from client-side via google.script.run
 */
function getDashboardData(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // Default values if params are missing
    const date =
      (params && params.date) || new Date().toISOString().split("T")[0];
    const shift = (params && params.shift) || "Day";

    const dailyData = parseSheetData(ss, "Daily Record", date, shift);
    
    // Categorize data from Daily Record exclusively
    const getCat = (prefix) => {
      return dailyData.filter(m => 
        m.id && m.id.toString().toUpperCase().startsWith(prefix)
      );
    };

    const data = {
      machines: {
        "Side Seal": getCat("SS"),
        Bottom: getCat("BT"),
        "Zip Lock": getCat("ZL"),
      },
      debug: {
        availableSheets: ss.getSheets().map(s => s.getName()),
        dailyRecordCount: dailyData.length,
        requestedDate: date,
        requestedShift: shift
      },
      lastUpdated: new Date().getTime(),
    };
    return data;
  } catch (err) {
    return { error: err.toString() };
  }
}

/**
 * Robust helper to parse sheet data with flexible header mapping
 */
function parseSheetData(ss, sheetName, date, shift) {
  // Try exact match first
  let sheet = ss.getSheetByName(sheetName);
  
  // Fallback: search for sheet name ignoring case and spaces
  if (!sheet) {
    const searchName = sheetName.toLowerCase().replace(/\s+/g, "");
    sheet = ss.getSheets().find(s => {
      const n = s.getName().toLowerCase().replace(/\s+/g, "");
      return n === searchName || n.includes(searchName);
    });
  }

  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  // Normalize headers to lowercase and remove spaces
  const headers = values[0].map((h) =>
    h.toString().toLowerCase().trim().replace(/\s+/g, ""),
  );
  const rows = values.slice(1);

  return rows.map((row) => {
    let obj = {};
    headers.forEach((h, i) => {
      // Smart mapping to standard dashboard keys
      if (h.includes("machine") || h.includes("no")) obj.id = row[i];
      else if (h.includes("prod")) obj.prod = row[i];
      else if (h.includes("target")) obj.target = row[i];
      else if (h.includes("status")) obj.status = row[i];
      else obj[h] = row[i];
    });
    return obj;
  });
}
