# Hệ Thống Báo Cáo Nội Bộ

Web app báo cáo nội bộ kết nối Google Sheets, deploy trên Vercel.

## Cấu trúc phân quyền

| Role    | Quyền |
|---------|-------|
| admin   | Xem tất cả BC + Quản lý user |
| manager | Xem tất cả BC |
| viewer  | Chỉ xem BC được giao |

## Hướng dẫn deploy

### Bước 1: Setup Supabase
1. Vào Supabase Dashboard → SQL Editor
2. Paste nội dung file `supabase-setup.sql` → Run
3. Tài khoản admin mặc định: `admin` / `Admin@2024`

### Bước 2: Tạo file .env.local
```
NEXT_PUBLIC_SUPABASE_URL=https://cgzuvuorvvflkpwqxfku.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
JWT_SECRET=tao_chuoi_ngau_nhien_dai_32_ky_tu_o_day
APPS_SCRIPT_URL=url_apps_script_cua_ban
```

### Bước 3: Push lên GitHub
```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/dongnv204/bao-cao-web.git
git push -u origin main
```

### Bước 4: Deploy Vercel
1. Vào vercel.com → New Project → Import từ GitHub
2. Thêm Environment Variables (copy từ .env.local)
3. Deploy!

## Tài khoản mặc định
- Username: `admin`
- Password: `Admin@2024`
- **Đổi mật khẩu ngay sau khi đăng nhập lần đầu!**
