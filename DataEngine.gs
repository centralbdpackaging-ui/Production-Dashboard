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
    const ss = SpreadsheetApp.openById("1x3HKq_aAgtmrDCkCf_O2nKDGQ90fPdzDc5S47s2P_Jc");
    // Default values if params are missing
    const date =
      (params && params.date) || new Date().toISOString().split("T")[0];
    const shift = (params && params.shift) || "Day";

    const today = new Date().toISOString().split("T")[0];
    const isToday = (date === today);
    const sourceSheet = isToday ? "Daily Record" : "Master Record";
    
    const sourceData = parseSheetData(ss, sourceSheet, date, shift);
    
    // Categorize data from the selected source sheet (more flexible matching)
    const getCat = (search) => {
      return sourceData.filter(m => {
        if (!m.id) return false;
        const idStr = m.id.toString().toUpperCase();
        return idStr.includes(search.toUpperCase());
      });
    };

    const data = {
      machines: {
        "Side Seal": getCat("SIDE SEAL"),
        Bottom: getCat("BOTTOM"),
        "Zip Lock": getCat("ZIP LOCK"),
      },
      debug: {
        availableSheets: ss.getSheets().map(s => s.getName()),
        sourceUsed: sourceSheet,
        recordCount: sourceData.length,
        sampleRecord: sourceData.length > 0 ? sourceData[0] : "No records found",
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
