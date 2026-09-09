'use client'

/**
 * Toast Notification System
 * Dùng: const { toast, dismiss } = useToast()
 *       toast('success', 'Cập nhật thành công', 'Data mới lúc 14:32')
 *       toast('error', 'Lỗi kết nối', 'Thử lại sau')
 *       toast('loading', 'Đang tải...') — không tự dismiss
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'loading' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  createdAt: number
}

interface ToastCtx {
  toast: (type: ToastType, title: string, message?: string) => string
  dismiss: (id: string) => void
}

// ── Context ───────────────────────────────────────────────────────────
const ToastContext = createContext<ToastCtx>({ toast: () => '', dismiss: () => {} })
export const useToast = () => useContext(ToastContext)

// ── Constants ─────────────────────────────────────────────────────────
const AUTO_DISMISS_MS = 4000

const ICON: Record<ToastType, string> = {
  success: '✅',
  error:   '❌',
  loading: '🔄',
  info:    'ℹ️',
}

const PROGRESS_COLOR: Record<ToastType, string> = {
  success: '#10B981',
  error:   '#EF4444',
  loading: '#3B82F6',
  info:    '#8B5CF6',
}

// ── Provider ──────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  /** Hiện 1 toast, trả về id để có thể dismiss thủ công (dùng cho loading) */
  const toast = useCallback((type: ToastType, title: string, message?: string): string => {
    const id = String(++idRef.current)
    // Giữ tối đa 5 toast cùng lúc
    setToasts(prev => [...prev.slice(-4), { id, type, title, message, createdAt: Date.now() }])
    return id
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Auto-dismiss: tìm toast cũ nhất không phải loading và schedule dismiss
  useEffect(() => {
    const dismissible = toasts.filter(t => t.type !== 'loading')
    if (dismissible.length === 0) return
    const oldest = dismissible[0]
    const remaining = AUTO_DISMISS_MS - (Date.now() - oldest.createdAt)
    const timer = setTimeout(() => dismiss(oldest.id), Math.max(remaining, 0))
    return () => clearTimeout(timer)
  }, [toasts, dismiss])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}

      {/* ── Toast container ── */}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          right: '1.25rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => (
          <ToastCard key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes toast-in {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes toast-progress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

// ── Toast card ────────────────────────────────────────────────────────
function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const showProgress = item.type !== 'loading'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.625rem',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '0.75rem 0.875rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        minWidth: '260px',
        maxWidth: '340px',
        pointerEvents: 'all',
        position: 'relative',
        overflow: 'hidden',
        animation: 'toast-in 0.22s ease',
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: '1rem', marginTop: '1px', flexShrink: 0 }}>
        {ICON[item.type]}
      </span>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b', margin: 0, lineHeight: 1.4 }}>
          {item.title}
        </p>
        {item.message && (
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '3px 0 0', lineHeight: 1.4 }}>
            {item.message}
          </p>
        )}
      </div>

      {/* Nút đóng */}
      <button
        onClick={() => onDismiss(item.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#94a3b8',
          fontSize: '0.875rem',
          lineHeight: 1,
          padding: 0,
          marginTop: '2px',
          flexShrink: 0,
        }}
        aria-label="Đóng toast"
      >
        ✕
      </button>

      {/* Progress bar — chạy trong AUTO_DISMISS_MS giây */}
      {showProgress && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '3px',
            background: PROGRESS_COLOR[item.type],
            borderRadius: '0 0 0 12px',
            animation: `toast-progress ${AUTO_DISMISS_MS}ms linear forwards`,
          }}
        />
      )}
    </div>
  )
}
