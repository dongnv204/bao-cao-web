// ================================================================
//  HÀM doGet — BC THÁNG WEB API  (phiên bản 2: thêm Bảng 6 Thị Trường)
//  Paste TOÀN BỘ nội dung này vào cuối file Code.js trong Apps Script
//  (thay thế doGet cũ nếu đã có), sau đó Deploy → New Deployment.
// ================================================================

function doGet(e) {
  try {
    const p      = e && e.parameter ? e.parameter : {};
    const action = (p.action || "").trim();
    if (action === "bc-thang") return _handleBCThang(p);
    return _jsonOut({ ok: false, error: "action không hợp lệ. Dùng: ?action=bc-thang&month=M&year=YYYY" });
  } catch (err) {
    return _jsonOut({ ok: false, error: err.message });
  }
}

function _handleBCThang(p) {
  const month = Number(p.month);
  const year  = Number(p.year);

  if (!month || !year || isNaN(month) || isNaN(year)) {
    return _jsonOut({ ok: false, error: "Thiếu hoặc sai tham số: month, year" });
  }

  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const rows = getRowsFromAllSheets(ss, month, year);   // hàm có sẵn trong Code.js

  if (!rows || rows.length === 0) {
    return _jsonOut({
      ok: true,
      data: {
        month, year, empty: true,
        message: "Không có dữ liệu tháng " + String(month).padStart(2, "0") + "/" + year
      }
    });
  }

  // ── Tính toán ─────────────────────────────────────────────────────
  const total     = rows.length;
  const hopLeTho  = rows.filter(r => isHopLe(str(r, COL.CHECK_SDT))).length;
  const trungTho  = rows.filter(r => _SET.TRUNG.has(str(r, COL.CHECK_SDT))).length;
  const chuaCheck = rows.filter(r => {
    const cs = str(r, COL.CHECK_SDT);
    return !isHopLe(cs) && !_SET.TRUNG.has(cs);
  }).length;
  const countHL2 = rows.filter(r => str(r, COL.HL_LAN2).trim()    === "HL >2").length;
  const countTr2 = rows.filter(r => str(r, COL.TRUNG_LAN2).trim() === "Trùng >2").length;

  const hopLeRows = getHLNetRows(rows);        // hàm có sẵn
  const hlNet     = hopLeRows.length;
  const trungNet  = trungTho - countTr2;
  const tongUVNet = hlNet + trungNet;

  const cnt = _countHL(hopLeRows);             // hàm có sẵn
  const kyHDDuyetTotal = cnt.kyHD + cnt.duyet;

  // Phễu
  const coLichFunnel = cnt.coLich + cnt.dauPV + cnt.daoTao + cnt.kyHD + cnt.duyet;
  const dauPVFunnel  = cnt.dauPV  + cnt.daoTao + cnt.kyHD  + cnt.duyet;
  const daoTaoFunnel = cnt.daoTao + cnt.kyHD   + cnt.duyet;
  const kyHDFunnel   = cnt.kyHD   + cnt.duyet;

  // Tuần
  const weeks    = getWeeksOfMonth(month, year);   // hàm có sẵn
  const weeklyHL = weeks.map((wk, i) => {
    const c = hopLeRows.filter(r => {
      const d = parseDate(r[COL.NHAP - 1]);
      return d && d >= wk.start && d <= wk.end;
    }).length;
    return { week: i + 1, label: wk.label, hlNet: c };
  });

  // Trạng thái
  const ttMap = {};
  hopLeRows.forEach(r => {
    let v = str(r, COL.TRANG_THAI).trim() || "(Chưa có trạng thái)";
    ttMap[v] = (ttMap[v] || 0) + 1;
  });
  const trangThaiList = Object.entries(ttMap)
    .sort((a, b) => b[1] - a[1])
    .map(([tt, sl]) => ({ trangThai: tt, soLuong: sl }));

  // Phân loại
  const plMap = {};
  hopLeRows.forEach(r => {
    const v = str(r, COL.PHAN_LOAI).trim() || "(Chưa có phân loại)";
    plMap[v] = (plMap[v] || 0) + 1;
  });
  const phanLoaiList = Object.entries(plMap)
    .sort((a, b) => b[1] - a[1])
    .map(([pl, sl]) => ({ phanLoai: pl, soLuong: sl }));

  // ── Bảng 6 — Theo Thị Trường ──────────────────────────────────────
  // (Sử dụng COL.THI_TRUONG — cột thị trường trong Code.js)
  let byThiTruong = [];
  try {
    const tmMap = {};
    rows.forEach(r => {
      const tm = str(r, COL.THI_TRUONG).trim() || "(Không rõ)";
      if (!tmMap[tm]) tmMap[tm] = { label: tm, uvNet: 0, hlNet: 0, trungNet: 0, chuaCheck: 0 };
      const cs = str(r, COL.CHECK_SDT);
      if (isHopLe(cs)) {
        tmMap[tm].hlNet++;
        tmMap[tm].uvNet++;
      } else if (_SET.TRUNG.has(cs)) {
        tmMap[tm].trungNet++;
        tmMap[tm].uvNet++;
      } else {
        tmMap[tm].chuaCheck++;
        tmMap[tm].uvNet++;
      }
    });
    byThiTruong = Object.values(tmMap)
      .filter(t => t.uvNet > 0)
      .sort((a, b) => (b.hlNet + b.trungNet) - (a.hlNet + a.trungNet));
  } catch (e) {
    byThiTruong = [];   // nếu COL.THI_TRUONG không tồn tại thì bỏ qua
  }

  // ── Trả JSON ────────────────────────────────────────────────────────
  return _jsonOut({
    ok: true,
    data: {
      month, year,
      updatedAt : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
      empty     : false,

      // Bảng 1
      tongQuan: {
        tongUVNhap   : total,
        hopLeTho,
        trungTho,
        chuaCheck,
        hlNet,
        trungNet,
        tongUVNet,
        kyHDTotal    : kyHDDuyetTotal,
        kyHD         : cnt.kyHD,
        duyet        : cnt.duyet,
        daoTao       : cnt.daoTao,
        dauPV        : cnt.dauPV,
        coLich       : cnt.coLich,
        baoLich      : cnt.baoLich,
        chuaCo       : cnt.chuaCo,
        khac         : cnt.khac,
        hlLan2       : countHL2,
        trungLan2    : countTr2,
      },

      // Bảng 2 — Phễu
      pheu: [
        { label: "Tổng UV Net",  val: tongUVNet     },
        { label: "Hợp Lệ",      val: hlNet          },
        { label: "Chưa Có Lịch",val: cnt.chuaCo     },
        { label: "Báo Lịch Sau",val: cnt.baoLich    },
        { label: "Có Lịch Hẹn", val: coLichFunnel   },
        { label: "Đậu PV",      val: dauPVFunnel     },
        { label: "Đào Tạo",     val: daoTaoFunnel    },
        { label: "Ký HĐ",       val: kyHDFunnel      },
        { label: "Duyệt",       val: cnt.duyet       },
      ],

      // Bảng 3 — Tuần
      weeklyHL,

      // Bảng 4+5 — Trạng thái & Phân loại
      trangThaiList,
      phanLoaiList,

      // Bảng 6 — Thị trường
      byThiTruong,
    }
  });
}

// ── Helper ──────────────────────────────────────────────────────────────
function _jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
