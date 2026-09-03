/**
 * export-utils.ts
 * Tiện ích xuất Excel (.xlsx) và PDF (window.print) cho các trang báo cáo.
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
//  BC TỔNG
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
//  PDF (dùng window.print)
// ══════════════════════════════════════════════════════════════════════
export function printPDF() {
  window.print()
}
