/**
 * ===========================================================================
 * CHẤM CÔNG KHUÔN MẶT IDS - BACKEND (Google Apps Script)
 * ===========================================================================
 * File này xử lý toàn bộ các action gọi từ index.html:
 *   - listEmployees  : lấy danh sách nhân viên + descriptor khuôn mặt (GET)
 *   - listSites       : lấy danh sách địa điểm cho phép chấm công + ngưỡng (GET)
 *   - checkin         : ghi nhận chấm công VÀO/RA (POST)
 *   - register        : đăng ký nhân viên mới (POST, cần adminPin)
 *   - addSample       : bổ sung mẫu khuôn mặt cho nhân viên đã có (POST, cần adminPin)
 *   - verifyPin       : xác thực mã PIN quản trị phía server (POST)
 *   - report          : báo cáo tổng hợp giờ công / đi trễ / từ chối (GET)
 *   - canhBaoKhongKhop: ghi log khi quét mặt không khớp nhân viên nào (POST, chống dò)
 *
 * GIỚI HẠN BẢO MẬT CẦN BIẾT:
 * `APP_TOKEN` nằm trong index.html (chạy ở trình duyệt) nên về nguyên tắc
 * KHÔNG THỂ giấu tuyệt đối - bất kỳ ai mở DevTools đều đọc được. Token chỉ
 * đóng vai trò ngăn chặn truy cập ngẫu nhiên/bot quét URL, KHÔNG phải một
 * lớp xác thực người dùng thật sự. Vì vậy toàn bộ logic quan trọng (đúng
 * nhân viên, đúng vị trí, đúng PIN quản trị, chống trùng lặp...) đều được
 * VALIDATE LẠI Ở SERVER này, không tin bất kỳ dữ liệu "kết luận" nào mà
 * client tự gửi lên (ví dụ cờ trongVung, hoTen...).
 *
 * CÀI ĐẶT LẦN ĐẦU:
 * 1. Tạo Google Sheet mới, mở Extensions > Apps Script, dán file này vào.
 * 2. Chạy hàm khoiTaoHeThong() MỘT LẦN (chọn hàm trong dropdown > Run) để
 *    tự tạo các sheet cần thiết + giá trị cấu hình mặc định.
 * 3. Vào Project Settings > Script Properties, đổi APP_TOKEN và ADMIN_PIN
 *    sang giá trị bí mật riêng (không dùng giá trị mặc định).
 * 4. Deploy > New deployment > Web app, Execute as "Me", Who has access
 *    "Anyone". Copy URL dán vào WEB_APP_URL trong index.html.
 * Xem chi tiết đầy đủ trong HUONG_DAN.md.
 * ===========================================================================
 */

/* ============================= ĐIỂM VÀO (ROUTER) ============================= */

/**
 * Xử lý các action chỉ đọc dữ liệu (không thay đổi gì) - gọi bằng GET.
 * Ví dụ: WEB_APP_URL?action=listSites&token=xxx
 */
function doGet(e) {
  try {
    var action = e.parameter.action;
    kiemTraToken_(e.parameter.token);

    if (action === 'listEmployees') return jsonOut_(layDanhSachNhanVien_());
    if (action === 'listSites') return jsonOut_(layDanhSachDiaDiem_());
    if (action === 'report') return jsonOut_(taoBaoCao_(e.parameter.tuNgay, e.parameter.denNgay));

    return jsonOut_({ ok: false, error: 'Action không hợp lệ: ' + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err.message || err) });
  }
}

