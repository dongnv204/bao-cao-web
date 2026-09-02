-- ============================================================
-- CHẠY FILE NÀY TRONG SUPABASE SQL EDITOR
-- Vào: Supabase Dashboard → SQL Editor → New query → Paste → Run
-- ============================================================

-- Tạo bảng users
CREATE TABLE IF NOT EXISTS users (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer')),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index để tìm kiếm nhanh theo username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Bật Row Level Security (bảo mật: chỉ truy cập qua server)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: chỉ service role mới đọc/ghi được (không ai đọc trực tiếp từ browser)
CREATE POLICY "Service role only" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- TẠO TÀI KHOẢN ADMIN ĐẦU TIÊN
-- Mật khẩu: Admin@2024 (đã hash bằng bcrypt)
-- SAU KHI DEPLOY: đăng nhập web và đổi mật khẩu ngay!
-- ============================================================
INSERT INTO users (username, full_name, password_hash, role, active)
VALUES (
  'admin',
  'Quản Trị Viên',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj8oeC6jHxqK',
  'admin',
  true
)
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- KIỂM TRA KẾT QUẢ
-- ============================================================
SELECT id, username, full_name, role, active, created_at FROM users;
