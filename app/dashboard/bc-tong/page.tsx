/**
 * BC Tổng — Page (Client-side, giống BC Tháng)
 *
 * Bỏ SSR pre-fetch, để BCTongClient tự xử lý cache + fetch
 * giống như bc-thang/page.tsx
 */
import BCTongClient from './BCTongClient'

export default function BCTongPage() {
  return <BCTongClient />
}
