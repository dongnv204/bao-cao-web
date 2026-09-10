// ================================================================
//  HÀM doGet — BC TỔNG WEB API
//  Paste hàm này vào cuối file Code.js (21 Code.js) trong Apps Script,
//  sau đó Deploy → Manage Deployments → New Deployment (Web App).
//  Execute as: Me | Access: Anyone
// ================================================================

/**
 * Entry point cho web app.
 * Params:
 *   ?action=bc-tong&month=8&year=2026
 */
function doGet(e) {
  try {
    var p      = e && e.parameter ? e.parameter : {};
    var action = (p.action || '').trim();

    if (action === 'bc-tong') {
      return _handleBCTong(p);
    }

    return _jsonOut({ ok: false, error: 'action không hợp lệ. Dùng: ?action=bc-tong&month=M&year=YYYY' });

  } catch (err) {
    return _jsonOut({ ok: false, error: err.message });
  }
}

// ── Xử lý action=bc-tong ────────────────────────────────────────────
function _handleBCTong(p) {
  var month = Number(p.month);
  var year  = Number(p.year);

  if (!month || !year || isNaN(month) || isNaN(year)) {
    return _jsonOut({ ok: false, error: 'Thiếu hoặc sai tham số: month, year' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Đọc 2 nguồn vào RAM + phân luồng (tái sử dụng hàm có sẵn)
  var sourceData = readAllSources_(ss);
  var groups     = distributeGroups_(sourceData);

  // Tính thống kê theo tháng (lọc theo cột ĐPV/ĐT/HĐ)
  var data = bcReadAllGroups_(groups, month);

  // Kiểm tra có data không
  var hasData = data.dauPV.total > 0 || data.daoTao.total > 0 ||
                data.kyHD.total  > 0 || data.duyet.total  > 0;

  if (!hasData) {
    return _jsonOut({
      ok: true,
      data: {
        month: month, year: year,
        empty: true,
        message: 'Không có dữ liệu tháng ' + (month < 10 ? '0' + month : String(month)) + '/' + year,
      }
    });
  }

  // ── Helper: chuyển object {key: count} thành [{label, val}] sorted desc ──
  function toList(obj) {
    return Object.keys(obj)
      .map(function(k) { return { label: k, val: obj[k] }; })
      .sort(function(a, b) { return b.val - a.val; });
  }

  // ── Helper: chuyển byMonthNhap thành [{month, val}] sorted asc ──
  function toMonthList(obj) {
    return Object.keys(obj)
      .map(function(k) { return { month: Number(k), val: obj[k] }; })
      .sort(function(a, b) { return a.month - b.month; });
  }

  // ── Serialize từng nhóm ──
  function serializeGroup(grp) {
    return {
      total:        grp.total,
      byMonthNhap:  toMonthList(grp.byMonthNhap),
      byThiTruong:  toList(grp.byThiTruong),
      byTrangThai:  toList(grp.byTrangThai),
    };
  }

  return _jsonOut({
    ok: true,
    data: {
      month:     month,
      year:      year,
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
      empty:     false,

      // Tổng quan 4 nhóm phễu
      tongQuan: {
        duyet:  data.duyet.total,
        kyHD:   data.kyHD.total,
        daoTao: data.daoTao.total,
        dauPV:  data.dauPV.total,
      },

      // Chi tiết từng nhóm
      duyet:  serializeGroup(data.duyet),
      kyHD:   serializeGroup(data.kyHD),
      daoTao: serializeGroup(data.daoTao),
      dauPV:  serializeGroup(data.dauPV),
    }
  });
}

// ── Helper: trả JSON response ────────────────────────────────────────
function _jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
