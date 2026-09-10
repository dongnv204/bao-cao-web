'use client'

/**
 * PrefetchReports — tải ngầm 3 báo cáo ngay khi đăng nhập dashboard.
 *
 * Hoạt động:
 *  1. Render null (vô hình với user)
 *  2. useEffect chạy 1 lần sau mount: gọi 3 API song song
 *  3. Kết quả được lưu vào localStorage cache (TTL 30 phút)
 *  4. Khi user mở từng trang, cacheGet() hit ngay → hiện dữ liệu tức thì
 */

import { useEffect } from 'react'
import { cacheGet, cacheSet } from '@/lib/cache'

export default function PrefetchReports() {
  useEffect(() => {
    const now   = new Date()
    const day   = now.getDate()
    const month = now.getMonth() + 1
    const year  = now.getFullYear()

    // dateStr dạng ISO — cache key của BC Ngày
    const mm      = String(month).padStart(2, '0')
    const dd      = String(day).padStart(2, '0')
    const dateStr = `${year}-${mm}-${dd}`

    // ── BC Ngày (hôm nay) ─────────────────────────────────────────────
    const keyNgay = `bc-ngay:${dateStr}`
    if (!cacheGet(keyNgay)) {
      fetch(`/api/reports/tuyen-dung?day=${day}&month=${month}&year=${year}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) cacheSet(keyNgay, d) })
        .catch(() => {})
    }

    // ── BC Tháng (tháng hiện tại) ─────────────────────────────────────
    const keyThang = `bc-thang:${month}:${year}`
    if (!cacheGet(keyThang)) {
      fetch(`/api/reports/bc-thang?month=${month}&year=${year}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) cacheSet(keyThang, d) })
        .catch(() => {})
    }

    // ── BC Tổng (tháng hiện tại) ──────────────────────────────────────
    const keyTong = `bc-tong:${month}:${year}`
    if (!cacheGet(keyTong)) {
      fetch(`/api/reports/bc-tong?month=${month}&year=${year}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) cacheSet(keyTong, d) })
        .catch(() => {})
    }
  }, []) // chỉ chạy 1 lần khi dashboard mount

  return null
}