/**
 * Xử lý các action có ghi/thay đổi dữ liệu hoặc dữ liệu nhạy cảm - gọi bằng POST.
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    kiemTraToken_(body.token);

    switch (body.action) {
      case 'checkin':          return jsonOut_(xuLyChamCong_(body));
      case 'register':         return jsonOut_(xuLyDangKy_(body));
      case 'addSample':        return jsonOut_(xuLyThemMau_(body));
      case 'verifyPin':        return jsonOut_(xuLyXacThucPin_(body));
      case 'canhBaoKhongKhop': return jsonOut_(xuLyCanhBaoKhongKhop_(body));
      default:
        return jsonOut_({ ok: false, error: 'Action không hợp lệ: ' + body.action });
    }
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err.message || err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Kiểm tra APP_TOKEN gửi từ client khớp với giá trị bí mật lưu ở Script Properties. */
function kiemTraToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
  if (!expected || token !== expected) {
    throw new Error('Token không hợp lệ.');
  }
}

/** Kiểm tra mã PIN quản trị gửi từ client (dùng cho register/addSample) khớp Script Properties. */
function kiemTraAdminPin_(pin) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  if (!expected || String(pin) !== expected) {
    throw new Error('Mã PIN quản trị không đúng.');
  }
}

/* ============================= TIỆN ÍCH SHEET ============================= */

function laySheet_(ten) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ten);
  if (!sh) {
    throw new Error('Không tìm thấy sheet "' + ten + '". Hãy chạy hàm khoiTaoHeThong() một lần trong Apps Script Editor.');
  }
  return sh;
}

/** Đọc một giá trị cấu hình từ sheet CauHinh (cột Key/Value), trả về mặc định nếu chưa có. */
function layCauHinh_(key, macDinh) {
  var sh = laySheet_('CauHinh');
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) return data[i][1];
  }
  return macDinh;
}

/* ============================= ĐỊA ĐIỂM & GPS ============================= */

/** Trả về danh sách địa điểm cho phép chấm công + ngưỡng nhận diện khuôn mặt hiện hành. */
function layDanhSachDiaDiem_() {
  var sh = laySheet_('DiaDiem');
  var data = sh.getDataRange().getValues();
  var sites = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0]) continue;
    sites.push({ ten: String(r[0]), lat: Number(r[1]), lng: Number(r[2]), banKinh: Number(r[3]) });
  }
  var nguong = Number(layCauHinh_('NGUONG_NHAN_DIEN', 0.55));
  return { ok: true, sites: sites, nguongNhanDien: nguong };
}

