'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeCtxType {
  theme: Theme
  toggle: () => void
}

const ThemeCtx = createContext<ThemeCtxType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  // Đọc theme từ localStorage khi mount
  useEffect(() => {
    const saved = (localStorage.getItem('theme') as Theme) || 'light'
    setTheme(saved)
    applyTheme(saved)
  }, [])

  function applyTheme(t: Theme) {
    if (t === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
    applyTheme(next)
  }

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeCtx)
  if (!ctx) throw new Error('useTheme: thiếu <ThemeProvider>')
  return ctx
}
