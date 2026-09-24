/**
 * BC Tổng — Server Component
 *
 * Fetch dữ liệu tháng hiện tại ngay trên server (dùng unstable_cache).
 * Truyền xuống BCTongClient qua prop `initialData` để trang hiển thị
 * dữ liệu NGAY KHI MỞ mà không cần click "Xem".
 */
import BCTongClient from './BCTongClient'
import { getBCTongReport } from '@/lib/sheets'

export default async function BCTongPage() {
  const now   = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  // Pre-fetch dữ liệu trên server — dùng unstable_cache nên rất nhanh
  // nếu warmup cron đã chạy trước đó.
  let initialData = null
  try {
    const result = await getBCTongReport(month, year)
    // result có dạng { ok: true, data: {...} } | { ok: false, error: '...' }
    if (result?.ok && result.data && !result.data.empty) {
      initialData = result.data
    }
  } catch {
    // Silently fail — BCTongClient sẽ tự fetch khi mount
  }

  return (
    <BCTongClient
      initialData={initialData}
      initialMonth={month}
      initialYear={year}
    />
  )
}
