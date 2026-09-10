/**
 * sync-to-supabase.gs  — v2 (fix lỗi duplicate trong batch)
 * Google Apps Script: Đồng bộ dữ liệu từ Google Sheets → Supabase
 */

// ============================================================
// CẤU HÌNH — đã điền sẵn, KHÔNG cần sửa lại
// ============================================================
const CONFIG = {
  SUPABASE_URL: 'https://cgzuvuorvvflkpwqxfku.supabase.co',
  SUPABASE_SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnenV2dW9ydnZmbGtwd3F4Zmt1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODM1NjIxOSwiZXhwIjoyMTAzOTMyMjE5fQ.dfRdS3VqwQVpTtWpTz_pGK7e5yZjO6P-iob6kAChlyc',
  TABLE: 'candidates',
  SHEET_HOA:  '1. C.Hoa',
  SHEET_NGOC: '2. C.Ngoc',
  DATA_START_ROW: 2,
  COL_NGAY:      1,
  COL_THANG:     2,
  COL_NAM:       3,
  COL_CHECK:     4,
  COL_TEN:       5,
  COL_SDT:       6,
  COL_PHAN_LOAI: 7,
  COL_TRANG_THAI:8,
  COL_GHI_CHU:   9,
};

// ============================================================
// HÀM CHÍNH
// ============================================================
function syncAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('=== BẮT ĐẦU ĐỒNG BỘ ===');
  const results = { success: 0, skipped: 0, error: 0 };
  syncSheet(ss, CONFIG.SHEET_HOA,  'C.Hoa',  results);
  syncSheet(ss, CONFIG.SHEET_NGOC, 'C.Ngoc', results);
  Logger.log(`=== HOÀN THÀNH: ${results.success} thành công, ${results.skipped} bỏ qua, ${results.error} lỗi ===`);
}

// ============================================================
// Đồng bộ 1 sheet
// ============================================================
function syncSheet(ss, sheetName, recruiter, results) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) { Logger.log(`[WARN] Không tìm thấy sheet: ${sheetName}`); return; }

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) { Logger.log(`[INFO] Sheet ${sheetName} trống`); return; }

  const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
  const data = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, 9).getValues();

  const rows = [];
  data.forEach((row, idx) => {
    const ten  = String(row[CONFIG.COL_TEN - 1]  || '').trim();
    const sdt  = String(row[CONFIG.COL_SDT - 1]  || '').trim();
    const ngay = row[CONFIG.COL_NGAY - 1];
    if (!ten && !sdt) return;

    let ngayStr = '';
    if (ngay instanceof Date && !isNaN(ngay)) {
      ngayStr = Utilities.formatDate(ngay, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
    } else if (typeof ngay === 'string' && ngay.trim()) {
      ngayStr = parseDateVN(ngay.trim());
    }
    if (!ngayStr) return;

    rows.push({
      ngay_nhap:   ngayStr,
      thang:       Number(row[CONFIG.COL_THANG - 1]) || new Date(ngay).getMonth() + 1,
      nam:         Number(row[CONFIG.COL_NAM - 1])   || new Date(ngay).getFullYear(),
      check_sdt:   String(row[CONFIG.COL_CHECK - 1]     || '').trim(),
      ten_uv:      ten,
      sdt:         sdt,
      phan_loai:   String(row[CONFIG.COL_PHAN_LOAI - 1]  || '').trim(),
      trang_thai:  String(row[CONFIG.COL_TRANG_THAI - 1] || '').trim(),
      ghi_chu:     String(row[CONFIG.COL_GHI_CHU - 1]    || '').trim(),
      recruiter:   recruiter,
      row_index:   CONFIG.DATA_START_ROW + idx,
      synced_at:   new Date().toISOString(),
    });
  });

  Logger.log(`[${sheetName}] Tìm thấy ${rows.length} hàng hợp lệ`);

  // ── FIX v2: Dedup trong cùng sheet trước khi gửi batch ──
  const seen = new Map();
  rows.forEach(row => {
    const key = `${row.ngay_nhap}|${row.sdt}|${row.ten_uv}|${row.recruiter}`;
    seen.set(key, row); // giữ hàng cuối nếu trùng key
  });
  const dedupedRows = Array.from(seen.values());
  Logger.log(`[${sheetName}] Sau dedup: ${dedupedRows.length} hàng (bỏ ${rows.length - dedupedRows.length} trùng)`);

  // Gửi theo batch 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < dedupedRows.length; i += BATCH_SIZE) {
    const batch = dedupedRows.slice(i, i + BATCH_SIZE);
    try {
      upsertToSupabase(batch);
      results.success += batch.length;
      Logger.log(`[${sheetName}] Upserted batch ${Math.floor(i/BATCH_SIZE)+1}: ${batch.length} rows`);
    } catch (e) {
      results.error += batch.length;
      Logger.log(`[${sheetName}] LỖI batch: ${e.message}`);
    }
  }
}

// ============================================================
// Gửi lên Supabase (upsert)
// ============================================================
function upsertToSupabase(rows) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE}`;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        CONFIG.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_SERVICE_KEY}`,
      'Prefer':        'resolution=merge-duplicates,return=minimal',
    },
    payload: JSON.stringify(rows),
    muteHttpExceptions: true,
  };
  const res = UrlFetchApp.fetch(
    url + '?on_conflict=ngay_nhap,sdt,ten_uv,recruiter',
    options
  );
  const code = res.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error(`HTTP ${code}: ${res.getContentText().substring(0, 200)}`);
  }
}

// ============================================================
// Parse ngày VN: dd/MM/yyyy
// ============================================================
function parseDateVN(str) {
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return '';
}

// ============================================================
// Đặt lịch tự động 7:00 sáng mỗi ngày
// ============================================================
function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncAll') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncAll').timeBased().everyDays(1).atHour(7).create();
  Logger.log('Đã đặt lịch: syncAll() chạy mỗi ngày lúc 7:00 sáng');
}
