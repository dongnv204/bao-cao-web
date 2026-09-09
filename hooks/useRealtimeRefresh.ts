'use client'

/**
 * useRealtimeRefresh — Subscribe Supabase Realtime để tự động refresh trang báo cáo.
 *
 * Cách dùng:
 *   useRealtimeRefresh(refreshData, 'bc-tong')
 *
 * Yêu cầu: đã chạy supabase-realtime.sql để tạo bảng refresh_signals.
 * Google Apps Script INSERT 1 row vào refresh_signals → hook này gọi onRefresh().
 */

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * @param onRefresh   callback được gọi khi nhận tín hiệu refresh
 * @param reportKey   (tuỳ chọn) lọc theo cột `report`, vd: 'bc-tong'
 */
export function useRealtimeRefresh(onRefresh: () => void, reportKey?: string) {
  useEffect(() => {
    // Channel name unique để nhiều tab không xung đột
    const channelName = `refresh_signals_${reportKey ?? 'all'}_${Date.now()}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'refresh_signals',
          // Nếu có reportKey thì chỉ lắng nghe tín hiệu cho báo cáo đó
          ...(reportKey ? { filter: `report=eq.${reportKey}` } : {}),
        },
        (_payload) => {
          onRefresh()
        }
      )
      .subscribe()

    // Cleanup khi unmount hoặc dependency thay đổi
    return () => {
      supabase.removeChannel(channel)
    }
  }, [onRefresh, reportKey])
}