function haversine_(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var toRad = function (d) { return d * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1);
  var dLng = toRad(lng2 - lng1);
  var a = Math.pow(Math.sin(dLat / 2), 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.pow(Math.sin(dLng / 2), 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timNoiGanNhat_(lat, lng, sites) {
  var best = null;
  for (var i = 0; i < sites.length; i++) {
    var s = sites[i];
    var d = haversine_(lat, lng, s.lat, s.lng);
    if (!best || d < best.khoangCach) {
      best = { ten: s.ten, lat: s.lat, lng: s.lng, banKinh: s.banKinh, khoangCach: d };
    }
  }
  return best;
}

/* ============================= NHÂN VIÊN & KHUÔN MẶT ============================= */

/**
 * Trả về danh sách nhân viên đang hoạt động, mỗi người kèm 1 descriptor khuôn mặt
 * là TRUNG BÌNH của tất cả mẫu đã thu thập (từ lúc đăng ký + các lần addSample).
 */
function layDanhSachNhanVien_() {
  var shNV = laySheet_('NhanVien');
  var dataNV = shNV.getDataRange().getValues();
  var shMau = laySheet_('MauKhuonMat');
  var dataMau = shMau.getDataRange().getValues();

  var mauTheoNV = {};
  for (var i = 1; i < dataMau.length; i++) {
    var maNV = String(dataMau[i][0]);
    if (!maNV) continue;
    var desc;
    try { desc = JSON.parse(dataMau[i][1]); } catch (e) { continue; }
    if (!mauTheoNV[maNV]) mauTheoNV[maNV] = [];
    mauTheoNV[maNV].push(desc);
  }

  var employees = [];
  for (var j = 1; j < dataNV.length; j++) {
    var row = dataNV[j];
    var maNV2 = String(row[0]);
    if (!maNV2) continue;
    if (String(row[2]).trim() === 'Đã khóa') continue;
    var mauList = mauTheoNV[maNV2];
    if (!mauList || mauList.length === 0) continue;
    employees.push({ maNV: maNV2, hoTen: String(row[1]), descriptor: trungBinhDescriptor_(mauList) });
  }
  return { ok: true, employees: employees };
}

function trungBinhDescriptor_(list) {
  var len = list[0].length;
  var avg = new Array(len).fill(0);
  list.forEach(function (d) {
    for (var i = 0; i < len; i++) avg[i] += d[i] / list.length;
  });
  return avg;
}

/* ============================= CHẤM CÔNG ============================= */

/**
 * Xử lý một lượt chấm công. KHÔNG tin bất kỳ dữ liệu "kết luận" nào từ client
 * (hoTen, trongVung, khoangCach...) - chỉ dùng lat/lng thô để tự tính lại.
 */
function xuLyChamCong_(body) {
  var maNV = String(body.maNV || '').trim();
  var loai = String(body.loaiChamCong || '').trim();
  var lat = Number(body.lat), lng = Number(body.lng);

  if (!maNV || (loai !== 'Vào' && loai !== 'Ra')) {
    return { ok: false, error: 'Dữ liệu chấm công không hợp lệ.' };
  }
  if (isNaN(lat) || isNaN(lng)) {
    return { ok: false, error: 'Không có dữ liệu GPS hợp lệ.' };
  }

  // Chặn spam: 1 mã NV chỉ được gửi 1 request checkin mỗi 60 giây (CacheService).
  var cache = CacheService.getScriptCache();
  var khoaRateLimit = 'ratelimit_checkin_' + maNV;
  if (cache.get(khoaRateLimit)) {
    return { ok: false, error: 'Bạn vừa gửi yêu cầu chấm công, vui lòng đợi khoảng 1 phút rồi thử lại.' };
  }
  cache.put(khoaRateLimit, '1', 60);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // 1) Mã NV phải tồn tại và đang hoạt động - tự tra cứu, không tin hoTen client gửi.
    var shNV = laySheet_('NhanVien');
    var dataNV = shNV.getDataRange().getValues();
    var hoTen = null, trangThai = null;
    for (var i = 1; i < dataNV.length; i++) {
      if (String(dataNV[i][0]) === maNV) { hoTen = String(dataNV[i][1]); trangThai = String(dataNV[i][2]); break; }
    }
    if (!hoTen) {
      ghiNhatKyChamCong_(maNV, body.hoTen || '', loai, lat, lng, null, null, body.khoangCach, false, 'Từ chối', 'Mã nhân viên không tồn tại trong hệ thống');
      return { ok: false, error: 'Mã nhân viên không tồn tại trong hệ thống.' };
    }
    if (trangThai === 'Đã khóa') {
      ghiNhatKyChamCong_(maNV, hoTen, loai, lat, lng, null, null, body.khoangCach, false, 'Từ chối', 'Tài khoản nhân viên đã bị khóa');
      return { ok: false, error: 'Tài khoản của bạn đã bị khóa, liên hệ quản lý.' };
    }

    // 2) Tự tính lại khoảng cách GPS - không tin cờ trongVung client gửi lên.
    var diaDiemInfo = layDanhSachDiaDiem_();
    var site = timNoiGanNhat_(lat, lng, diaDiemInfo.sites);
    if (!site) {
      ghiNhatKyChamCong_(maNV, hoTen, loai, lat, lng, null, null, body.khoangCach, false, 'Từ chối', 'Hệ thống chưa cấu hình địa điểm cho phép');
      return { ok: false, error: 'Hệ thống chưa cấu hình địa điểm chấm công.' };
    }
    var trongVung = site.khoangCach <= site.banKinh;
    if (!trongVung) {
      ghiNhatKyChamCong_(maNV, hoTen, loai, lat, lng, site.ten, site.khoangCach, body.khoangCach, false, 'Từ chối', 'Ngoài bán kính cho phép (cách ' + Math.round(site.khoangCach) + 'm)');
      return { ok: false, error: 'Bạn đang ở ngoài khu vực cho phép chấm công (cách "' + site.ten + '" khoảng ' + Math.round(site.khoangCach) + 'm).' };
    }

    // 3) Chống trùng lặp / spam dựa trên bản ghi thành công gần nhất của chính maNV này.
    var shCC = laySheet_('ChamCong');
    var banGhiCuoi = timBanGhiChamCongGanNhat_(shCC, maNV);
    var choPhepNhieuCa = String(layCauHinh_('CHO_PHEP_NHIEU_CA', 'FALSE')).toUpperCase() === 'TRUE';
    if (banGhiCuoi) {
      var lechMs = new Date().getTime() - banGhiCuoi.thoiGian.getTime();
      if (banGhiCuoi.loaiChamCong === loai && lechMs < 60000) {
        return { ok: false, error: 'Bạn vừa chấm công "' + loai + '" rồi, vui lòng đợi ít phút.' };
      }
      if (!choPhepNhieuCa && banGhiCuoi.loaiChamCong === loai) {
        var thieu = loai === 'Vào' ? 'RA' : 'VÀO';
        return { ok: false, error: 'Bạn chưa chấm công ' + thieu + ' cho lượt trước, không thể chấm "' + loai + '" liên tiếp.' };
      }
    }

    // 4) Hợp lệ - ghi nhận.
    ghiNhatKyChamCong_(maNV, hoTen, loai, lat, lng, site.ten, site.khoangCach, body.khoangCach, true, 'Thành công', '');
    return { ok: true, thoiGian: new Date().toISOString(), diaDiem: site.ten, hoTen: hoTen };
  } finally {
    lock.releaseLock();
  }
}

function timBanGhiChamCongGanNhat_(sh, maNV) {
  var data = sh.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === maNV && String(data[i][10]) === 'Thành công') {
      return { loaiChamCong: String(data[i][3]), thoiGian: new Date(data[i][0]) };
    }
  }
  return null;
}

