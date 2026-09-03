'use client'

/**
 * TabsStore — giữ state tabs của BC Ngày / BC Tháng / BC Tổng
 * khi user điều hướng giữa các trang trong cùng dashboard session.
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface PageState {
  tabs: unknown[]       // TabState[] của từng trang — generic để tránh import vòng
  activeTabId: string
}

interface TabsStoreCtx {
  getPage: (key: string) => PageState | null
  savePage: (key: string, state: PageState) => void
}

const TabsStoreCtx = createContext<TabsStoreCtx | null>(null)

export function TabsStoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Record<string, PageState>>({})

  const getPage = useCallback(
    (key: string): PageState | null => store[key] ?? null,
    [store]
  )

  const savePage = useCallback((key: string, state: PageState) => {
    setStore(prev => ({ ...prev, [key]: state }))
  }, [])

  return (
    <TabsStoreCtx.Provider value={{ getPage, savePage }}>
      {children}
    </TabsStoreCtx.Provider>
  )
}

export function useTabsStore() {
  const ctx = useContext(TabsStoreCtx)
  if (!ctx) throw new Error('useTabsStore: thiếu <TabsStoreProvider>')
  return ctx
}
