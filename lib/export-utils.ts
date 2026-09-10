/**
 * export-utils.ts
 * Tiện ích xuất Excel (.xlsx) và PDF (window.print / popup HTML) cho các trang báo cáo.
 */
import * as XLSX from 'xlsx'

// ── Generic helper ────────────────────────────────────────────────────
function saveWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
}

function sheet(data: (string | number | null)[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(data)
}

// ══════════════════════════════════════════════════════════════════════
//  BC THÁNG
// ══════════════════════════════════════════════════════════════════════
export function exportBCThangExcel(data: any, tabLabel: string) {
  const wb = XLSX.utils.book_new()
  const tq = data.tongQuan

  // Sheet 1 — Tổng quan
  if (tq) {
    const rows: (string | number | null)[][] = [
      [`Báo Cáo Tháng ${data.month}/${data.year} — Tổng quan`],
      [],
      ['Chỉ số', 'Giá trị'],
      ['UV Nhập (tháng)', tq.tongUVNhap ?? 0],
      ['Hợp lệ thô', tq.hopLeTho ?? 0],
      ['Trung thô', tq.trungTho ?? 0],
      ['UV Net', tq.tongUVNet ?? 0],
      ['Tỷ lệ HL Net (%)', tq.hlNet ?? 0],
      ['Trung Net', tq.trungNet ?? 0],
      ['Ký HĐ', tq.kyHD ?? 0],
      ['Duyệt', tq.duyet ?? 0],
      ['Đào Tạo', tq.daoTao ?? 0],
      ['Đậu PV', tq.dauPV ?? 0],
    ]
    XLSX.utils.book_append_sheet(wb, sheet(rows), 'Tổng quan')
  }

  // Sheet 2 — Phễu
  if (data.pheu?.length) {
    const rows: (string | number)[][] = [
      ['Phễu tuyển dụng'],
      [],
      ['Giai đoạn', 'Số lượng'],
      ...data.pheu.map((r: any) => [r.label, r.val]),
    ]
    XLSX.utils.book_append_sheet(wb, sheet(rows), 'Phễu')
  }

  // Sheet 3 — Thị trường
  if (data.byThiTruong?.length) {
    const rows: (string | number | null)[][] = [
      ['Theo thị trường'],
      [],
      ['Khu vực', 'UV Net', 'HL Net', 'Trung Net', 'Chưa check'],
      ...data.byThiTruong.map((r: any) => [r.label, r.uvNet, r.hlNet, r.trungNet, r.chuaCheck]),
    ]
    XLSX.utils.book_append_sheet(wb, sheet(rows), 'Thị trường')
  }

  // Sheet 4 — Trạng thái
  if (data.trangThaiList?.length) {
    const rows: (string | number)[][] = [
      ['Theo trạng thái'],
      [],
      ['Trạng thái', 'Số lượng'],
      ...data.trangThaiList.map((r: any) => [r.trangThai, r.soLuong]),
    ]
    XLSX.utils.book_append_sheet(wb, sheet(rows), 'Trạng thái')
  }

  saveWorkbook(wb, `BC_Thang_${tabLabel.replace('/', '-')}.xlsx`)
}

// ══════════════════════════════════════════════════════════════════════
//  BC TỔNG — Excel
// ══════════════════════════════════════════════════════════════════════
export function exportBCTongExcel(data: any, tabLabel: string) {
  const wb = XLSX.utils.book_new()
  const tq = data.tongQuan

  // Sheet 1 — Tổng quan 4 nhóm
  if (tq) {
    const rows: (string | number)[][] = [
      [`Báo Cáo Tổng Tháng ${data.month}/${data.year}`],
      [],
      ['Nhóm', 'Số lượng'],
      ['Duyệt', tq.duyet ?? 0],
      ['Ký HĐ', tq.kyHD ?? 0],
      ['Đào Tạo', tq.daoTao ?? 0],
      ['Đậu PV', tq.dauPV ?? 0],
    ]
    XLSX.utils.book_append_sheet(wb, sheet(rows), 'Tổng quan')
  }

  // Sheet mỗi nhóm
  const groups = [
    { key: 'duyet', label: 'Duyệt' },
    { key: 'kyHD', label: 'Ký HĐ' },
    { key: 'daoTao', label: 'Đào Tạo' },
    { key: 'dauPV', label: 'Đậu PV' },
  ]
  for (const g of groups) {
    const grp = data[g.key]
    if (!grp || grp.total === 0) continue
    const rows: (string | number)[][] = [
      [`${g.label} — Tháng ${data.month}/${data.year}`],
      ['Tổng', grp.total],
      [],
      ['Trạng thái', 'Số lượng'],
      ...grp.byTrangThai.map((r: any) => [r.label, r.val]),
      [],
      ['Khu vực', 'Số lượng'],
      ...grp.byThiTruong.map((r: any) => [r.label, r.val]),
    ]
    XLSX.utils.book_append_sheet(wb, sheet(rows), g.label)
  }

  saveWorkbook(wb, `BC_Tong_${tabLabel.replace('/', '-')}.xlsx`)
}

// ══════════════════════════════════════════════════════════════════════
//  BC TỔNG — PDF (popup HTML đẹp)
// ══════════════════════════════════════════════════════════════════════
export function exportBCTongPDF(data: any) {
  const tq = data?.tongQuan
  if (!tq) return

  const month = data.month
  const year  = data.year
  const now   = new Date().toLocaleString('vi-VN')

  // ── Config nhóm ─────────────────────────────────────────────────────
  const GROUPS = [
    { key: 'duyet',  label: 'Duyệt',   color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    { key: 'kyHD',   label: 'Ký HĐ',   color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
    { key: 'daoTao', label: 'Đào Tạo', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
    { key: 'dauPV',  label: 'Đậu PV',  color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
  ]

  // ── Render một group card ────────────────────────────────────────────
  function renderGroupCard(g: typeof GROUPS[0]): string {
    const grp = data[g.key]
    if (!grp || grp.total === 0) return ''

    // Progress bars trạng thái
    const ttRows = (grp.byTrangThai ?? []).slice(0, 8).map((r: any) => {
      const pct = Math.round((r.val / grp.total) * 100)
      return `
        <div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
            <span style="color:#475569;max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.label}</span>
            <span style="font-weight:600;color:#1e293b">${r.val}</span>
          </div>
          <div style="background:#e2e8f0;border-radius:4px;height:5px">
            <div style="background:${g.color};width:${pct}%;height:5px;border-radius:4px"></div>
          </div>
        </div>`
    }).join('')

    // Badges khu vực
    const kvBadges = (grp.byThiTruong ?? []).slice(0, 6).map((r: any) =>
      `<span style="display:inline-block;background:white;border:1px solid ${g.border};border-radius:8px;padding:3px 8px;font-size:11px;color:#334155;margin:2px">
        ${r.label} <strong style="color:${g.color}">${r.val}</strong>
      </span>`
    ).join('')

    return `
      <div class="group-card" style="background:${g.bg};border:1px solid ${g.border};border-radius:12px;padding:16px;break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-size:13px;font-weight:700;color:${g.color};text-transform:uppercase;letter-spacing:0.05em">${g.label}</span>
          <span style="font-size:22px;font-weight:800;color:${g.color}">${grp.total}</span>
        </div>
        ${ttRows ? `<p style="font-size:10px;color:#94a3b8;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em">Trạng thái</p>${ttRows}` : ''}
        ${kvBadges ? `<p style="font-size:10px;color:#94a3b8;margin:8px 0 4px;text-transform:uppercase;letter-spacing:0.05em">Khu vực</p><div>${kvBadges}</div>` : ''}
      </div>`
  }

  // ── Month table ──────────────────────────────────────────────────────
  const monthSet = new Set<number>()
  GROUPS.forEach(g => {
    const grp = data[g.key]
    grp?.byMonthNhap?.forEach((r: any) => monthSet.add(r.month))
  })
  const months = Array.from(monthSet).sort((a, b) => a - b)

  function getVal(grp: any, m: number): number {
    return grp?.byMonthNhap?.find((r: any) => r.month === m)?.val ?? 0
  }

  const tableRows = months.map(m => `
    <tr>
      <td style="padding:7px 10px;color:#475569;border-bottom:1px solid #f1f5f9">Tháng ${m}</td>
      ${GROUPS.map(g => {
        const v = getVal(data[g.key], m)
        return `<td style="padding:7px 10px;text-align:right;font-weight:600;color:${v > 0 ? g.color : '#cbd5e1'};border-bottom:1px solid #f1f5f9">${v > 0 ? v : '—'}</td>`
      }).join('')}
    </tr>`).join('')

  // ── HTML page ────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Báo Cáo Tổng T${month}/${year}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: #f8fafc;
    color: #1e293b;
    padding: 32px;
    font-size: 13px;
    line-height: 1.5;
  }
  .page { max-width: 900px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,.08) }

  /* Header */
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; padding-bottom:20px; border-bottom:2px solid #e2e8f0 }
  .header-left h1 { font-size:22px; font-weight:800; color:#0f172a; margin-bottom:4px }
  .header-left p  { font-size:12px; color:#94a3b8 }
  .header-right   { text-align:right }
  .header-right .badge { display:inline-block; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:8px; padding:4px 12px; font-size:12px; font-weight:600 }
  .header-right .time  { font-size:11px; color:#94a3b8; margin-top:6px }

  /* Metric cards */
  .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:28px }
  .metric-card { border-radius:12px; padding:16px 14px; text-align:center }
  .metric-card .label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px }
  .metric-card .value { font-size:28px; font-weight:800 }

  /* Section */
  .section { margin-bottom:24px }
  .section-title { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:#94a3b8; margin-bottom:12px; display:flex; align-items:center; gap:8px }
  .section-title::after { content:''; flex:1; height:1px; background:#e2e8f0 }

  /* Group cards grid */
  .group-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px }

  /* Month table */
  table { width:100%; border-collapse:collapse; font-size:12px }
  th { padding:8px 10px; text-align:left; font-weight:600; color:#64748b; border-bottom:2px solid #e2e8f0; font-size:11px; text-transform:uppercase; letter-spacing:.05em }
  th:not(:first-child) { text-align:right }

  /* Print button */
  .print-btn {
    display: block;
    margin: 24px auto 0;
    padding: 10px 28px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .print-btn:hover { background:#1d4ed8 }

  @media print {
    body { background:white; padding:0 }
    .page { box-shadow:none; border-radius:0; padding:24px }
    .print-btn { display:none !important }
    @page { margin: 15mm; size: A4 }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <h1>Báo Cáo Tổng Tháng ${String(month).padStart(2,'0')}/${year}</h1>
      <p>Thống kê UV đậu PV / đào tạo / ký HĐ / duyệt trong tháng · ${data.updatedAt ?? 'vừa cập nhật'}</p>
    </div>
    <div class="header-right">
      <div class="badge">T${String(month).padStart(2,'0')}/${year}</div>
      <div class="time">Xuất lúc ${now}</div>
    </div>
  </div>

  <!-- 4 Metric Cards -->
  <div class="metrics">
    <div class="metric-card" style="background:#eff6ff;border:1px solid #bfdbfe">
      <div class="label" style="color:#2563eb">Duyệt</div>
      <div class="value" style="color:#2563eb">${tq.duyet ?? 0}</div>
    </div>
    <div class="metric-card" style="background:#fff7ed;border:1px solid #fed7aa">
      <div class="label" style="color:#ea580c">Ký HĐ</div>
      <div class="value" style="color:#ea580c">${tq.kyHD ?? 0}</div>
    </div>
    <div class="metric-card" style="background:#ecfdf5;border:1px solid #a7f3d0">
      <div class="label" style="color:#059669">Đào Tạo</div>
      <div class="value" style="color:#059669">${tq.daoTao ?? 0}</div>
    </div>
    <div class="metric-card" style="background:#eef2ff;border:1px solid #c7d2fe">
      <div class="label" style="color:#4f46e5">Đậu PV</div>
      <div class="value" style="color:#4f46e5">${tq.dauPV ?? 0}</div>
    </div>
  </div>

  <!-- Chi tiết từng nhóm -->
  <div class="section">
    <div class="section-title">Chi tiết theo nhóm</div>
    <div class="group-grid">
      ${GROUPS.map(g => renderGroupCard(g)).join('')}
    </div>
  </div>

  ${months.length > 0 ? `
  <!-- Bảng tháng nhập UV -->
  <div class="section">
    <div class="section-title">Tháng nhập UV theo nhóm phễu</div>
    <table>
      <thead>
        <tr>
          <th>Tháng nhập</th>
          ${GROUPS.map(g => `<th style="color:${g.color}">${g.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>` : ''}

  <button class="print-btn" onclick="window.print()">🖨️ In / Lưu PDF</button>
</div>
</body>
</html>`

  // Mở popup và ghi nội dung
  const popup = window.open('', '_blank', 'width=980,height=800,scrollbars=yes')
  if (!popup) {
    alert('Trình duyệt đã chặn popup. Vui lòng cho phép popup để xuất PDF.')
    return
  }
  popup.document.write(html)
  popup.document.close()
}

// ══════════════════════════════════════════════════════════════════════
//  BC NGÀY
// ══════════════════════════════════════════════════════════════════════
export function exportBCNgayExcel(data: any, tabLabel: string) {
  const wb = XLSX.utils.book_new()
  const b1 = data.bang1
  const b2 = data.bang2

  // Sheet 1 — Tổng quan ngày
  if (b1) {
    const rows: (string | number | null)[][] = [
      [`Báo Cáo Ngày ${tabLabel}`],
      [],
      ['Chỉ số', 'Ngày', 'Tháng'],
      ['Form Nhập', b1.formNhapNgay ?? 0, b1.formNhapThang ?? 0],
      ['UV Net', b1.uvNetNgay ?? 0, b1.uvNetThang ?? 0],
      ['HL Net', b1.hlNetNgay ?? 0, b1.hlNetThang ?? 0],
      ['Trung Net', b1.trungNetNgay ?? 0, b1.trungNetThang ?? 0],
      ['Ký HĐ', b1.kyHDThang ?? 0, '—'],
      ['Duyệt', b1.duyetThang ?? 0, '—'],
      ['Đào Tạo', b1.daoTaoThang ?? 0, '—'],
    ]
    XLSX.utils.book_append_sheet(wb, sheet(rows), 'Tổng quan')
  }

  // Sheet 2 — Bảng 3 (chi tiết theo ngày)
  if (data.bang3?.length) {
    const rows: (string | number | null)[][] = [
      ['Bảng 3 — Chi tiết theo ngày'],
      [],
      ['Ngày', 'Thứ', 'Form Nhập', 'UV Lọc', 'UV Net', 'HL Net', 'Trung Net', 'Chưa Check'],
      ...data.bang3
        .filter((r: any) => !r.isTotal)
        .map((r: any) => [r.ngay, r.thu, r.formNhap, r.uvLoc, r.uvNet, r.hlNet, r.trungNet, r.chuaCheck]),
    ]
    XLSX.utils.book_append_sheet(wb, sheet(rows), 'Chi tiết ngày')
  }

  // Sheet 3 — Nguồn
  if (b2?.nguon?.length) {
    const rows: (string | number | null)[][] = [
      ['Theo nguồn'],
      [],
      ['Nguồn', 'UV Net', 'HL Net', 'Trung Net', 'Tỷ lệ HL%'],
      ...b2.nguon.map((r: any) => [r.ten, r.uvNet, r.hlNet, r.trungNet, r.tyLeHl ?? 0]),
    ]
    XLSX.utils.book_append_sheet(wb, sheet(rows), 'Nguồn')
  }

  saveWorkbook(wb, `BC_Ngay_${tabLabel.replace(/\//g, '-')}.xlsx`)
}

// ══════════════════════════════════════════════════════════════════════
//  PDF (dùng window.print — generic fallback)
// ══════════════════════════════════════════════════════════════════════
export function printPDF() {
  window.print()
}
