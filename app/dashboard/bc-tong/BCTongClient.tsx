'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useState as useLocalState } from 'react'
import { useTabsStore } from '../tabs-store'
import ExportButtons from '@/components/ExportButtons'
import { cacheGet, cacheGetStale, cacheSet, cacheClear } from '@/lib/cache'
import ComparePanel, { CompareRow } from '@/components/ComparePanel'
import { exportBCTongExcel } from '@/lib/export-utils'
import { useToast } from '@/components/Toast'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// Cáº¥u trÃºc má»›i v1.36+ â€” Pháº§n 1 (ÄÃ£ Lá»c) + Pháº§n 2 (Gá»‘c)
// Web API GAS cáº§n tráº£ vá» cáº£ cleanTongQuan, cleanDuyet/kyHD/daoTao/dauPV,
// cleanMonthCompare, monthCompare vÃ  thlCount Ä‘á»ƒ hiá»ƒn thá»‹ Báº£ng 1-2 & 6.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface StatRow  { label: string; val: number }
interface MonthRow { month: number; val: number }

interface GroupData {
  total:       number
  byMonthNhap: MonthRow[]
  byThiTruong: StatRow[]
  byTrangThai: StatRow[]
  thlCount?:   number    // v1.38: sá»‘ UV tá»« nhÃ³m THL
}

/** Má»™t Ä‘iá»ƒm dá»¯ liá»‡u trong báº£ng so sÃ¡nh 4 thÃ¡ng */
interface MonthCompareItem {
  month: number   // 1-12
  year:  number
  kyHD:  number
  duyet: number
}

interface BCTongData {
  month:     number
  year:      number
  updatedAt: string
  empty:     boolean
  message?:  string

  // â”€â”€ Pháº§n 2: Gá»‘c (Báº£ng 3-6) â€” backward-compatible â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  tongQuan?: { duyet: number; kyHD: number; daoTao: number; dauPV: number }
  duyet?:    GroupData
  kyHD?:     GroupData
  daoTao?:   GroupData
  dauPV?:    GroupData
  monthCompare?: MonthCompareItem[]   // Báº£ng 6: 4 thÃ¡ng gáº§n nháº¥t (Gá»‘c)

  // â”€â”€ Pháº§n 1: ÄÃ£ Lá»c (Báº£ng 1-2) â€” má»›i tá»« v1.36 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  cleanTongQuan?: { duyet: number; kyHD: number; daoTao: number; dauPV: number }
  cleanDuyet?:    GroupData
  cleanKyHD?:     GroupData
  cleanDaoTao?:   GroupData
  cleanDauPV?:    GroupData
  cleanMonthCompare?: MonthCompareItem[]  // Báº£ng 2: 4 thÃ¡ng gáº§n nháº¥t (ÄÃ£ Lá»c)
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONFIG NHÃ“M & MÃ€U Sáº®C
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const GROUPS = [
  { key: 'duyet',  label: 'Duyá»‡t',   color: 'blue'   },
  { key: 'kyHD',   label: 'KÃ½ HÄ',   color: 'orange' },
  { key: 'daoTao', label: 'ÄÃ o Táº¡o', color: 'green'  },
  { key: 'dauPV',  label: 'Äáº­u PV',  color: 'indigo' },
] as const

type GroupKey = 'duyet' | 'kyHD' | 'daoTao' | 'dauPV'

/** Map tÃªn nhÃ³m gá»‘c â†’ tÃªn nhÃ³m clean */
const CLEAN_KEY: Record<GroupKey, keyof BCTongData> = {
  duyet:  'cleanDuyet',
  kyHD:   'cleanKyHD',
  daoTao: 'cleanDaoTao',
  dauPV:  'cleanDauPV',
}

const COLOR: Record<string, { card: string; badge: string; bar: string }> = {
  blue:   { card: 'bg-blue-50 border-blue-100',      badge: 'text-blue-700',    bar: 'bg-blue-500'    },
  orange: { card: 'bg-orange-50 border-orange-100',  badge: 'text-orange-700',  bar: 'bg-orange-500'  },
  green:  { card: 'bg-emerald-50 border-emerald-100',badge: 'text-emerald-700', bar: 'bg-emerald-500' },
  indigo: { card: 'bg-indigo-50 border-indigo-100',  badge: 'text-indigo-700',  bar: 'bg-indigo-500'  },
}

const BAR_COLOR: Record<string, string> = {
  blue: '#3b82f6', orange: '#f97316', green: '#10b981', indigo: '#6366f1',
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MULTI-TAB STATE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface TabState {
  id:         string
  month:      number
  year:       number
  data:       BCTongData | null
  loading:    boolean
  error:      string
  refreshing: boolean
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PROPS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface BCTongClientProps {
  /** Dá»¯ liá»‡u SSR pre-fetch tá»« Server Component â€” hiá»ƒn thá»‹ ngay khi má»Ÿ trang */
  initialData:  BCTongData | null
  initialMonth: number
  initialYear:  number
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// COMPONENT CHÃNH
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export default function BCTongClient({ initialData, initialMonth, initialYear }: BCTongClientProps) {
  const now    = new Date()
  const nextId = useRef(2)
  const { getPage, savePage } = useTabsStore()
  const { toast, dismiss }    = useToast()

  // â”€â”€ Tabs â€” khÃ´i phá»¥c tá»« store hoáº·c dÃ¹ng SSR initialData â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [tabs, setTabs] = useState<TabState[]>(() => {
    const s = getPage('bc-tong')
    if (s && s.tabs.length > 0) return s.tabs as TabState[]
    // Náº¿u khÃ´ng cÃ³ store data, dÃ¹ng initialData tá»« SSR
    return [{
      id:         '1',
      month:      initialMonth,
      year:       initialYear,
      data:       initialData,   // hiá»ƒn thá»‹ ngay náº¿u SSR Ä‘Ã£ fetch Ä‘Æ°á»£c
      loading:    false,
      error:      '',
      refreshing: false,
    }]
  })
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const s = getPage('bc-tong')
    return s ? s.activeTabId : '1'
  })

