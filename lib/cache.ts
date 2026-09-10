// ── localStorage cache với TTL 30 phút ──────────────────────────────

const TTL_MS = 30 * 60 * 1000 // 30 phút

interface Entry<T> { data: T; savedAt: number }

/** Lấy dữ liệu từ cache. Trả về null nếu hết hạn hoặc không tồn tại. */
export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`cache:${key}`)
    if (!raw) return null
    const entry: Entry<T> = JSON.parse(raw)
    if (Date.now() - entry.savedAt > TTL_MS) {
      localStorage.removeItem(`cache:${key}`)
      return null
    }
    return entry.data
  } catch { return null }
}

/**
 * Lấy dữ liệu stale — trả về data kể cả đã hết TTL (dùng cho SWR pattern).
 * Trả về null chỉ khi key không tồn tại.
 */
export function cacheGetStale<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`cache:${key}`)
    if (!raw) return null
    const entry: Entry<T> = JSON.parse(raw)
    return entry.data
  } catch { return null }
}

/** Lưu dữ liệu vào cache với timestamp hiện tại. */
export function cacheSet<T>(key: string, data: T): void {
  try {
    localStorage.setItem(`cache:${key}`, JSON.stringify({ data, savedAt: Date.now() }))
  } catch { /* bỏ qua QuotaExceededError */ }
}

/** Xoá cache cho 1 key cụ thể (dùng khi refresh thủ công). */
export function cacheClear(key: string): void {
  try { localStorage.removeItem(`cache:${key}`) } catch {}
}

/** Thời gian còn lại trong cache (giây). Trả về 0 nếu đã hết hạn. */
export function cacheRemainingSeconds(key: string): number {
  try {
    const raw = localStorage.getItem(`cache:${key}`)
    if (!raw) return 0
    const entry: Entry<unknown> = JSON.parse(raw)
    const remaining = TTL_MS - (Date.now() - entry.savedAt)
    return remaining > 0 ? Math.floor(remaining / 1000) : 0
  } catch { return 0 }
}
