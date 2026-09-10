/**
 * sync-to-supabase.gs
 * Google Apps Script: Đồng bộ dữ liệu từ Google Sheets → Supabase
 *
 * CÁCH CÀI ĐẶT:
 * 1. Mở Google Sheets → Extensions → Apps Script
 * 2. Paste toàn bộ code này vào editor
 * 3. Điền SUPABASE_URL và SUPABASE_SERVICE_KEY bên dưới
 * 4. Chạy setupDailyTrigger() một lần để đặt lịch tự động
 * 5. Chạy syncAll() để test ngay lập tức
 */

// ============================================================
// CẤU HÌNH — điền vào đây
// ============================================================
const CONFIG = {
  // URL Supabase project của bạn (không có dấu / cuối)
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',

  // Service Role Key (KHÔNG phải anon key) — lấy từ Supabase → Settings → API
  SUPABASE_SERVICE_KEY: 'YOUR_SERVICE_ROLE_KEY',

  // Tên bảng trong Supabase
  TABLE: 'candidates',

  // Tên các sheet nguồn
  SHEET_HOA:  '1. C.Hoa',
  SHEET_NGOC: '2. C.Ngoc',

  // Hàng đầu tiên có DATA (hàng 1 = header)
  DATA_START_ROW: 2,

  // Cột trong sheet (A=1, B=2, ...)
  COL_NGAY:     1,  // A: Ngày nhập
  COL_THANG:    2,  // B: Tháng
  COL_NAM:      3,  // C: Năm
  COL_CHECK:    4,  // D: Check SĐT
  COL_TEN:      5,  // E: Tên UV
  COL_SDT:      6,  // F: SĐT
  COL_PHAN_LOAI: 7, // G: Phân Loại
  COL_TRANG_THAI: 8,// H: Trạng Thái
  COL_GHI_CHU:  9,  // I: Ghi Chú
};

// ============================================================
// HÀM CHÍNH: Đồng bộ toàn bộ dữ liệu
// ============================================================
function syncAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('=== BẮT ĐẦU ĐỒNG BỘ ===');

  const results = { success: 0, skipped: 0, error: 0 };

  // Đồng bộ từng sheet recruiter
  syncSheet(ss, CONFIG.SHEET_HOA,  'C.Hoa',  results);
  syncSheet(ss, CONFIG.SHEET_NGOC, 'C.Ngoc', results);

  Logger.log(`=== HOÀN THÀNH: ${results.success} thành công, ${results.skipped} bỏ qua, ${results.error} lỗi ===`);

  // Cập nhật cell log (tùy chọn — điền tên sheet + cell nếu muốn)
  // ss.getSheetByName('BC Log')?.getRange('B1')?.setValue(new Date());
}

// ============================================================
// Đồng bộ 1 sheet
// ============================================================
function syncSheet(ss, sheetName, recruiter, results) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log(`[WARN] Không tìm thấy sheet: ${sheetName}`);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) {
    Logger.log(`[INFO] Sheet ${sheetName} trống`);
    return;
  }

  // Đọc toàn bộ dữ liệu 1 lần (nhanh hơn đọc từng ô)
  const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
  const data = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, 9).getValues();

  // Tạo batch upsert (tối đa 500 rows/request)
  const BATCH_SIZE = 500;
  const rows = [];

  data.forEach((row, idx) => {
    const ten  = String(row[CONFIG.COL_TEN - 1]  || '').trim();
    const sdt  = String(row[CONFIG.COL_SDT - 1]  || '').trim();
    const ngay = row[CONFIG.COL_NGAY - 1];

    // Bỏ qua hàng trống
    if (!ten && !sdt) return;

    // Parse ngày nhập
    let ngayStr = '';
    if (ngay instanceof Date && !isNaN(ngay)) {
      ngayStr = Utilities.formatDate(ngay, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
    } else if (typeof ngay === 'string' && ngay.trim()) {
      ngayStr = parseDateVN(ngay.trim());
    }

    if (!ngayStr) return; // bỏ qua nếu không parse được ngày

    rows.push({
      ngay_nhap:   ngayStr,
      thang:       Number(row[CONFIG.COL_THANG - 1]) || new Date(ngay).getMonth() + 1,
      nam:         Number(row[CONFIG.COL_NAM - 1])   || new Date(ngay).getFullYear(),
      check_sdt:   String(row[CONFIG.COL_CHECK - 1]    || '').trim(),
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

  // Gửi theo batch
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
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
// Gửi dữ liệu lên Supabase (upsert)
// ============================================================
function upsertToSupabase(rows) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE}`;

  const options = {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        CONFIG.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_SERVICE_KEY}`,
      // on_conflict: upsert theo unique key (ngay_nhap, sdt, ten_uv, recruiter)
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    payload: JSON.stringify(rows),
    muteHttpExceptions: true,
  };

  // Thêm ?on_conflict để Supabase biết cột nào là unique key
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
// Parse ngày định dạng Việt Nam: dd/MM/yyyy hoặc d/M/yyyy
// ============================================================
function parseDateVN(str) {
  // Thử định dạng dd/MM/yyyy
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2,'0');
    const mo = m[2].padStart(2,'0');
    return `${m[3]}-${mo}-${d}`;
  }
  // Thử yyyy-MM-dd (đã chuẩn)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return '';
}

// ============================================================
// Đồng bộ incremental: chỉ dữ liệu từ N ngày gần nhất
// (nhanh hơn syncAll() khi chạy hàng ngày)
// ============================================================
function syncRecent(daysBack) {
  daysBack = daysBack || 7; // mặc định 7 ngày
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  Logger.log(`Sync incremental từ ${cutoff.toDateString()} đến nay`);
  // TODO: lọc rows theo ngay_nhap >= cutoff nếu cần tối ưu thêm
  syncAll(); // tạm thời dùng syncAll, đủ nhanh với ~200 UV/ngày
}

// ============================================================
// Đặt lịch tự động: chạy mỗi ngày lúc 7:00 sáng
// Gọi hàm này 1 lần để cài trigger
// ============================================================
function setupDailyTrigger() {
  // Xóa trigger cũ nếu có
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncAll') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Tạo trigger mới
  ScriptApp.newTrigger('syncAll')
    .timeBased()
    .everyDays(1)
    .atHour(7)          // 7:00 sáng (múi giờ của script — xem File > Project settings)
    .create();

  Logger.log('Đã đặt lịch: syncAll() chạy mỗi ngày lúc 7:00 sáng');
}

// ============================================================
// Xóa trigger (khi không cần nữa)
// ============================================================
function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncAll') {
      ScriptApp.deleteTrigger(t);
      Logger.log('Đã xóa trigger');
    }
  });
}
