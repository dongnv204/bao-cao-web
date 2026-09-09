-- ============================================================
-- SUPABASE REALTIME — Tín hiệu refresh tự động
-- Chạy file này trong: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Tạo bảng refresh_signals
CREATE TABLE IF NOT EXISTS refresh_signals (
  id         BIGSERIAL PRIMARY KEY,
  report     TEXT NOT NULL,                      -- vd: 'bc-tong', 'bc-thang', 'bc-ngay'
  triggered_by TEXT DEFAULT 'apps_script',       -- ai gửi tín hiệu
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index để query nhanh
CREATE INDEX IF NOT EXISTS idx_refresh_signals_report ON refresh_signals(report);

-- 2. Bật Row Level Security
ALTER TABLE refresh_signals ENABLE ROW LEVEL SECURITY;

-- Policy: anon role chỉ được INSERT (gửi tín hiệu từ Apps Script)
-- Service role (server) có quyền đọc/xoá dọn dẹp
CREATE POLICY "Anon can insert refresh signals" ON refresh_signals
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Service role full access" ON refresh_signals
  FOR ALL USING (auth.role() = 'service_role');

-- 3. Bật Realtime cho bảng này
-- Vào: Supabase Dashboard → Database → Replication → Realtime
-- Bật toggle cho bảng "refresh_signals"

-- Hoặc chạy lệnh sau (nếu dùng Supabase CLI):
-- ALTER publication supabase_realtime ADD TABLE refresh_signals;

-- ============================================================
-- DỌN DẸP — xoá signals cũ hơn 1 ngày (chạy định kỳ)
-- ============================================================
-- DELETE FROM refresh_signals WHERE created_at < NOW() - INTERVAL '1 day';

-- ============================================================
-- GOOGLE APPS SCRIPT — gửi tín hiệu sau khi cập nhật sheet
-- Dán đoạn này vào cuối hàm updateSheet() trong Apps Script
-- ============================================================

/*
function sendRefreshSignal(reportKey) {
  var SUPABASE_URL  = 'https://YOUR_PROJECT.supabase.co';
  var SUPABASE_ANON = 'YOUR_ANON_KEY';

  var payload = JSON.stringify({
    report:       reportKey,          // 'bc-tong' | 'bc-thang' | 'bc-ngay'
    triggered_by: 'apps_script',
  });

  var options = {
    method:      'POST',
    contentType: 'application/json',
    headers: {
      'apikey':        SUPABASE_ANON,
      'Authorization': 'Bearer ' + SUPABASE_ANON,
      'Prefer':        'return=minimal',
    },
    payload: payload,
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(
    SUPABASE_URL + '/rest/v1/refresh_signals',
    options
  );

  Logger.log('Refresh signal sent: ' + response.getResponseCode());
}

// Gọi ở cuối hàm đồng bộ dữ liệu:
// sendRefreshSignal('bc-tong');
*/

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT * FROM refresh_signals ORDER BY created_at DESC LIMIT 10;
