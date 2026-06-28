// Month sheet names recognised by the parser
const MONTHLY_SHEETS = new Set(['S','O','N','D','Y','F','M','A','May','Iyun']);

// 1-based row number for each work item in a monthly sheet
const ITEM_ROWS = {
  teaching: 8, consultations: 11, graduation_thesis: 12,
  assessment: 13, open_lessons: 14, lesson_prep: 15,
  olympiad: 16, independent_work: 17, professional_dev: 18,
  career_guidance: 21, mutual_analysis: 22, circles: 23,
  public_duties: 24, beautification: 25, council_meetings: 26,
  cultural_work: 29, moral_activities: 30,
};

/** Read a numeric cell value (1-based row/col). Returns 0 if absent or non-numeric. */
function cellNum(ws, row, col) {
  const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  const cell = ws[addr];
  if (!cell) return 0;
  return typeof cell.v === 'number' ? Math.round(cell.v) : (Number(cell.v) || 0);
}

/** Sum cols colStart..colEnd (1-based) for a given 1-based row. */
function sumCols(ws, row, colStart, colEnd) {
  let total = 0;
  for (let c = colStart; c <= colEnd; c++) total += cellNum(ws, row, c);
  return total;
}

/**
 * Parse an already-loaded XLSX workbook object.
 * Returns { teacherName, academicYear, monthlyData }
 */
function parseWorkbook(wb) {
  const firstWs = wb.Sheets[wb.SheetNames[0]];

  // Teacher name: cell B6 in first sheet
  const teacherName = firstWs?.['B6']?.v?.toString().trim() || '';

  // Academic year: try G5 first (most reliable location in generated files),
  // then fall back to scanning first 10 rows, 7 cols for "20XX-20XX"
  let academicYear = '';
  const g5 = firstWs?.['G5']?.v?.toString() || '';
  const g5match = g5.match(/\b(20\d\d-20\d\d)\b/);
  if (g5match) {
    academicYear = g5match[1];
  } else {
    outer: for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 7; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const val = firstWs?.[addr]?.v?.toString() || '';
        const m = val.match(/\b(20\d\d-20\d\d)\b/);
        if (m) { academicYear = m[1]; break outer; }
      }
    }
  }

  // Parse each recognised monthly sheet
  const monthlyData = {};
  for (const name of wb.SheetNames) {
    if (!MONTHLY_SHEETS.has(name)) continue;
    const ws = wb.Sheets[name];
    const items = {};
    for (const [key, row] of Object.entries(ITEM_ROWS)) {
      items[key] = {
        plan: sumCols(ws, row, 3, 6),   // cols C-F
        real: sumCols(ws, row, 8, 11),  // cols H-K
      };
    }
    monthlyData[name] = items;
  }

  return { teacherName, academicYear, monthlyData };
}

/**
 * Read a File object and return parsed data.
 * @param {File} file
 * @returns {Promise<{teacherName: string, academicYear: string, monthlyData: Object}>}
 */
function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        resolve(parseWorkbook(wb));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsArrayBuffer(file);
  });
}
