-- ============================================================
-- SCHEMA: Bảng ứng viên tuyển dụng
-- Dữ liệu đồng bộ từ Google Sheets "3. Tong Data"
-- ============================================================

-- Bảng chính: lưu thông tin ứng viên
CREATE TABLE IF NOT EXISTS candidates (
  id              BIGSERIAL PRIMARY KEY,

  -- Thông tin thời gian
  ngay_nhap       DATE          NOT NULL,         -- Cột A: Nhập (ngày ghi nhận)
  thang           SMALLINT      NOT NULL,          -- Cột B: Tháng (1-12)
  nam             SMALLINT      NOT NULL,          -- Cột C: Năm (2024, 2025...)

  -- Thông tin ứng viên
  ten_uv          TEXT          NOT NULL DEFAULT '', -- Cột E: Tên UV
  sdt             TEXT          NOT NULL DEFAULT '', -- Cột F: SĐT

  -- Phân loại & trạng thái
  check_sdt       TEXT          DEFAULT 'Hợp lệ',   -- Cột D: Hợp lệ / Trùng
  phan_loai       TEXT          DEFAULT '',          -- Cột G: Phân Loại
  trang_thai      TEXT          DEFAULT '',          -- Cột H: Trạng Thái
  ghi_chu         TEXT          DEFAULT '',          -- Cột I: Ghi Chú

  -- Nguồn recruiter (thêm khi merge 2 sheet)
  recruiter       TEXT          DEFAULT '',          -- "C.Hoa" hoặc "C.Ngoc"

  -- Metadata đồng bộ
  synced_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  row_index       INTEGER,                           -- Số hàng trong sheet gốc (debug)

  -- Unique: tránh trùng khi sync nhiều lần
  CONSTRAINT unique_uv UNIQUE (ngay_nhap, sdt, ten_uv, recruiter)
);

-- Index để query nhanh theo ngày / tháng
CREATE INDEX IF NOT EXISTS idx_candidates_ngay    ON candidates (ngay_nhap DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_thang   ON candidates (thang, nam);
CREATE INDEX IF NOT EXISTS idx_candidates_trang   ON candidates (trang_thai);
CREATE INDEX IF NOT EXISTS idx_candidates_recruiter ON candidates (recruiter);

-- View: chỉ lấy ứng viên hợp lệ (không trùng SĐT)
CREATE OR REPLACE VIEW candidates_valid AS
SELECT * FROM candidates
WHERE check_sdt = 'Hợp lệ' OR check_sdt ILIKE '%hợp lệ%' OR check_sdt = '';

-- View: thống kê theo ngày (dùng cho BC Ngày)
CREATE OR REPLACE VIEW daily_stats AS
SELECT
  ngay_nhap,
  thang,
  nam,
  COUNT(*)                                        AS tong_nhan,
  COUNT(*) FILTER (WHERE check_sdt = 'Hợp lệ')  AS hop_le,
  COUNT(*) FILTER (WHERE check_sdt = 'Trùng')   AS trung,
  COUNT(*) FILTER (
    WHERE trang_thai ILIKE '%đạt%'
       OR trang_thai ILIKE '%net%'
  )                                               AS uv_net
FROM candidates
GROUP BY ngay_nhap, thang, nam
ORDER BY ngay_nhap DESC;

-- View: thống kê theo tháng
CREATE OR REPLACE VIEW monthly_stats AS
SELECT
  thang,
  nam,
  COUNT(*)                                        AS tong_nhan,
  COUNT(*) FILTER (WHERE check_sdt = 'Hợp lệ')  AS hop_le,
  COUNT(*) FILTER (WHERE check_sdt = 'Trùng')   AS trung,
  COUNT(*) FILTER (
    WHERE trang_thai ILIKE '%đạt%'
       OR trang_thai ILIKE '%net%'
  )                                               AS uv_net
FROM candidates
GROUP BY thang, nam
ORDER BY nam DESC, thang DESC;

-- RLS: chỉ service_role mới được write; authenticated đọc được
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON candidates
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "authenticated_read" ON candidates
  FOR SELECT
  USING (auth.role() = 'authenticated');