  const updateTab = useCallback((id: string, patch: Partial<TabState>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [])

  // â”€â”€ So sÃ¡nh 2 tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [compareOpen, setCompareOpen] = useLocalState(false)
  const [compareA, setCompareA]       = useLocalState(() => tabs[0]?.id ?? '1')
  const [compareB, setCompareB]       = useLocalState(() => tabs[1]?.id ?? '1')

  const compareRows = useMemo((): CompareRow[] => {
    const dA = tabs.find(t => t.id === compareA)?.data
    const dB = tabs.find(t => t.id === compareB)?.data
    if (!dA?.tongQuan || !dB?.tongQuan) return []
    const a = dA.tongQuan, b = dB.tongQuan
    const rows: CompareRow[] = [
      { label: 'Tá»•ng quan (Gá»‘c)', a: null, b: null, isSeparator: true },
      { label: 'Duyá»‡t',   a: a.duyet  ?? 0, b: b.duyet  ?? 0 },
      { label: 'KÃ½ HÄ',   a: a.kyHD   ?? 0, b: b.kyHD   ?? 0 },
      { label: 'ÄÃ o Táº¡o', a: a.daoTao ?? 0, b: b.daoTao ?? 0 },
      { label: 'Äáº­u PV',  a: a.dauPV  ?? 0, b: b.dauPV  ?? 0 },
    ]
    // Clean data (náº¿u cÃ³)
    if (dA.cleanTongQuan && dB.cleanTongQuan) {
      const ca = dA.cleanTongQuan, cb = dB.cleanTongQuan
      rows.push({ label: 'Tá»•ng quan (ÄÃ£ Lá»c)', a: null, b: null, isSeparator: true })
      rows.push({ label: 'Duyá»‡t (lá»c)',   a: ca.duyet  ?? 0, b: cb.duyet  ?? 0 })
      rows.push({ label: 'KÃ½ HÄ (lá»c)',   a: ca.kyHD   ?? 0, b: cb.kyHD   ?? 0 })
      rows.push({ label: 'ÄÃ o Táº¡o (lá»c)', a: ca.daoTao ?? 0, b: cb.daoTao ?? 0 })
      rows.push({ label: 'Äáº­u PV (lá»c)',  a: ca.dauPV  ?? 0, b: cb.dauPV  ?? 0 })
    }
    return rows
  }, [tabs, compareA, compareB])

  // Alias cho tab Ä‘ang active
  const activeTab  = tabs.find(t => t.id === activeTabId) ?? tabs[0]
  const month      = activeTab.month
  const year       = activeTab.year
  const data       = activeTab.data
  const loading    = activeTab.loading
  const error      = activeTab.error
  const refreshing = activeTab.refreshing

  // â”€â”€ Fetch tá»« server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const _fetchFromServer = useCallback(async (m: number, y: number, tabId: string) => {
    const res = await fetch(`/api/reports/bc-tong?month=${m}&year=${y}`)
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || `HTTP ${res.status}`) }
    const d = await res.json()
    cacheSet(`bc-tong:${m}:${y}`, d)
    updateTab(tabId, { data: d })
    return d
  }, [updateTab])

  // â”€â”€ SWR: cache cÃ²n háº¡n â†’ dÃ¹ng ngay; stale â†’ show + refetch ngáº§m â”€â”€
  const fetchData = useCallback(async (m: number, y: number, tabId: string, skipCache = false) => {
    if (!skipCache) {
      const fresh = cacheGet<BCTongData>(`bc-tong:${m}:${y}`)
      if (fresh) {
        updateTab(tabId, { data: fresh, loading: false, error: '' })
        toast('info', 'Tá»« cache', `Dá»¯ liá»‡u T${m}/${y} Â· cÃ²n háº¡n 60 phÃºt`)
        return
      }
      const stale = cacheGetStale<BCTongData>(`bc-tong:${m}:${y}`)
      if (stale) {
        updateTab(tabId, { data: stale, loading: false, refreshing: true, error: '' })
        try {
          const d = await _fetchFromServer(m, y, tabId)
          toast('success', `LÃ m láº¡i xong T${m}/${y}`, `Cáº­p nháº­t: ${d.updatedAt ?? 'tá»©a xong'}`)
        } catch { /* silent â€” stale data váº«n hiá»ƒn thá»‹ */ }
        finally { updateTab(tabId, { refreshing: false }) }
        return
      }
    }
    updateTab(tabId, { loading: true, error: '', data: null })
    const loadingId = toast('loading', `Äang táº£i T${m}/${y}...`)
    try {
      const d = await _fetchFromServer(m, y, tabId)
      dismiss(loadingId)
      toast('success', `Táº£i xong T${m}/${y}`, `Cáº­p nháº­t: ${d.updatedAt ?? 'vá»«a xong'}`)
    } catch (e: any) {
      updateTab(tabId, { error: e.message })
      dismiss(loadingId)
      toast('error', 'Lá»—i táº£i dá»¯ liá»‡u', e.message)
    } finally {
      updateTab(tabId, { loading: false })
    }
  }, [updateTab, toast, dismiss, _fetchFromServer])

  const refreshData = useCallback(async () => {
    const id = activeTabId
    const t  = activeTab
    updateTab(id, { refreshing: true })
    cacheClear(`bc-tong:${t.month}:${t.year}`)
    await fetch(`/api/revalidate?tag=bc-tong`, { method: 'POST' }).catch(() => {})
    await fetchData(t.month, t.year, id, true)
    updateTab(id, { refreshing: false })
  }, [activeTabId, activeTab, updateTab, fetchData])

  // â”€â”€ Supabase Realtime â€” tá»± Ä‘á»™ng refresh khi GAS gá»­i tÃ­n hiá»‡u â”€â”€
  useRealtimeRefresh(
    useCallback(() => {
      toast('info', 'Dá»¯ liá»‡u má»›i!', 'Google Sheets vá»«a cáº­p nháº­t â€” Ä‘ang táº£i láº¡i...')
      refreshData()
    }, [toast, refreshData]),
    'bc-tong'
  )

  // Äá»“ng bá»™ tabs â†’ store
  useEffect(() => { savePage('bc-tong', { tabs, activeTabId }) }, [tabs, activeTabId, savePage])

  useEffect(() => {
    const maxId = Math.max(...tabs.map(t => Number(t.id)))
    if (maxId >= nextId.current) nextId.current = maxId + 1
  }, [])

  // Táº£i láº§n Ä‘áº§u:
  // - Náº¿u SSR Ä‘Ã£ cÃ³ initialData â†’ lÆ°u vÃ o localStorage cache + khÃ´ng cáº§n fetch thÃªm
  // - Náº¿u khÃ´ng cÃ³ data â†’ fetch tá»« server nhÆ° bÃ¬nh thÆ°á»ng
  useEffect(() => {
    const first = tabs[0]
    if (first.data) {
      // SSR data: lÆ°u vÃ o localStorage Ä‘á»ƒ láº§n sau hiá»ƒn thá»‹ ngay
      const cacheKey = `bc-tong:${first.month}:${first.year}`
      if (!cacheGet<BCTongData>(cacheKey)) {
        cacheSet(cacheKey, first.data)
      }
      return
    }
    if (!first.loading) fetchData(first.month, first.year, first.id)
  }, [])

  // Deep link â€” Ä‘á»c ?month=&year= tá»« URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const m = Number(p.get('month')), y = Number(p.get('year'))
    if (m >= 1 && m <= 12 && y >= 2020) {
      updateTab(activeTabId, { month: m, year: y })
      fetchData(m, y, activeTabId)
    }
  }, [])

  // Cáº­p nháº­t URL khi tab thay Ä‘á»•i
  useEffect(() => {
    const u = new URLSearchParams()
    u.set('month', String(month)); u.set('year', String(year))
    window.history.replaceState(null, '', '?' + u.toString())
  }, [month, year])

  // â”€â”€ Tab management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addTab = () => {
    const id = String(nextId.current++)
    const m  = now.getMonth() + 1
    const y  = now.getFullYear()
    const newTab: TabState = { id, month: m, year: y, data: null, loading: false, error: '', refreshing: false }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(id)
    fetchData(m, y, id)
  }

  const closeTab = (id: string) => {
    const next = tabs.filter(t => t.id !== id)
    if (next.length === 0) return
    setTabs(next)
    if (activeTabId === id) {
      const idx = tabs.findIndex(t => t.id === id)
      setActiveTabId(next[Math.min(idx, next.length - 1)].id)
    }
  }


  const tq       = data?.tongQuan
  const cleanTq  = data?.cleanTongQuan
  const hasData  = !!tq
  // Báº£ng 1 & 2 luÃ´n hiá»ƒn thá»‹ khi cÃ³ dá»¯ liá»‡u (ngay cáº£ khi GAS chÆ°a tráº£ cleanTongQuan)
  const hasClean = hasData

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  return (
    <div className="space-y-6">

      {/* â”€â”€ TAB BAR â”€â”€ */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl px-2 py-1.5 overflow-x-auto mb-1">
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId
          return (
            <div key={tab.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition whitespace-nowrap
                ${isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}
              onClick={() => setActiveTabId(tab.id)}>
              <span>{tab.loading ? 'â³' : 'ğŸ“Š'} T{tab.month}/{tab.year}</span>
              {tabs.length > 1 && (
                <button onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                  className="ml-1 text-slate-400 hover:text-red-400 transition leading-none">Ã—</button>
              )}
            </div>
          )
        })}
        <button onClick={addTab}
          className="px-2.5 py-1.5 text-slate-400 hover:text-blue-600 hover:bg-white/60 rounded-lg transition text-base font-bold leading-none"
          title="Má»Ÿ tab má»›i">+</button>
        {tabs.length >= 2 && (
          <button onClick={() => { setCompareA(tabs[0].id); setCompareB(tabs[1].id); setCompareOpen(true) }}
            className="ml-auto px-3 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-50 rounded-lg transition whitespace-nowrap no-print"
            title="So sÃ¡nh 2 tab">âš–ï¸ So sÃ¡nh</button>
        )}
      </div>

      {/* â”€â”€ TiÃªu Ä‘á» & bá»™ lá»c â”€â”€ */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            BÃ¡o CÃ¡o Tá»•ng {String(month).padStart(2, '0')}/{year}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Thá»‘ng kÃª UV Ä‘áº­u PV / Ä‘Ã o táº¡o / kÃ½ HÄ / duyá»‡t
            {data && !data.empty && ` Â· Cáº­p nháº­t: ${data.updatedAt}`}
            {refreshing && <span className="ml-2 text-amber-500">â†» Äang lÃ m láº¡i...</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select value={month}
            onChange={e => { const m = Number(e.target.value); updateTab(activeTabId, { month: m }); fetchData(m, activeTab.year, activeTabId) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>ThÃ¡ng {m}</option>
            ))}
          </select>
          <select value={year}
            onChange={e => { const y = Number(e.target.value); updateTab(activeTabId, { year: y }); fetchData(activeTab.month, y, activeTabId) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => fetchData(month, year, activeTabId)} disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
            {loading ? 'Äang táº£i...' : 'Xem'}
          </button>
          <button onClick={refreshData} disabled={loading || refreshing}
            title="XoÃ¡ cache vÃ  táº£i dá»¯ liá»‡u má»›i nháº¥t tá»« Google Sheets"
            className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-100 disabled:opacity-50 transition">
            {refreshing ? '...' : 'ğŸ”„'}
          </button>
          <ExportButtons
            disabled={!data || loading}
            onExcelClick={() => data && exportBCTongExcel(data, `T${month}-${year}`)}
          />
        </div>
      </div>

      {/* â”€â”€ Tráº¡ng thÃ¡i loading / error / empty â”€â”€ */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Äang táº£i dá»¯ liá»‡u...
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm">
          âš ï¸ {error}
        </div>
      )}
      {data?.empty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-amber-700 text-sm">
          ğŸ“­ {data.message}
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          PHáº¦N 1: Sá» LIá»†U ÄÃƒ Lá»ŒC (Báº£ng 1 & 2)
          Dá»¯ liá»‡u deduplicate: loáº¡i UV trÃ¹ng SÄT + "TX Nghá»‰ Viá»‡c" + "Nháº­p láº¡i"
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {hasClean && (
        <>
          {/* Banner pháº§n 1 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-green-200" />
            <span className="px-4 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs font-semibold text-green-700 tracking-wide">
              âœ… Sá» LIá»†U ÄÃƒ Lá»ŒC
            </span>
            <div className="flex-1 h-px bg-green-200" />
          </div>
          <p className="text-xs text-slate-400 -mt-3 text-center">
            ÄÃ£ loáº¡i UV trÃ¹ng SÄT xuyÃªn nhÃ³m Â· ÄÃ£ loáº¡i tráº¡ng thÃ¡i "TX Nghá»‰ Viá»‡c" vÃ  "Nháº­p láº¡i"
          </p>

          {/* â”€â”€ Báº£ng 1: Tá»•ng quan s4-nÃ³m (ÄÃ£ Lá»c) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <Section title={`Báº£ng 1 â€” Tá»•ng quan chuyá»ƒn Ä‘á»•i T${String(month).padStart(2,'0')}/${year} (ÄÃ£ Lá»c)`} badge="ÄÃ£ Lá»c" badgeColor="green">
            {!cleanTq && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                âš ï¸ GAS chÆ°a tráº£ dá»¯ liá»‡u Ä‘Ã£ lá»c â€” cáº§n cáº­p nháº­t hÃ m <code>doGet</code> trong Apps Script Ä‘á»ƒ tráº£ <code>cleanTongQuan</code>
              </p>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {GROUPS.map(g => {
                const cleanKey = CLEAN_KEY[g.key as GroupKey]
                const grp      = data![cleanKey] as GroupData | undefined
                const val      = cleanTq?.[g.key as GroupKey]
                return (
                  <div key={g.key} className={`rounded-xl border p-4 ${COLOR[g.color].card}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${COLOR[g.color].badge}`}>
                      {g.label}
                    </p>
                    <p className="text-3xl font-bold text-slate-900 mb-1">
                      {val !== undefined ? val : <span className="text-slate-300 text-xl">â€”</span>}
                    </p>
                    {grp?.thlCount ? (
                      <p className="text-xs text-slate-400 mb-2">(trong Ä‘Ã³ THL: {grp.thlCount})</p>
                    ) : (
                      <p className="text-xs text-slate-400 mb-2">UV trong T{month}/{year}</p>
                    )}
                    {/* Báº£ng thÃ¡ng nháº­p theo nhÃ³m */}
                    <MonthBreakdown rows={grp?.byMonthNhap ?? []} />
                  </div>
                )
              })}
            </div>
          </Section>

          {/* â”€â”€ Báº£ng 2: So sÃ¡nh KÃ HÄ & DUYá»†T 4 thÃ¡ng (ÄÃ£ Lá»c) â”€â”€â”€â”€ */}
          <Section title="Báº£ng 2 â€” So sÃ¡nh KÃ½ HÄ & Duyá»‡t 4 thÃ¡ng gáº§n nháº¥t (ÄÃ£ Lá»c)" badge="ÄÃ£ Lá»c" badgeColor="green">
            {data?.cleanMonthCompare && data.cleanMonthCompare.length > 0
              ? <MonthCompareTable items={data.cleanMonthCompare} />
              : <p className="text-xs text-slate-400 py-2">ChÆ°a cÃ³ dá»¯ liá»‡u so sÃ¡nh (cáº§n GAS v1.38+)</p>
            }
          </Section>
        </>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          DIVIDER â€” PHáº¦N 1 / PHáº¦N 2
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {(hasClean || hasData) && (
        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-slate-300" />
          <span className="px-4 py-1.5 bg-slate-100 border border-slate-300 rounded-full text-xs font-semibold text-slate-500 tracking-wide">
            ğŸ“Š Sá» LIá»†U Gá»C
          </span>
          <div className="flex-1 h-px bg-slate-300" />
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          PHáº¦N 2: Sá» LIá»†U Gá»C (Báº£ng 3-6)
          ToÃ n bá»™ dá»¯ liá»‡u chÆ°a lá»c, bao gá»“m THL
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {hasData && (
        <>
          {/* â”€â”€ Báº£ng 3: Tá»•ng quan 4 nhÃ³m (Gá»‘c) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <Section title={`Báº£ng 3 â€” Tá»•ng quan T${String(month).padStart(2,'0')}/${year} (Gá»‘c)`} badge="Gá»‘c" badgeColor="slate">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {GROUPS.map(g => {
                const grp = data![g.key as GroupKey] as GroupData | undefined
                return (
                  <div key={g.key} className={`rounded-xl border p-4 ${COLOR[g.color].card}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${COLOR[g.color].badge}`}>
                      {g.label}
                    </p>
                    <p className="text-3xl font-bold text-slate-900 mb-1">
                      {tq![g.key as GroupKey]}
                    </p>
                    {grp?.thlCount ? (
                      <p className="text-xs text-slate-400 mb-2">(trong Ä‘Ã³ THL: {grp.thlCount})</p>
                    ) : (
                      <p className="text-xs text-slate-400 mb-2">UV trong T{month}/{year}</p>
                    )}
                    {/* Bang thÃ¡ng nháº­p theo nhÃ³m */}
                    <MonthBreakdown rows={grp?.byMonthNhap ?? []} />
                  </div>
                )
              })}
            </div>
          </Section>

          {/* â”€â”€ Báº£ng 4: Chi tiáº¿t tá»«ng nhÃ³m (Gá»‘c) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <Section title="Báº£ng 4 â€‹ Chi tiáº¿t theo nhÃ³m (Gá»‘c)" badge="Gá»‘c" badgeColor="slate">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {GROUPS9.map(g => {
                const grp = data![g.key as GroupKey] as GroupData | undefined
                if (!grp || grp.total === 0) return null
                return <GroupCard key={g.key} label={g.label} color={g.color} grp={grp} />
              })}
            </div>
          </Section>

          {/* â”€â”€ Báº£ng 5: ThÃ¡ng nháº­p UV (Gá»‘c) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <Section title="Báº£ng 5 â€‹ ThÃ¡ng nháº­p UV theo nhÃ³m phá»…u (Gá»‘c" badge="Gá»‘c" badgeColor="slate">
            <MonthTable data={data!} />
          </Section>

          {/* â”€â”€ Báº£ng 6: So sÃ¡nh KÃ½ HÄ & DUYá»†T 4 thÃ¡ng (Gá»‘c) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <Section title="Báº£ng 6 â€‹ So sÃ¡nh KÃ½ HÄ & Duyá»‡t 4 thÃ¡ng gáº§n nháº¥t (Gá»‘c)" badge="Gá»‘c" badgeColor="slate">
            {data?.monthCompare && data.monthCompare.length > 0
              ? <MonthCompareTable items={data.monthCompare} />
              : <p className="text-xs text-slate-400 py-2">ChÆ°a cÃ³ dá»¯ liá»‡u so sÃ¡nh (cáº§n GAS v1.38+)</p>
            }
          </Section>
        </>
      )}

      {/* Compare Panel  */}
      {compareOpen && (
        <ComparePanel
          tabs={tabs.map(t => ({ id: t.id, label: `T${t.month}/${t.year}`, hasData: !!t.data }))}
          tabAId={compareA} tabBId={compareB}
          onTabAChange={setCompareA} onTabBChange={setCompareB}
          rows={compareRows}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SUB-COMPONENTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/** Section wrapper vá»›i badge nhÃ£n dá»¯ liá»‡u */
function Section({
  title, children, badge, badgeColor,
}: {
  title: string
  children: React.ReactNode
  badge?: string
  badgeColor?: 'green' | 'slate'
}) {
  const badgeCls = badgeColor === 'green'
    ? 'bg-green-100 text-green-700 border border-green-200'
    : 'bg-slate-100 text-slate-500 border border-slate-200'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {badge && (
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${badgeCls}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

/** Card chi tiáº¿t 1 nhÃ³m (byTrangThai + byThiTruong) */
function GroupCard({ label, color, grp }: { label: string; color: string; grp: GroupData }) {
  const c     = COLOR[color]
  const topTT = grp.byTrangThai.slice(0, 8)
  const topKV = grp.byThiTruong.slice(0, 10)

  return (
    <div className={`rounded-xl border p-4 ${c.card}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-bold ${c.badge}`}>{label}</span>
        <div className="flex items-center gap-2">
          {grp.thlCount ? (
            <span className="text-xs text-slate-400 bg-white/60 rounded px-1.5 py-0.5">
              THL: {grp.thlCount}
            </span>
          ) : null}
          <span className={`text-xl font-bold ${c.badge}`}>{grp.total}</span>
        </div>
      </div>

      {topTT.lengthˆ	‰ˆ
ˆ]ˆÛ\ÜÓ˜[YOH›X‹LÈ‚ˆÛ\ÜÓ˜[YOH^^È^\Û]KMLX‹LKH•¸n¨[™È0èZOÜ‚ˆ]ˆÛ\ÜÓ˜[YOHœÜXÙK^KLKH‚ˆİÜ›X\

‹JHOˆÂˆÛÛœİİHX]œ›İ[™

‹˜[ÈÜœİ[
H
ˆL
Bˆ™]\›ˆ
ˆ]ˆÙ^O^Ú_O‚ˆ]ˆÛ\ÜÓ˜[YOH™›^\İYKX™]ÙY[ˆ^^ÈX‹LH‚ˆÜ[ˆÛ\ÜÓ˜[YOH^\Û]KMŒ[˜Ø]HX^]ËVÍÌ	WHÜ‹›X™[OÜÜ[‚ˆÜ[ˆÛ\ÜÓ˜[YOH™›Û[YY][H^\Û]KMÌÜ‹˜[OÜÜ[‚ˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOH˜™Ë]Ú]KÍŒ›İ[™YY[LKH‚ˆ]ˆÛ\ÜÓ˜[YO^Ø	ØË˜˜\ŸHLKH›İ[™YY[Hİ[O^ŞÈÚYˆ	ÜİIX_HÏ‚ˆÙ]‚ˆÙ]‚ˆ
BˆJ_BˆÙ]‚ˆÙ]‚ˆ
_B‚ˆİÜÕ‹›[™İˆ	‰ˆ
ˆ]‚ˆÛ\ÜÓ˜[YOH^^È^\Û]KMLX‹LKH’ÚH¸nìXÏÜ‚ˆ]ˆÛ\ÜÓ˜[YOH™›^›^]Ü˜\Ø\LKH‚ˆİÜÕ‹›X\

‹JHOˆ
ˆÜ[ˆÙ^O^Ú_HÛ\ÜÓ˜[YOH^^È™Ë]Ú]KÍÌ›İ[™Y[ÈLˆKLH^\Û]KMÌ‚ˆÜ‹›X™[HÜ[ˆÛ\ÜÓ˜[YO^Ø›ÛX›Û	ØË˜˜YÙ_XOÜ‹˜[OÜÜ[‚ˆÜÜ[‚ˆ
J_BˆÙ]‚ˆÙ]‚ˆ
_BˆÙ]‚ˆ
BŸB‚‹ÊŠˆZ[šKX¸n¨Û™È0è[™Èš8n«\UˆÚÈHš0ìÛH
xnàÛˆ8nâÈ›Û™È8nêÛ™È[JH
‹Â™[˜İ[Ûˆ[Ûœ™XZÙİÛŠÈ›İÜÈNˆÈ›İÜÎˆ[Û›İÖ×HJHÂˆYˆ
›İÜË›[™İOOH
H™]\›ˆ[ˆÛÛœİİ[H›İÜËœ™YXÙJ
ËŠHOˆÈ
È‹˜[
Bˆ™]\›ˆ
ˆX›HÛ\ÜÓ˜[YOHËY[^^È]Lˆ›Ü™\‹]›Ü™\‹\Û]KLŒÍŒLH‚ˆXY‚ˆ‚ˆÛ\ÜÓ˜[YOH^[Y›Û[YY][H^\Û]KMKLH•0è[™Èš8n«\İ‚ˆÛ\ÜÓ˜[YOH^\šYÚ›Û[YY][H^\Û]KMKLH•Uİ‚ˆİ‚ˆİXY‚ˆ›ÙO‚ˆÜ›İÜË›X\
ˆOˆ
ˆˆÙ^O^Ü‹›[ÛHÛ\ÜÓ˜[YOH˜›Ü™\‹]›Ü™\‹\Û]KLLÎ‚ˆÛ\ÜÓ˜[YOHœKLH^\Û]KMŒ•Ôİš[™Ê‹›[Û
KœYİ\
‹	Ì	Ê_Oİ‚ˆÛ\ÜÓ˜[YOHœKLH^\šYÚ›Û\Ù[ZX›Û^\Û]KNÜ‹˜[Oİ‚ˆİ‚ˆ
J_BˆˆÛ\ÜÓ˜[YOH˜›Ü™\‹]›Ü™\‹\Û]KLŒ‚ˆÛ\ÜÓ˜[YOHœLH›Û\Ù[ZX›Û^\Û]KML•8nå‘Ïİ‚ˆÛ\ÜÓ˜[YOHœLH^\šYÚ›ÛX›Û^\Û]KNLİİ[Oİ‚ˆİ‚ˆİ›ÙO‚ˆİX›O‚ˆ
BŸB‚‹ÊŠˆ¸n¨Û™È0è[™Èš8n«\UˆÜ›ÜÜÈš0ìÛH
‹Â™[˜İ[Ûˆ[ÛX›JÈ]HNˆÈ]NˆÕÛ™Ñ]HJHÂˆÛÛœİ[ÛÙ]H™]ÈÙ][X™\Š
BˆÔ“ÕTË™›Ü‘XXÚ
ÈOˆÂˆÛÛœİÜœH]VÙËšÙ^H\ÈÜ›İ\Ù^WH\ÈÜ›İ\]H[™Yš[™YˆÜœË˜S[Ûš\™›Ü‘XXÚ
ˆOˆ[ÛÙ]˜Y
‹›[Û
JBˆJBˆÛÛœİ[ÛÈH\œ˜^K™œ›ÛJ[ÛÙ]
KœÛÜ

KŠHOˆHHŠBˆYˆ
[ÛË›[™İOOH
H™]\›ˆÛ\ÜÓ˜[YOH^\ÛH^\Û]KM’Ú0í™ÈğìÈ8nëÈxnáİOÜ‚‚ˆ[˜İ[ÛˆÙ]˜[
ÜœˆÜ›İ\]H[™Yš[™YNˆ[X™\ŠHÂˆ™]\›ˆÜœË˜S[Ûš\™š[™
ˆOˆ‹›[ÛOOHJOË˜[ÏÈˆB‚ˆ™]\›ˆ
ˆ]ˆÛ\ÜÓ˜[YOH›İ™\™›İË^X]]È‚ˆX›HÛ\ÜÓ˜[YOHËY[^\ÛH‚ˆXY‚ˆˆÛ\ÜÓ˜[YOH˜›Ü™\‹Xˆ›Ü™\‹\Û]KLL‚ˆÛ\ÜÓ˜[YOH^[YKLˆLÈ^\Û]KML›Û[YY][H•0è[™Èš8n«\İ‚ˆÑÔ“ÕTË›X\
ÈOˆ
ˆÙ^O^ÙËšÙ^_HÛ\ÜÓ˜[YO^Ø^\šYÚKLˆLÈ›Û[YY][H	ĞÓÓÔ–ÙË˜ÛÛÜ—K˜˜YÙ_XO‚ˆÙË›X™[Bˆİ‚ˆ
J_Bˆİ‚ˆİXY‚ˆ›ÙO‚ˆÛ[ÛË›X\
HOˆ
ˆˆÙ^O^Û_HÛ\ÜÓ˜[YOH˜›Ü™\‹Xˆ›Ü™\‹\Û]KMLİ™\˜™Ë\Û]KML‚ˆÛ\ÜÓ˜[YOHœKLˆLÈ^\Û]KMŒ•0è[™ÈÛ_Oİ‚ˆÑÔ“ÕTË›X\
ÈOˆÂˆÛÛœİˆHÙ]˜[
]VÙËšÙ^H\ÈÜ›İ\Ù^WH\ÈÜ›İ\]H[™Yš[™YJBˆ™]\›ˆ
ˆÙ^O^ÙËšÙ^_HÛ\ÜÓ˜[YOHœKLˆLÈ^\šYÚ›Û\Ù[ZX›Û^\Û]KN‚ˆİˆˆÈˆˆÜ[ˆÛ\ÜÓ˜[YOH^\Û]KLÌ¸ %ÜÜ[ŸBˆİ‚ˆ
BˆJ_Bˆİ‚ˆ
J_Bˆİ›ÙO‚ˆİX›O‚ˆÙ]‚ˆ
BŸB‚‹ÊŠ‚ˆ
ˆ¸n¨Û™ÈÛÈğè[šğçH1$	ˆVxná•[È0è[™Èøn©Ûˆš8n©]8 %^[İ]]›İ
0è[™È0èHønæ]
Bˆ
ˆH0è™ÎˆğïH1$È^xnáİ
¸nãÈÚ0ê›š8náØÚ
Bˆ
ˆHønæ]ˆ8nêÛ™È0è[™Ëøn«Ü.¯Ü1 Û™È8n©Û‚ˆ
ˆH0è[™Èøn©Ûˆš8n©]ˆXY\ˆ¸nà[ˆ[š
ÌØ™ŠHÚ8nëÈ¸n«Û™Ë0í8nëÈxnáİH¸nà[ˆ[šš8n¨]ˆ
‹Â™[˜İ[Ûˆ[ÛÛÛ\\™UX›JÈ][\ÈNˆÈ][\Îˆ[ÛÛÛ\\™R][V×HJHÂˆÛÛœİÛÜYHË‹‹š][\×KœÛÜ

KŠHOˆÂˆYˆ
KYX\ˆOOH‹YX\ŠH™]\›ˆKYX\ˆH‹YX\‚ˆ™]\›ˆK›[ÛH‹›[ÛˆJB‚ˆÛÛœİ]\İYHÛÜY›[™İHB‚ˆ™]\›ˆ
ˆ]‚ˆËÊˆ8¥ 8¥ ]›İX›H8¥ 8¥ 
‹ßBˆ]ˆÛ\ÜÓ˜[YOH›İ™\™›İË^X]]È‚ˆX›HÛ\ÜÓ˜[YOHËY[^\ÛH›Ü™\‹XÛÛ\ÙHˆİ[O^ŞÈ›Û˜\šX[[Y\šXÎˆ	İX[\‹[[\ÉÈ_O‚ˆXY‚ˆ‚ˆÛ\ÜÓ˜[YOH^[YKL‹HM^^È›Û\Ù[ZX›Û^\Û]KM\\˜Ø\ÙH˜XÚÚ[™Ë]ÚYH™Ë\Û]KML›Ü™\ˆ›Ü™\‹\Û]KLL‚ˆİ[O^ŞÈZ[•ÚYˆ_O‚ˆÚ8nâHønäBˆİ‚ˆÜÛÜY›X\

‹JHOˆÂˆÛÛœİ\Ó]\İHHOOH]\İYˆ™]\›ˆ
ˆÙ^O^Ú_BˆÛ\ÜÓ˜[YOHœKL‹HM^XÙ[\ˆ^^È›ÛX›Û˜XÚÚ[™Ë]ÚYH›Ü™\ˆ›Ü™\‹\Û]KLL‚ˆİ[O^Ú\Ó]\İˆÈÈ˜XÚÙÜ›İ[™ˆ	ÈÌØ™‰ËÛÛÜˆ	ÈÙ™™™™™‰ÈBˆˆÈ˜XÚÙÜ›İ[™ˆ	ÈÙ˜Y˜ÉËÛÛÜˆ	ÈÌŒMÌ˜IÈBˆO‚ˆÔİš[™Ê‹›[Û
KœYİ\
‹	Ì	Ê_KŞÜ‹YX\ŸBˆİ‚ˆ
BˆJ_Bˆİ‚ˆİXY‚ˆ›ÙO‚ˆËÊˆ0è™ÈğïH1$
‹ßBˆ‚ˆÛ\ÜÓ˜[YOHœKLÈM^^È›ÛX›Û\\˜Ø\ÙH˜XÚÚ[™Ë]ÚYH›Ü™\ˆ›Ü™\‹\Û]KLL‚ˆİ[O^ŞÈ˜XÚÙÜ›İ[™ˆ	ÈÙ™™ÙY	ËÛÛÜˆ	ÈÙXMNÉÈ_O‚ˆğïH1$ˆİ‚ˆÜÛÜY›X\

‹JHOˆÂˆÛÛœİ\Ó]\İHHOOH]\İYˆ™]\›ˆ
ˆÙ^O^Ú_BˆÛ\ÜÓ˜[YOHœKLÈM^XÙ[\ˆ›ÛY^˜X›Û›Ü™\ˆ›Ü™\‹\Û]KLL‚ˆİ[O^ŞÂˆ˜XÚÙÜ›İ[™ˆ\Ó]\İÈ	ÈÙ™XY™IÈˆ	ÈÙ™™ÙY	ËˆÛÛÜˆ	ÈÙMÌÌM‰Ëˆ›ÛÚ^™NˆŒˆ_O‚ˆÜ‹šŞRBˆİ‚ˆ
BˆJ_Bˆİ‚ˆËÊˆ0è™È^xnáİ
‹ßBˆ‚ˆÛ\ÜÓ˜[YOHœKLÈM^^È›ÛX›Û\\˜Ø\ÙH˜XÚÚ[™Ë]ÚYH›Ü™\ˆ›Ü™\‹\Û]KLL‚ˆİ[O^ŞÈ˜XÚÙÜ›İ[™ˆ	ÈÙY™™™‰ËÛÛÜˆ	ÈÌMŒÙX‰È_O‚ˆ^xnáİˆİ‚ˆÜÛÜY›X\

‹JHOˆÂˆÛÛœİ\Ó]\İHHOOH]\İYˆ™]\›ˆ
ˆÙ^O^Ú_BˆÛ\ÜÓ˜[YOHœKLÈM^XÙ[\ˆ›ÛY^˜X›Û›Ü™\ˆ›Ü™\‹\Û]KLL‚ˆİ[O^ŞÂˆ˜XÚÙÜ›İ[™ˆ\Ó]\İÈ	ÈØ™™™™IÈˆ	ÈÙY™™™‰ËˆÛÛÜˆ	ÈÌØ™‰Ëˆ›ÛÚ^™NˆŒˆ_O‚ˆÜ‹™^Y]Bˆİ‚ˆ
BˆJ_Bˆİ‚ˆİ›ÙO‚ˆİX›O‚ˆÙ]‚‚ˆÙ]‚ˆ
BŸB  {topTT.length 