function ghiNhatKyChamCong_(maNV, hoTen, loai, lat, lng, tenDiaDiem, khoangCachServer, khoangCachClient, trongVung, ketQua, lyDo) {
  var sh = laySheet_('ChamCong');
  sh.appendRow([
    new Date(), maNV, hoTen, loai, lat, lng, tenDiaDiem || '',
    khoangCachServer != null ? Math.round(khoangCachServer) : '',
    khoangCachClient != null ? Math.round(khoangCachClient) : '',
    trongVung, ketQua, lyDo || ''
  ]);
}

/* ============================= ĐĂNG KÝ NHÂN VIÊN ============================= */

/**
 * Đăng ký nhân viên mới. Bắt buộc adminPin đúng (xác thực server), ghi log mọi lần.
 * `descriptors` là mảng nhiều mẫu khuôn mặt (mỗi mẫu 128 số) - lưu riêng từng mẫu
 * để sau này listEmployees tự tính trung bình, và addSample có thể bổ sung thêm.
 */
function xuLyDangKy_(body) {
  kiemTraAdminPin_(body.adminPin);

  var maNV = String(body.maNV || '').trim();
  var hoTen = String(body.hoTen || '').trim();
  var descriptors = body.descriptors;

  if (!maNV || !hoTen) return { ok: false, error: 'Thiếu mã nhân viên hoặc họ tên.' };
  if (!Array.isArray(descriptors) || descriptors.length < 3) {
    return { ok: false, error: 'Cần ít nhất 3 mẫu khuôn mặt.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var shNV = laySheet_('NhanVien');
    var data = shNV.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === maNV) {
        ghiNhatKyDangKy_(maNV, hoTen, 'Đăng ký mới', body.thietBi, 'Thất bại - mã NV đã tồn tại');
        return { ok: false, error: 'Mã nhân viên "' + maNV + '" đã tồn tại. Dùng chức năng "Thêm mẫu" nếu muốn bổ sung khuôn mặt.' };
      }
    }
    shNV.appendRow([maNV, hoTen, 'Hoạt động', new Date()]);

    var shMau = laySheet_('MauKhuonMat');
    descriptors.forEach(function (d) {
      shMau.appendRow([maNV, JSON.stringify(d), new Date(), 'register']);
    });

    ghiNhatKyDangKy_(maNV, hoTen, 'Đăng ký mới', body.thietBi, 'Thành công');
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/** Bổ sung thêm mẫu khuôn mặt cho nhân viên đã tồn tại (ví dụ đổi kiểu tóc, đeo kính). */
function xuLyThemMau_(body) {
  kiemTraAdminPin_(body.adminPin);

  var maNV = String(body.maNV || '').trim();
  var descriptors = body.descriptors;
  if (!maNV) return { ok: false, error: 'Thiếu mã nhân viên.' };
  if (!Array.isArray(descriptors) || descriptors.length < 1) {
    return { ok: false, error: 'Cần ít nhất 1 mẫu khuôn mặt mới.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var shNV = laySheet_('NhanVien');
    var data = shNV.getDataRange().getValues();
    var found = false, hoTen = '';
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === maNV) { found = true; hoTen = String(data[i][1]); break; }
    }
    if (!found) {
      ghiNhatKyDangKy_(maNV, '', 'Thêm mẫu', body.thietBi, 'Thất bại - mã NV không tồn tại');
      return { ok: false, error: 'Mã nhân viên không tồn tại. Hãy đăng ký mới trước.' };
    }

    var shMau = laySheet_('MauKhuonMat');
    descriptors.forEach(function (d) {
      shMau.appendRow([maNV, JSON.stringify(d), new Date(), 'addSample']);
    });

    ghiNhatKyDangKy_(maNV, hoTen, 'Thêm mẫu', body.thietBi, 'Thành công');
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function ghiNhatKyDangKy_(maNV, hoTen, hanhDong, thietBi, ketQua) {
  var sh = laySheet_('NhatKyDangKy');
  sh.appendRow([new Date(), maNV, hoTen, hanhDong, thietBi || '', ketQua]);
}

/* ============================= XÁC THỰC PIN ============================= */

/**
 * Xác thực PIN quản trị hoàn toàn ở server (client không còn biết PIN thật).
 * Có khóa tạm sau nhiều lần sai để chống dò PIN (brute-force): 5 lần sai liên
 * tiếp sẽ khóa 10 phút (chặt hơn mức 10 lần/5 phút trước đây).
 */
function xuLyXacThucPin_(body) {
  var cache = CacheService.getScriptCache();
  var khoaDem = 'pin_fail_count';
  var soLanSai = Number(cache.get(khoaDem) || 0);
  if (soLanSai >= 5) {
    return { ok: true, valid: false, khoa: true, error: 'Nhập sai PIN quá nhiều lần, vui lòng thử lại sau khoảng 10 phút.' };
  }

  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  var dung = !!expected && String(body.pin) === expected;
  if (!dung) {
    cache.put(khoaDem, String(soLanSai + 1), 600);
  } else {
    cache.remove(khoaDem);
  }
  return { ok: true, valid: dung };
}

/* ============================= CẢNH BÁO NHẬN DIỆN BẤT THƯỜNG ============================= */

/**
 * Ghi log "mờ" (best-effort) mỗi khi trình duyệt quét được khuôn mặt nhưng KHÔNG khớp
 * với nhân viên nào trong hệ thống. Không cần PIN (đây chỉ là log bị động, không thay
 * đổi dữ liệu nghiệp vụ), nhưng có rate-limit toàn cục để tránh bị lợi dụng spam ghi
 * đầy sheet. Quản lý xem sheet CanhBaoNhanDien để phát hiện dấu hiệu ai đó đang cố dùng
 * ảnh/khuôn mặt lạ để dò thử hệ thống.
 */
function xuLyCanhBaoKhongKhop_(body) {
  var cache = CacheService.getScriptCache();
  var khoaGioiHan = 'ratelimit_canhbao_global';
  if (cache.get(khoaGioiHan)) return { ok: true };
  cache.put(khoaGioiHan, '1', 5);

  var sh = laySheet_('CanhBaoNhanDien');
  sh.appendRow([
    new Date(),
    body.lyDo || 'Không khớp khuôn mặt nhân viên nào',
    body.khoangCachToiThieu != null ? Number(body.khoangCachToiThieu) : '',
    body.thietBi || ''
  ]);
  return { ok: true };
}

/* ============================= BÁO CÁO ============================= */

/**
 * Tổng hợp báo cáo trong khoảng thời gian [tuNgay, denNgay] (yyyy-mm-dd):
 * tổng giờ công mỗi nhân viên (ghép cặp Vào/Ra theo ngày), số lần đi trễ
 * (so với GIO_VAO_CHUAN trong CauHinh), và danh sách các lượt bị từ chối.
 * Không cần dashboard đẹp - dữ liệu đủ sạch để quản lý tự làm Pivot Table
 * hoặc Looker Studio trên sheet ChamCong.
 */
function taoBaoCao_(tuNgayStr, denNgayStr) {
  var tuNgay = tuNgayStr ? new Date(tuNgayStr + 'T00:00:00') : new Date(0);
  var denNgay = denNgayStr ? new Date(denNgayStr + 'T23:59:59') : new Date();

  var shCC = laySheet_('ChamCong');
  var data = shCC.getDataRange().getValues();
  var gioVaoChuan = String(layCauHinh_('GIO_VAO_CHUAN', '08:00'));
  var phutTre = Number(layCauHinh_('PHUT_TRE_CHO_PHEP', 5));
  var gioChuanParts = gioVaoChuan.split(':');

  var theoNhanVien = {};
  var tuChoiChiTiet = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var thoiGian = new Date(row[0]);
    if (thoiGian < tuNgay || thoiGian > denNgay) continue;

    var maNV = String(row[1]), hoTen = String(row[2]), loai = String(row[3]), ketQua = String(row[10]);
    if (!theoNhanVien[maNV]) theoNhanVien[maNV] = { hoTen: hoTen, phien: {}, soLanTuChoi: 0, soLanDiTre: 0 };

    if (ketQua !== 'Thành công') {
      theoNhanVien[maNV].soLanTuChoi++;
      tuChoiChiTiet.push({ thoiGian: row[0], maNV: maNV, hoTen: hoTen, loaiChamCong: loai, lyDo: row[11] });
      continue;
    }

    var ngay = Utilities.formatDate(thoiGian, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (!theoNhanVien[maNV].phien[ngay]) theoNhanVien[maNV].phien[ngay] = {};

    if (loai === 'Vào' && !theoNhanVien[maNV].phien[ngay].vao) {
      theoNhanVien[maNV].phien[ngay].vao = thoiGian;
      var moc = new Date(thoiGian.getFullYear(), thoiGian.getMonth(), thoiGian.getDate(),
        Number(gioChuanParts[0]), Number(gioChuanParts[1]) + phutTre, 0);
      if (thoiGian > moc) theoNhanVien[maNV].soLanDiTre++;
    } else if (loai === 'Ra') {
      theoNhanVien[maNV].phien[ngay].ra = thoiGian;
    }
  }

  var tongHop = [];
  Object.keys(theoNhanVien).forEach(function (maNV) {
    var tv = theoNhanVien[maNV];
    var tongGio = 0;
    Object.keys(tv.phien).forEach(function (ngay) {
      var p = tv.phien[ngay];
      if (p.vao && p.ra && p.ra > p.vao) tongGio += (p.ra.getTime() - p.vao.getTime()) / 3600000;
    });
    tongHop.push({
      maNV: maNV, hoTen: tv.hoTen,
      tongGioCong: Math.round(tongGio * 100) / 100,
      soLanDiTre: tv.soLanDiTre,
      soLanTuChoi: tv.soLanTuChoi
    });
  });

  return { ok: true, tuNgay: tuNgayStr, denNgay: denNgayStr, tongHop: tongHop, tuChoiChiTiet: tuChoiChiTiet };
}

/* ============================= KHỞI TẠO HỆ THỐNG (CHẠY 1 LẦN) ============================= */

/**
 * Chạy hàm này MỘT LẦN từ Apps Script Editor (chọn khoiTaoHeThong trong dropdown > Run)
 * để tự tạo đủ các sheet cần thiết + dữ liệu cấu hình mặc định + token/PIN mặc định.
 * Sau khi chạy xong, nhớ vào Project Settings > Script Properties đổi APP_TOKEN
 * và ADMIN_PIN sang giá trị bí mật riêng của Sếp.
 */
function khoiTaoHeThong() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  taoSheetNeuChua_(ss, 'NhanVien', ['MaNV', 'HoTen', 'TrangThai', 'NgayTao']);
  taoSheetNeuChua_(ss, 'MauKhuonMat', ['MaNV', 'Descriptor(JSON)', 'NgayTao', 'Nguon']);
  taoSheetNeuChua_(ss, 'ChamCong', ['ThoiGian', 'MaNV', 'HoTen', 'LoaiChamCong', 'Lat', 'Lng', 'DiaDiem', 'KhoangCachServer(m)', 'KhoangCachClient(m)', 'TrongVungServer', 'KetQua', 'LyDoTuChoi']);
  taoSheetNeuChua_(ss, 'DiaDiem', ['Ten', 'Lat', 'Lng', 'BanKinh(m)']);
  taoSheetNeuChua_(ss, 'CauHinh', ['Key', 'Value', 'GhiChu']);
  taoSheetNeuChua_(ss, 'NhatKyDangKy', ['ThoiGian', 'MaNV', 'HoTen', 'HanhDong', 'ThietBi', 'KetQua']);
  taoSheetNeuChua_(ss, 'CanhBaoNhanDien', ['ThoiGian', 'LyDo', 'KhoangCachToiThieu', 'ThietBi']);

  var shDiaDiem = ss.getSheetByName('DiaDiem');
  if (shDiaDiem.getLastRow() < 2) {
    shDiaDiem.appendRow(['Kho/Bãi xe CT', 10.883420, 106.655232, 200]);
  }

  var shCauHinh = ss.getSheetByName('CauHinh');
  if (shCauHinh.getLastRow() < 2) {
    shCauHinh.appendRow(['NGUONG_NHAN_DIEN', 0.55, 'Ngưỡng khoảng cách khuôn mặt để coi là đúng người, càng nhỏ càng chặt']);
    shCauHinh.appendRow(['GIO_VAO_CHUAN', '08:00', 'Giờ vào ca chuẩn, dùng để tính đi trễ trong báo cáo']);
    shCauHinh.appendRow(['GIO_RA_CHUAN', '17:00', 'Giờ ra ca chuẩn']);
    shCauHinh.appendRow(['PHUT_TRE_CHO_PHEP', 5, 'Số phút trễ được châm chước trước khi tính là đi trễ']);
    shCauHinh.appendRow(['CHO_PHEP_NHIEU_CA', 'FALSE', 'TRUE nếu cho phép chấm công nhiều ca Vào/Ra trong 1 ngày']);
  }

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('APP_TOKEN')) props.setProperty('APP_TOKEN', 'Idsids@@');
  if (!props.getProperty('ADMIN_PIN')) props.setProperty('ADMIN_PIN', '1997');

  Logger.log('Đã khởi tạo xong. QUAN TRỌNG: vào Project Settings > Script Properties để đổi APP_TOKEN và ADMIN_PIN sang giá trị bí mật riêng, sau đó cập nhật APP_TOKEN mới vào index.html.');
}

function taoSheetNeuChua_(ss, ten, headers) {
  var sh = ss.getSheetByName(ten);
  if (!sh) {
    sh = ss.insertSheet(ten);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}
