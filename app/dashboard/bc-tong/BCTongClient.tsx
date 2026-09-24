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
// COMPONENT CHÃN
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
      rows.push({ label: 'Duyá»‡t (lÃ­c)',   a: ca.duyet  ?? 0, b: cb.duyet  ?? 0 })
      rows.push({ label: 'KÃ½ HÄ (lÃ­c)',   a: ca.kyHD   ?? 0, b: cb.kyHD   ?? 0 })
      rows.push({ label: 'ÄÃ o Táº¡o (lÃ­c)', a: ca.daoTao ?? 0, b: cb.daoTao ?? 0 })
      rows.push({ label: 'Äáº­u PV (lÃ­c)',  a: ca.dauPV  ?? 0, b: cb.dauPV  ?? 0 })
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

  // â”€â”€ Fetch tá»« server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const _fetchFromServer = useCallback(async (m: number, y: number, tabId: string) => {
    const res = await fetch(`/api/reports/bc-tong?month=${m}&year=${y}`)
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || `HTTP ${res.status}`) }
    const d = await res.json()
    cacheSet(`bc-tong:${m}:${y}`, d)
    updateTab(tabId, { data: d })
    return d
  }, [updateTab])

  // â”€â”€ SWR: cache cÃ²n háº¡n â†’ dÃ¹ng ngay; stale â†’ show + refetch ngáº©m â”€â”€
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
          toast('success', `LÃ m má»›i xong T${m}/${y}`, `Cáº­p nháº­t: ${d.updatedAt ?? 'vá»¯a xong'}`)
        } catch { /* silent â”€ stale data váº«n hiá»ƒn thá»‹ */ }
        finally { updateTab(tabId, { refreshing: false }) }
        return
      }
    }
    updateTab(tabId, { loading: true, error: '', data: null })
    const loadingId = toast('loading', `Äang táº£i T${m}/${y}...`)
    try {
      const d = await _fetchFromServer(m, y, tabId)
      dismiss(loadingId)
      toast('success', `Táº£i xong T${m}/${y}`, `Cáº­p nháº­t: ${d.updatedAt ?? 'vá»¯a xong'}`)
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

  // Äá»“ng bá»™ tabs => store
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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
          title="Ná»Ÿ tab má»›i">+</button>
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
            {refreshing && <span className="ml-2 text-amber-500">â†» Äang lÃ m má»›i...</span>}
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
          Dá»¯ liá»‡u deduplicate: loáº¡i UV trÃ¹ng SÄP + "TX Nghá»‰ Viá»‡c" + "Nháº­p láº¡i"
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

          {/* â”€â”€ Báº£ng 1: Tá»•ng quan 4 nhÃ³m (ÄÃ£ Lá»c) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                [Ûœ™XZÙİÛˆ›İÜÏ^ÙÜœË˜S[Ûš\ÏÈ×_HÏ‚ˆÙ]‚ˆ
BˆJ_BˆÙ]‚ˆÔÙXİ[Û‚‚ˆËÊˆ8¥ 8¥ ¸n¨Û™ÈˆÛÈğè[šğïH1$	ˆVxná•0è[™È
1$0èÈ8nãXÊH8¥ 8¥ 8¥ 8¥ 
‹ßBˆÙXİ[Ûˆ]OH¸n¨Û™Èˆ8 %ÛÈğè[šğïH1$	ˆ^xnáİ0è[™Èøn©Ûˆš8n©]
1$0èÈ8nãXÊHˆ˜YÙOH±$0èÈ8nãXÈˆ˜YÙPÛÛÜH™Ü™Y[ˆ‚ˆÙ]OË˜ÛX[“[ÛÛÛ\\™H	‰ˆ]K˜ÛX[“[ÛÛÛ\\™K›[™İˆˆÈ[ÛÛÛ\\™UX›H][\Ï^Ù]K˜ÛX[“[ÛÛÛ\\™_HÏ‚ˆˆÛ\ÜÓ˜[YOH^^È^\Û]KMKLˆÚ1¬HğìÈ8nëÈxnáİHÛÈğè[š
øn©ÛˆĞTÈŒKŒÎ
ÊOÜ‚ˆBˆÔÙXİ[Û‚ˆÏ‚ˆ
_B‚ˆËÊˆ8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥dˆU’QTˆ8 %8n©“ˆHÈ8n©“ˆ‚ˆ8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d
‹ßBˆÊ\ĞÛX[ˆ\Ñ]JH	‰ˆ
ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆØ\LÈ^KLˆ‚ˆ]ˆÛ\ÜÓ˜[YOH™›^LH\™Ë\Û]KLÌˆÏ‚ˆÜ[ˆÛ\ÜÓ˜[YOHœMKLKH™Ë\Û]KLL›Ü™\ˆ›Ü™\‹\Û]KLÌ›İ[™YY[^^È›Û\Ù[ZX›Û^\Û]KML˜XÚÚ[™Ë]ÚYH‚ˆ<'äâønäxná•HønäÂˆÜÜ[‚ˆ]ˆÛ\ÜÓ˜[YOH™›^LH\™Ë\Û]KLÌˆÏ‚ˆÙ]‚ˆ
_B‚ˆËÊˆ8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥dˆ8n©“ˆˆønäxná•HønäÈ
¸n¨Û™ÈËMŠBˆğèˆ¸næH8nëÈxnáİHÚ1¬H8nãXË˜[ÈønäÛHˆ8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d
‹ßBˆÚ\Ñ]H	‰ˆ
ˆ‚ˆËÊˆ8¥ 8¥ ¸n¨Û™ÈÎˆ8nå[™È]X[ˆš0ìÛH
ønäXÊH8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 
‹ßBˆÙXİ[Ûˆ]O^Ø¸n¨Û™ÈÈ8 %8nå[™È]X[ˆ	Ôİš[™Ê[Û
KœYİ\
‹	Ì	Ê_KÉŞYX\ŸH
ønäXÊXH˜YÙOH‘ønäXÈˆ˜YÙPÛÛÜHœÛ]H‚ˆ]ˆÛ\ÜÓ˜[YOH™ÜšYÜšYXÛÛËLˆÎ™ÜšYXÛÛËMØ\M‚ˆÑÔ“ÕTË›X\
ÈOˆÂˆÛÛœİÜœH]HVÙËšÙ^H\ÈÜ›İ\Ù^WH\ÈÜ›İ\]H[™Yš[™Yˆ™]\›ˆ
ˆ]ˆÙ^O^ÙËšÙ^_HÛ\ÜÓ˜[YO^Ø›İ[™Y^›Ü™\ˆM	ĞÓÓÔ–ÙË˜ÛÛÜ—K˜Ø\™XO‚ˆÛ\ÜÓ˜[YO^Ø^^È›Û\Ù[ZX›Û\\˜Ø\ÙH˜XÚÚ[™Ë]ÚYHX‹LH	ĞÓÓÔ–ÙË˜ÛÛÜ—K˜˜YÙ_XO‚ˆÙË›X™[BˆÜ‚ˆÛ\ÜÓ˜[YOH^LŞ›ÛX›Û^\Û]KNLX‹LH‚ˆİHVÙËšÙ^H\ÈÜ›İ\Ù^W_BˆÜ‚ˆÙÜœËÛİ[È
ˆÛ\ÜÓ˜[YOH^^È^\Û]KMX‹LˆŠ›Û™È1$pìÈˆÙÜœÛİ[JOÜ‚ˆ
Hˆ
ˆÛ\ÜÓ˜[YOH^^È^\Û]KMX‹Lˆ•Uˆ›Û™ÈÛ[ÛKŞŞYX\ŸOÜ‚ˆ
_BˆËÊˆ¸n¨Û™È0è[™Èš8n«\[Èš0ìÛH
‹ßBˆ[Ûœ™XZÙİÛˆ›İÜÏ^ÙÜœË˜S[Ûš\ÏÈ×_HÏ‚ˆÙ]‚ˆ
BˆJ_BˆÙ]‚ˆÔÙXİ[Û‚‚ˆËÊˆ8¥ 8¥ ¸n¨Û™ÈˆÚHxn¯İ8nêÛ™Èš0ìÛH
ønäXÊH8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 
‹ßBˆÙXİ[Ûˆ]OH¸n¨Û™È8 %ÚHxn¯İ[Èš0ìÛH
ønäXÊHˆ˜YÙOH‘ønäXÈˆ˜YÙPÛÛÜHœÛ]H‚ˆ]ˆÛ\ÜÓ˜[YOH™ÜšYÜšYXÛÛËLHÎ™ÜšYXÛÛËLˆØ\Mˆ‚ˆÑÔ“ÕTË›X\
ÈOˆÂˆÛÛœİÜœH]HVÙËšÙ^H\ÈÜ›İ\Ù^WH\ÈÜ›İ\]H[™Yš[™YˆYˆ
YÜœÜœİ[OOH
H™]\›ˆ[ˆ™]\›ˆÜ›İ\Ø\™Ù^O^ÙËšÙ^_HX™[^ÙË›X™[HÛÛÜ^ÙË˜ÛÛÜŸHÜœ^ÙÜœHÏ‚ˆJ_BˆÙ]‚ˆÔÙXİ[Û‚‚ˆËÊˆ8¥ 8¥ ¸n¨Û™ÈNˆ0è[™Èš8n«\Uˆ
ønäXÊH8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 
‹ßBˆÙXİ[Ûˆ]OH¸n¨Û™ÈH8 %0è[™Èš8n«\Uˆ[Èš0ìÛH8ná]H
ønäXÊHˆ˜YÙOH‘ønäXÈˆ˜YÙPÛÛÜHœÛ]H‚ˆ[ÛX›H]O^Ù]H_HÏ‚ˆÔÙXİ[Û‚‚ˆËÊˆ8¥ 8¥ ¸n¨Û™ÈˆÛÈğè[šğçH1$	ˆVxná•0è[™È
ønäXÊH8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 8¥ 
‹ßBˆÙXİ[Ûˆ]OH¸n¨Û™Èˆ8 %ÛÈğè[šğïH1$	ˆ^xnáİ0è[™Èøn©Ûˆš8n©]
ønäXÊHˆ˜YÙOH‘ønäXÈˆ˜YÙPÛÛÜHœÛ]H‚ˆÙ]OË›[ÛÛÛ\\™H	‰ˆ]K›[ÛÛÛ\\™K›[™İˆˆÈ[ÛÛÛ\\™UX›H][\Ï^Ù]K›[ÛÛÛ\\™_HÏ‚ˆˆÛ\ÜÓ˜[YOH^^È^\Û]KMKLˆÚ1¬HğìÈ8nëÈxnáİHÛÈğè[š
øn©ÛˆĞTÈŒKŒÎ
ÊOÜ‚ˆBˆÔÙXİ[Û‚ˆÏ‚ˆ
_B‚ˆËÊˆ8¥ 8¥ ÛÛ\\™H[™[8¥ 8¥ 
‹ßBˆØÛÛ\\™SÜ[ˆ	‰ˆ
ˆÛÛ\\™T[™[ˆXœÏ^İXœË›X\
Oˆ
ÈYˆšYX™[ˆ	İ›[ÛKÉİYX\ŸX\Ñ]NˆH]™]HJJ_BˆXRY^ØÛÛ\\™P_HX’Y^ØÛÛ\\™PŸBˆÛ•XPÚ[™ÙO^ÜÙ]ÛÛ\\™P_HÛ•XÚ[™ÙO^ÜÙ]ÛÛ\\™PŸBˆ›İÜÏ^ØÛÛ\\™T›İÜßBˆÛÛÜÙO^Ê
HOˆÙ]ÛÛ\\™SÜ[Š˜[ÙJ_BˆÏ‚ˆ
_BˆÙ]‚ˆ
BŸB‚‹ËÈ8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d‹ËÈÕP‹PÓÓTÓ‘S•Â‹ËÈ8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d8¥d‚‹ÊŠˆÙXİ[ÛˆÜ˜\\ˆ¸næÚH˜YÙHš0èÛˆ8nëÈxnáİH
‹Â™[˜İ[ÛˆÙXİ[ÛŠÂˆ]KÚ[™[‹˜YÙK˜YÙPÛÛÜ‹ŸNˆÂˆ]Nˆİš[™ÂˆÚ[™[ˆ™XXİ”™XXİ›ÙBˆ˜YÙOÎˆİš[™Âˆ˜YÙPÛÛÜÎˆ	ÙÜ™Y[‰È	ÜÛ]IÂŸJHÂˆÛÛœİ˜YÙPÛÈH˜YÙPÛÛÜˆOOH	ÙÜ™Y[‰ÂˆÈ	Ø™ËYÜ™Y[‹LL^YÜ™Y[‹MÌ›Ü™\ˆ›Ü™\‹YÜ™Y[‹LŒ	Âˆˆ	Ø™Ë\Û]KLL^\Û]KML›Ü™\ˆ›Ü™\‹\Û]KLŒ	Â‚ˆ™]\›ˆ
ˆ]ˆÛ\ÜÓ˜[YOH˜™Ë]Ú]H›İ[™YL›Ü™\ˆ›Ü™\‹\Û]KLŒÚYİË\ÛHİ™\™›İËZY[ˆ‚ˆ]ˆÛ\ÜÓ˜[YOHœMHKLÈ›Ü™\‹Xˆ›Ü™\‹\Û]KLL›^][\ËXÙ[\ˆ\İYKX™]ÙY[ˆ‚ˆˆÛ\ÜÓ˜[YOH^\ÛH›Û\Ù[ZX›Û^\Û]KMÌİ]_OÚ‚ˆØ˜YÙH	‰ˆ
ˆÜ[ˆÛ\ÜÓ˜[YO^Ø^^È›Û[YY][HL‹HKLH›İ[™YY[	Ø˜YÙPÛßXO‚ˆØ˜YÙ_BˆÜÜ[‚ˆ
_BˆÙ]‚ˆ]ˆÛ\ÜÓ˜[YOHœMHØÚ[™[ŸOÙ]‚ˆÙ]‚ˆ
BŸB‚‹ÊŠˆØ\™ÚHxn¯İHš0ìÛH
U˜[™ÕZH
ÈUU[Û™ÊH
‹Â™[˜İ[ÛˆÜ›İ\Ø\™
ÈX™[ÛÛÜ‹ÜœNˆÈX™[ˆİš[™ÎÈÛÛÜˆİš[™ÎÈÜœˆÜ›İ\]HJHÂˆÛÛœİÈHÓÓÔ–ØÛÛÜ—BˆÛÛœİÜHÜœ˜U˜[™ÕZKœÛXÙJ
BˆÛÛœİÜÕˆHÜœ˜UU[Û™ËœÛXÙJL
B‚ˆ™]\›ˆ
ˆ]ˆÛ\ÜÓ˜[YO^Ø›İ[™Y^›Ü™\ˆM	ØË˜Ø\™XO‚ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆ\İYKX™]ÙY[ˆX‹LÈ‚ˆÜ[ˆÛ\ÜÓ˜[YO^Ø^\ÛH›ÛX›Û	ØË˜˜YÙ_XOÛX™[OÜÜ[‚ˆ]ˆÛ\ÜÓ˜[YOH™›^][\ËXÙ[\ˆØ\Lˆ‚ˆÙÜœÛİ[È
ˆÜ[ˆÛ\ÜÓ˜[YOH^^È^\Û]KM™Ë]Ú]KÍŒ›İ[™YLKHKLH‚ˆˆÙÜœÛİ[BˆÜÜ[‚ˆ
Hˆ[BˆÜ[ˆÛ\ÜÓ˜[YO^Ø^^›ÛX›Û	ØË˜˜YÙ_XOÙÜœİ[OÜÜ[‚ˆÙ]‚ˆÂöF—cà ¢·F÷EBæÆVæwF‚âbb€¢ÆF—b6Æ74æÖSÒ&Ö"Ó2#à¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡B×6ÆFRÓSÖ"ÓãR#åG.ªærFŒ:“Â÷à¢ÆF—b6Æ74æÖSÒ'76R×’ÓãR#à¢·F÷EBæÖ‚‡"Â’’Óâ°¢6öç7B7BÒÖF‚ç&÷VæB‚‡"çfÂòw'çF÷FÂ’¢¢&WGW&â€¢ÆF—b¶W“×¶—Óà¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâFW‡B×‡2Ö"ÓãR#à¢Ç7â6Æ74æÖSÒ'FW‡B×6ÆFRÓcG'Væ6FRÖ‚×rÕ³sUÒ#ç·"æÆ&VÇÓÂ÷7ãà¢Ç7â6Æ74æÖSÒ&föçBÖÖVF—VÒFW‡B×6ÆFRÓs#ç·"çfÇÓÂ÷7ãà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&&r×v†—FRóc&÷VæFVBÖgVÆÂ‚ÓãR#à¢ÆF—b6Æ74æÖS×¶G¶2æ&'Ò‚ÓãR&÷VæFVBÖgVÆÆÒ7G–ÆS×·²v–GFƒ¢G·7GÒV×Òóà¢ÂöF—cà¢ÂöF—cà¢¢Ò—Ğ¢ÂöF—cà¢ÂöF—cà¢—Ğ ¢·F÷µbæÆVæwF‚âbb€¢ÆF—cà¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡B×6ÆFRÓSÖ"ÓãR#ä¶‡Rn»3Â÷à¢ÆF—b6Æ74æÖSÒ&fÆW‚fÆW‚×w&vÓãR#à¢·F÷µbæÖ‚‡"Â’’Óâ€¢Ç7â¶W“×¶—Ò6Æ74æÖSÒ'FW‡B×‡2&r×v†—FRós&÷VæFVBÖÆr‚Ó"’ÓFW‡B×6ÆFRÓs#à¢·"æÆ&VÇÒÇ7â6Æ74æÖS×¶föçBÖ&öÆBG¶2æ&FvWÖÓç·"çfÇÓÂ÷7ãà¢Â÷7ãà¢’—Ğ¢ÂöF—cà¢ÂöF—cà¢—Ğ¢ÂöF—cà¢§Ğ ¢ò¢¢Ö–æ’Ö.ª6ærFŒ:æræª×Ub6†òæŒ;6Ò††¸6âF¸²G&öærNº¶ærF–ÆR’¢ğ¦gVæ7F–öâÖöçF„'&V¶F÷vâ‡²&÷w2Ó¢²&÷w3¢ÖöçF…&÷uµÒÒ’°¢–b‡&÷w2æÆVæwF‚ÓÓÒ’&WGW&âçVÆÀ¢6öç7BF÷FÂÒ&÷w2ç&VGV6R‚‡2Â"’Óâ2²"çfÂÂ¢&WGW&â€¢ÇF&ÆR6Æ74æÖSÒ'rÖgVÆÂFW‡B×‡2×BÓ"&÷&FW"×B&÷&FW"×6ÆFRÓ#ócBÓ#à¢ÇF†VCà¢ÇG#à¢ÇF‚6Æ74æÖSÒ'FW‡BÖÆVgBföçBÖÖVF—VÒFW‡B×6ÆFRÓC’ÓãR#åFŒ:æræª×Â÷Fƒà¢ÇF‚6Æ74æÖSÒ'FW‡B×&–v‡BföçBÖÖVF—VÒFW‡B×6ÆFRÓC’ÓãR#åUcÂ÷Fƒà¢Â÷G#à¢Â÷F†VCà¢ÇF&öG“à¢·&÷w2æÖ‡"Óâ€¢ÇG"¶W“×·"æÖöçF‡Ò6Æ74æÖSÒ&&÷&FW"×B&÷&FW"×6ÆFRÓóƒ#à¢ÇFB6Æ74æÖSÒ'’ÓãRFW‡B×6ÆFRÓc#åGµ7G&–ær‡"æÖöçF‚’çE7F'Bƒ"Âsr—ÓÂ÷FCà¢ÇFB6Æ74æÖSÒ'’ÓãRFW‡B×&–v‡BföçB×6VÖ–&öÆBFW‡B×6ÆFRÓƒ#ç·"çfÇÓÂ÷FCà¢Â÷G#à¢’—Ğ¢ÇG"6Æ74æÖSÒ&&÷&FW"×B&÷&FW"×6ÆFRÓ##à¢ÇFB6Æ74æÖSÒ'BÓföçB×6VÖ–&öÆBFW‡B×6ÆFRÓS#åN¹DäsÂ÷FCà¢ÇFB6Æ74æÖSÒ'BÓFW‡B×&–v‡BföçBÖ&öÆBFW‡B×6ÆFRÓ“#ç·F÷FÇÓÂ÷FCà¢Â÷G#à¢Â÷F&öG“à¢Â÷F&ÆSà¢§Ğ ¢ò¢¢.ª6ærFŒ:æræª×Ub7&÷72æŒ;6Ò¢ğ¦gVæ7F–öâÖöçF…F&ÆR‡²FFÓ¢²FF¢$5FöætFFÒ’°¢6öç7BÖöçF…6WBÒæWr6WCÆçVÖ&W#â‚¢u$õU2æf÷$V6‚†rÓâ°¢6öç7Bw'ÒFF¶ræ¶W’2w&÷W¶W•Ò2w&÷WFFÂVæFVf–æV@¢w'òæ'”ÖöçF„æ†æf÷$V6‚‡"ÓâÖöçF…6WBæFB‡"æÖöçF‚’¢Ò¢6öç7BÖöçF‡2Ò'&’æg&öÒ†ÖöçF…6WB’ç6÷'B‚†Â"’ÓâÒ"¢–b†ÖöçF‡2æÆVæwF‚ÓÓÒ’&WGW&âÇ6Æ74æÖSÒ'FW‡B×6ÒFW‡B×6ÆFRÓC#ä¹ær<;2NºòÆ¸wSÂ÷à ¢gVæ7F–öâvWEfÂ†w'¢w&÷WFFÂVæFVf–æVBÂÓ¢çVÖ&W"’°¢&WGW&âw'òæ'”ÖöçF„æ†æf–æB‡"Óâ"æÖöçF‚ÓÓÒÒ“òçfÂóò ¢Ğ ¢&WGW&â€¢ÆF—b6Æ74æÖSÒ&÷fW&fÆ÷r×‚ÖWFò#à¢ÇF&ÆR6Æ74æÖSÒ'rÖgVÆÂFW‡B×6Ò#à¢ÇF†VCà¢ÇG"6Æ74æÖSÒ&&÷&FW"Ö"&÷&FW"×6ÆFRÓ#à¢ÇF‚6Æ74æÖSÒ'FW‡BÖÆVgB’Ó"‚Ó2FW‡B×6ÆFRÓSföçBÖÖVF—VÒ#åFŒ:æræª×Â÷Fƒà¢´u$õU2æÖ†rÓâ€¢ÇF‚¶W“×¶ræ¶W—Ò6Æ74æÖS×¶FW‡B×&–v‡B’Ó"‚Ó2föçBÖÖVF—VÒG´4ôÄõ%¶ræ6öÆ÷%Òæ&FvWÖÓà¢¶ræÆ&VÇĞ¢Â÷Fƒà¢’—Ğ¢Â÷G#à¢Â÷F†VCà¢ÇF&öG“à¢¶ÖöçF‡2æÖ†ÒÓâ€¢ÇG"¶W“×¶×Ò6Æ74æÖSÒ&&÷&FW"Ö"&÷&FW"×6ÆFRÓS†÷fW#¦&r×6ÆFRÓS#à¢ÇFB6Æ74æÖSÒ'’Ó"‚Ó2FW‡B×6ÆFRÓc#åFŒ:ær¶×ÓÂ÷FCà¢´u$õU2æÖ†rÓâ°¢6öç7BbÒvWEfÂ†FF¶ræ¶W’2w&÷W¶W•Ò2w&÷WFFÂVæFVf–æVBÂÒ¢&WGW&â€¢ÇFB¶W“×¶ræ¶W—Ò6Æ74æÖSÒ'’Ó"‚Ó2FW‡B×&–v‡BföçB×6VÖ–&öÆBFW‡B×6ÆFRÓƒ#à¢·bâòb¢Ç7â6Æ74æÖSÒ'FW‡B×6ÆFRÓ3#î(	CÂ÷7ãçĞ¢Â÷FCà¢¢Ò—Ğ¢Â÷G#à¢’—Ğ¢Â÷F&öG“à¢Â÷F&ÆSà¢ÂöF—cà¢§Ğ ¢ò¢ ¢¢.ª6ær6ò<:æ‚¼9ÒŒIbEU¸eBF†VòBFŒ:ær~ªvâæªWB(	BÆ–÷WB—f÷B‡FŒ:ærÌ:Ò>¹—B¢¢ÒŒ:æs¢¼;ÒŒIòGW¸wB†$R6Œ:¦æ‚Î¸v6‚¢¢Ò>¹—C¢Nº¶ærFŒ:ærÂ>«÷«÷N ÖærNªvà¢¢ÒF¹ær~ªvâæªWC¢†VFW"î¸â†æ‚‚36#ƒ&cb’6ºòG.ªöærÂ;BNºòÆ¸wRî¸â†æ‚æª@¢¢ğ¦gVæ7F–öâÖöçF„6ö×&UF&ÆR‡²—FV×2Ó¢²—FV×3¢ÖöçF„6ö×&T—FVÕµÒÒ’°¢6öç7B6÷'FVBÒ²ââæ—FV×5Òç6÷'B‚†Â"’Óâ°¢–b†ç–V"ÓÒ"ç–V"’&WGW&âç–V"Ò"ç–V ¢&WGW&âæÖöçF‚Ò"æÖöçF€¢Ò ¢6öç7BÆFW7D–G‚Ò6÷'FVBæÆVæwF‚Ò ¢&WGW&â€¢ÆF—cà¢²ò¢)H)H—f÷BF&ÆR)H)H¢÷Ğ¢ÆF—b6Æ74æÖSÒ&÷fW&fÆ÷r×‚ÖWFò#à¢ÇF&ÆR6Æ74æÖSÒ'rÖgVÆÂFW‡B×6Ò&÷&FW"Ö6öÆÆ6R"7G–ÆS×·²föçEf&–çDçVÖW&–3¢wF'VÆ"ÖçV×2r×Óà¢ÇF†VCà¢ÇG#à¢ÇF‚6Æ74æÖSÒ'FW‡BÖÆVgB’Ó"ãR‚ÓBFW‡B×‡2föçB×6VÖ–&öÆBFW‡B×6ÆFRÓCWW&66RG&6¶–ær×v–FR&r×6ÆFRÓS&÷&FW"&÷&FW"×6ÆFRÓ ¢7G–ÆS×·²Ö–åv–GFƒ¢ƒ×Óà¢6¸’>¹¢Â÷Fƒà¢·6÷'FVBæÖ‚‡"Â’’Óâ°¢6öç7B—4ÆFW7BÒ’ÓÓÒÆFW7D–G€¢&WGW&â€¢ÇF‚¶W“×¶—Ğ¢6Æ74æÖSÒ'’Ó"ãR‚ÓBFW‡BÖ6VçFW"FW‡B×‡2föçBÖ&öÆBG&6¶–ær×v–FR&÷&FW"&÷&FW"×6ÆFRÓ ¢7G–ÆS×¶—4ÆFW7@¢ò²&6¶w&÷VæC¢r36#ƒ&cbrÂ6öÆ÷#¢r6fffffbrĞ¢¢²&6¶w&÷VæC¢r6c†ff2rÂ6öÆ÷#¢r3cs&rĞ¢Óà¢Gµ7G&–ær‡"æÖöçF‚’çE7F'Bƒ"Âsr—Ò÷·"ç–V'Ğ¢Â÷Fƒà¢¢Ò—Ğ¢Â÷G#à¢Â÷F†VCà¢ÇF&öG“à¢²ò¢Œ:ær¼;ÒŒI¢÷Ğ¢ÇG#à¢ÇFB6Æ74æÖSÒ'’Ó2‚ÓBFW‡B×‡2föçBÖ&öÆBWW&66RG&6¶–ær×v–FR&÷&FW"&÷&FW"×6ÆFRÓ ¢7G–ÆS×·²&6¶w&÷VæC¢r6ffcvVBrÂ6öÆ÷#¢r6VSƒ2r×Óà¢¼;ÒŒI ¢Â÷FCà¢·6÷'FVBæÖ‚‡"Â’’Óâ°¢6öç7B—4ÆFW7BÒ’ÓÓÒÆFW7D–G€¢&WGW&â€¢ÇFB¶W“×¶—Ğ¢6Æ74æÖSÒ'’Ó2‚ÓBFW‡BÖ6VçFW"föçBÖW‡G&&öÆB&÷&FW"&÷&FW"×6ÆFRÓ ¢7G–ÆS×·°¢&6¶w&÷VæC¢—4ÆFW7Bòr6F&VfRr¢r6ffcvVBrÀ¢6öÆ÷#¢r6c“s3brÀ¢föçE6—¦S¢#À¢×Óà¢·"æ·”„GĞ¢Â÷FCà¢¢Ò—Ğ¢Â÷G#à¢²ò¢Œ:ærGW¸wB¢÷Ğ¢ÇG#à¢ÇFB6Æ74æÖSÒ'’Ó2‚ÓBFW‡B×‡2föçBÖ&öÆBWW&66RG&6¶–ær×v–FR&÷&FW"&÷&FW"×6ÆFRÓ ¢7G–ÆS×·²&6¶w&÷VæC¢r6VfcffbrÂ6öÆ÷#¢r3#Sc6V"r×Óà¢GW¸w@¢Â÷FCà¢·6÷'FVBæÖ‚‡"Â’’Óâ°¢6öç7B—4ÆFW7BÒ’ÓÓÒÆFW7D–G€¢&WGW&â€¢ÇFB¶W“×¶—Ğ¢6Æ74æÖSÒ'’Ó2‚ÓBFW‡BÖ6VçFW"föçBÖW‡G&&öÆB&÷&FW"&÷&FW"×6ÆFRÓ ¢7G–ÆS×·°¢&6¶w&÷VæC¢—4ÆFW7Bòr6&fF&fRr¢r6VfcffbrÀ¢6öÆ÷#¢r36#ƒ&cbrÀ¢föçE6—¦S¢#À¢×Óà¢·"æGW–WGĞ¢Â÷FCà¢¢Ò—Ğ¢Â÷G#à¢Â÷F&öG“à¢Â÷F&ÆSà¢ÂöF—cà ¢ÂöF—cà¢§Ğ