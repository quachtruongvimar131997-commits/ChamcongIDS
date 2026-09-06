# Hướng dẫn triển khai - App chấm công khuôn mặt IDS

Ứng dụng gồm 2 phần:
- **Frontend**: `index.html` (chấm công), `bao-cao.html` (dashboard báo cáo cho quản lý), `config.js` (cấu hình dùng chung), `sw.js` — host miễn phí trên GitHub Pages, chạy trong trình duyệt điện thoại/máy tính.
- **Backend**: `Code.gs` — chạy trên Google Apps Script, gắn với 1 Google Sheet dùng làm cơ sở dữ liệu, và lưu ảnh bằng chứng chấm công vào Google Drive của cùng tài khoản.

---

## Phần 1 — Tạo Google Sheet + Apps Script (backend)

1. Vào [sheets.google.com](https://sheets.google.com), tạo một **Google Sheet mới**, đặt tên ví dụ `ChamCong_IDS_Data`.
2. Trong Sheet, vào menu **Extensions (Tiện ích mở rộng) → Apps Script**.
3. Xoá hết nội dung mặc định trong file `Code.gs` của trình soạn thảo, dán toàn bộ nội dung file `Code.gs` (trong repo này) vào.
4. Bấm **Save** (biểu tượng đĩa mềm).
5. Ở thanh trên cùng, chọn hàm **`khoiTaoHeThong`** trong danh sách hàm (dropdown cạnh nút Run/Debug), rồi bấm **Run**.
   - Lần đầu chạy, Google sẽ hỏi cấp quyền — chọn tài khoản của Sếp, bấm **Advanced → Go to (tên project) (unsafe)** → **Allow**. Đây là quyền cho chính script của Sếp truy cập Sheet của Sếp, hoàn toàn bình thường.
   - Sau khi chạy xong, quay lại Google Sheet sẽ thấy tự động có 7 sheet mới: `NhanVien`, `MauKhuonMat`, `ChamCong`, `DiaDiem`, `CauHinh`, `NhatKyDangKy`, `CanhBaoNhanDien`.

> **Nếu Sếp đã triển khai từ trước và giờ chỉ cập nhật `Code.gs` mới** (bản có thêm ảnh bằng chứng + chống giả mạo GPS + dashboard): dán đè `Code.gs` mới vào Apps Script Editor như cũ, **Save**, chạy lại `khoiTaoHeThong` một lần nữa (an toàn, không xoá dữ liệu cũ - hàm chỉ tự thêm các cột/sheet còn thiếu vào CUỐI, ví dụ 3 cột mới `AnhBangChung`, `CoNghiNgoGPS`, `LyDoNghiNgoGPS` trong sheet `ChamCong`), rồi vào **Deploy → Manage deployments → biểu tượng bút chì → Version: New version → Deploy** để bản Code.gs mới có hiệu lực (Script Properties như APP_TOKEN/ADMIN_PIN giữ nguyên, không cần đổi lại).
>
> **Quan trọng:** bản này có thêm tính năng lưu ảnh vào Google Drive, nên ở một trong các bước tiếp theo (chạy lại `khoiTaoHeThong`, bấm Deploy, hoặc lần chấm công đầu tiên có lưu ảnh thành công), Google có thể hiện thêm màn hình xin quyền truy cập Drive ("Xem, chỉnh sửa, tạo và xoá các file Google Drive của bạn" hoặc tương tự) - đây là quyền cần thiết để lưu ảnh bằng chứng, bấm **Allow** như các quyền trước.
6. **Đổi token & PIN bí mật** (bước rất quan trọng, đừng bỏ qua):
   - Trong Apps Script, vào **Project Settings (biểu tượng bánh răng bên trái) → Script Properties**.
   - Sẽ thấy 2 dòng `APP_TOKEN` và `ADMIN_PIN` (giá trị mặc định tạm thời). Bấm sửa, đổi sang giá trị bí mật riêng của Sếp (chuỗi khó đoán, không dùng lại giá trị cũ).
   - Ghi nhớ giá trị `APP_TOKEN` mới — sẽ cần dán vào `index.html` ở bước sau.
7. Vào **Deploy → New deployment**:
   - Chọn loại **Web app**.
   - Execute as: **Me (tài khoản của Sếp)**.
   - Who has access: **Anyone**.
   - Bấm **Deploy**, cấp quyền nếu được hỏi.
   - Copy **Web app URL** hiện ra (dạng `https://script.google.com/macros/s/.../exec`).

> Mỗi lần Sếp **sửa code trong Code.gs**, phải vào **Deploy → Manage deployments → biểu tượng bút chì → Version: New version → Deploy** thì thay đổi mới có hiệu lực (không tự động áp dụng).

---

## Phần 2 — Cập nhật `config.js`

Mở file `config.js` (dùng chung cho cả `index.html` và `bao-cao.html`):

```js
const CONFIG = {
  WEB_APP_URL: '...',
  APP_TOKEN: '...'
};
```

- Dán **Web app URL** đã copy ở bước 7 vào `WEB_APP_URL`.
- Dán **APP_TOKEN** mới (đã đổi ở bước 6) vào `APP_TOKEN` — phải khớp đúng với giá trị trong Script Properties.

Lưu file. Chỉ cần sửa 1 chỗ này, cả trang chấm công lẫn trang báo cáo đều tự dùng theo.

---

## Phần 3 — Deploy lên GitHub Pages

Nếu repo đã bật GitHub Pages từ trước, Sếp chỉ cần:

1. Commit các thay đổi (`index.html`, `bao-cao.html`, `config.js`, `sw.js`) và **push** lên nhánh đang được GitHub Pages sử dụng (thường là `main`).
2. Đợi khoảng 1-2 phút để GitHub Pages build lại, sau đó mở lại URL để kiểm tra.

Nếu cần bật GitHub Pages từ đầu: vào repo trên GitHub → **Settings → Pages** → chọn branch `main`, thư mục `/ (root)` → **Save**.

---

## Cấu trúc Google Sheet (backend tự tạo, có thể chỉnh tay khi cần)

### Sheet `NhanVien`
| MaNV | HoTen | TrangThai | NgayTao |
|---|---|---|---|
Mã nhân viên, họ tên, trạng thái (`Hoạt động` / `Đã khóa`), ngày tạo. Đổi `TrangThai` thành `Đã khóa` để vô hiệu hoá 1 nhân viên (chặn cả nhận diện lẫn chấm công) mà không cần xoá dữ liệu.

### Sheet `MauKhuonMat`
| MaNV | Descriptor(JSON) | NgayTao | Nguon |
|---|---|---|---|
Mỗi dòng là 1 mẫu khuôn mặt (128 số dạng JSON). Hệ thống tự tính **trung bình** tất cả mẫu của 1 mã NV để nhận diện — càng nhiều mẫu (qua "Bổ sung mẫu") càng chính xác.

### Sheet `ChamCong`
| ThoiGian | MaNV | HoTen | LoaiChamCong | Lat | Lng | DiaDiem | KhoangCachServer(m) | KhoangCachClient(m) | TrongVungServer | KetQua | LyDoTuChoi | AnhBangChung | CoNghiNgoGPS | LyDoNghiNgoGPS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
Nhật ký toàn bộ lượt chấm công, kể cả lượt bị từ chối (`KetQua` = `Từ chối`, có ghi `LyDoTuChoi`). Đây là sheet dùng để làm Pivot Table / Looker Studio xem báo cáo.

- `AnhBangChung`: link Google Drive tới ảnh chụp lúc chấm công thành công (chỉ tài khoản Google chủ script mới mở xem được, vì file lưu private mặc định). Ảnh nằm trong thư mục Drive `ChamCong_AnhBangChung/yyyy-MM-dd/`.
- `CoNghiNgoGPS` (TRUE/FALSE) + `LyDoNghiNgoGPS`: cờ nghi ngờ giả mạo vị trí (độ chính xác GPS bất thường, 2 lần đọc GPS trùng khớp tuyệt đối, hoặc tốc độ di chuyển phi thực tế so với lần chấm công trước). **Chỉ đánh dấu để quản lý xem lại, KHÔNG tự động từ chối chấm công** - tránh chặn nhầm làm sai lương nếu heuristic báo sai.

### Sheet `DiaDiem`
| Ten | Lat | Lng | BanKinh(m) |
|---|---|---|---|
**Thêm/sửa/xoá địa điểm chấm công trực tiếp ở đây**, không cần sửa code hay deploy lại — app tự lấy danh sách mới mỗi lần mở.

### Sheet `CauHinh`
| Key | Value | GhiChu |
|---|---|---|
- `NGUONG_NHAN_DIEN`: ngưỡng khoảng cách khuôn mặt (mặc định 0.55, càng nhỏ càng chặt).
- `GIO_VAO_CHUAN`, `PHUT_TRE_CHO_PHEP`: dùng tính "đi trễ" trong báo cáo.
- `CHO_PHEP_NHIEU_CA`: đặt `TRUE` nếu 1 ngày cho phép chấm nhiều ca Vào/Ra.

Sửa trực tiếp cột `Value` để thay đổi hành vi, không cần sửa code.

### Sheet `NhatKyDangKy`
| ThoiGian | MaNV | HoTen | HanhDong | ThietBi | KetQua |
|---|---|---|---|---|---|
Ghi lại mọi lần đăng ký mới / bổ sung mẫu, kể cả các lần **nhập sai PIN** — quản lý dùng sheet này để kiểm tra ai đã đăng ký, khi nào, từ thiết bị gì.

> **Về địa chỉ IP người đăng ký**: Google Apps Script (chạy dạng Web App "Anyone") không cung cấp IP thật của trình duyệt gọi tới cho code phía server, nên cột này không thể ghi IP chính xác. Cột `ThietBi` ghi lại `User-Agent` trình duyệt gửi lên để thay thế một phần cho việc truy vết.

### Sheet `CanhBaoNhanDien`
| ThoiGian | LyDo | KhoangCachToiThieu | ThietBi |
|---|---|---|---|
Mỗi khi ai đó quét mặt ở tab "Chấm công" nhưng **không khớp với bất kỳ nhân viên nào** trong hệ thống, dòng cảnh báo tự ghi vào đây (không cần chấm công thành công mới ghi). `KhoangCachToiThieu` là khoảng cách khuôn mặt gần nhất tìm được (càng nhỏ càng "suýt khớp" - đáng chú ý hơn). Nếu thấy nhiều dòng lặp lại liên tục cùng 1 `ThietBi` trong thời gian ngắn, đó là dấu hiệu có người đang cố dò/thử hệ thống bằng khuôn mặt lạ - nên kiểm tra camera an ninh tại thời điểm đó.

---

## Xem báo cáo - trang `bao-cao.html`

Mở `bao-cao.html` (có link "📊 Xem báo cáo quản lý" ngay trong `index.html`), nhập mã PIN quản trị để mở khoá, chọn khoảng ngày (mặc định từ đầu tháng tới hôm nay), có thể lọc theo mã nhân viên. Trang hiển thị:
- 5 thẻ thống kê nhanh: số nhân viên có chấm công, tổng giờ công, số lượt đi trễ, số lượt bị từ chối, số lượt nghi ngờ GPS giả mạo.
- Bảng tổng hợp giờ công / đi trễ / từ chối theo từng nhân viên.
- Bảng nhật ký chi tiết (tối đa 300 dòng gần nhất) kèm nút "Xem ảnh" (ảnh bằng chứng lưu trên Drive, chỉ tài khoản Google chủ script mở được) và nhãn "Nghi ngờ" nếu GPS bị đánh dấu bất thường (hover vào nhãn để xem lý do).

Ngoài dashboard này, dữ liệu thô vẫn nằm sạch trong sheet `ChamCong` nên Sếp vẫn có thể tự làm Pivot Table hoặc kết nối Looker Studio nếu muốn phân tích sâu hơn. Cũng có thể gọi thẳng API: `WEB_APP_URL?action=report&token=...&tuNgay=2026-09-01&denNgay=2026-09-30` hoặc `WEB_APP_URL?action=listChamCong&token=...&tuNgay=...&denNgay=...` để lấy JSON thô.

---

## Checklist tự kiểm tra sau khi triển khai

- [ ] Mở app trên điện thoại tài xế, thấy màn hình tải model chạy xong, không bị treo lâu.
- [ ] Tab "Chấm công": bấm "Chụp & nhận diện" vài lần liên tiếp, quan sát dòng chữ đậm hiện ra (👁️ chớp mắt / ↔️ quay đầu / ↕️ gật đầu) — phải **đổi ngẫu nhiên** giữa các lần, không lặp lại đúng 1 kiểu.
- [ ] Khi hiện yêu cầu, **giữ yên mặt hoàn toàn không làm động tác** → hệ thống phải báo "Chưa phát hiện..." tương ứng đúng động tác đang yêu cầu, không cho qua.
- [ ] Khi hiện yêu cầu "quay đầu" mà Sếp lại chỉ chớp mắt (làm sai động tác được yêu cầu) → vẫn nên bị từ chối hoặc ít nhất không nhận diện đúng chuẩn (vì kiểm tra bám theo đúng ID thử thách đã chọn).
- [ ] Quét 1 khuôn mặt lạ (không có trong hệ thống, ví dụ ảnh trên điện thoại khác) làm đúng động tác yêu cầu → app báo "Không nhận diện được nhân viên phù hợp", sau đó mở sheet `CanhBaoNhanDien` phải thấy dòng mới ghi lại lượt này.
- [ ] Chấm công thử **ở ngoài bán kính cho phép** (ví dụ tắt GPS giả lập ở xa kho) → phải bị từ chối, không ghi nhận công.
- [ ] Chấm công "VÀO" xong bấm chấm công "VÀO" lần 2 ngay lập tức (chưa "RA") → phải bị từ chối do trùng loại / do trong 60 giây.
- [ ] Gọi thẳng API bằng token đúng (lấy từ `index.html`) nhưng `maNV` không tồn tại (dùng Postman hoặc `curl`) → phải trả lỗi "Mã nhân viên không tồn tại".
- [ ] Gọi API `register` với `adminPin` sai → phải bị từ chối, và dòng thất bại xuất hiện trong sheet `NhatKyDangKy`.
- [ ] Tab "Đăng ký nhân viên": nhập sai PIN 5 lần liên tiếp → hệ thống báo khoá tạm khoảng 10 phút (chặt hơn mức cũ 10 lần/5 phút).
- [ ] Đăng ký 1 nhân viên test đủ 5 mẫu → mở lại tab "Chấm công", nhân viên test phải nhận diện được ngay (không cần load lại trang nếu vừa đăng ký, vì app tự làm mới danh sách).
- [ ] Thử "Bổ sung mẫu" cho nhân viên đã có với mã NV không tồn tại → phải báo lỗi rõ ràng.
- [ ] Sửa thử 1 dòng trong sheet `DiaDiem` (đổi bán kính hoặc thêm địa điểm mới) → mở lại app, kiểm tra hành vi chấm công thay đổi theo đúng dữ liệu mới mà không cần sửa code.
- [ ] Tắt mạng giữa chừng lúc app đang tải mô hình → phải thấy thông báo lỗi thân thiện + nút "Thử lại", không phải màn hình trắng treo mãi.
- [ ] Mở DevTools → tab Console trên trang live, kiểm tra không có dòng đỏ báo lỗi chặn bởi Content-Security-Policy (nếu có, nghĩa là cần nới thêm domain trong thẻ CSP ở đầu `index.html`).
- [ ] Chấm công thành công 1 lần → mở Google Drive của tài khoản chạy script, kiểm tra có thư mục `ChamCong_AnhBangChung/<ngày hôm nay>/` chứa 1 file ảnh mới, và cột `AnhBangChung` trong sheet `ChamCong` có link tới đúng file đó.
- [ ] Mở `bao-cao.html`, nhập đúng PIN → phải thấy đủ thẻ thống kê + 2 bảng có dữ liệu của lượt chấm công vừa test; bấm "Xem ảnh" ở dòng vừa chấm công phải mở đúng ảnh trên Drive.
- [ ] Đổi ngày hệ thống hoặc chờ >3 tiếng rồi chấm công lần 2 ở đúng 1 địa điểm → cột `CoNghiNgoGPS` phải là FALSE (không báo nghi ngờ nhầm cho hành vi bình thường).
- [ ] (Tuỳ chọn, khó test thủ công chính xác) Nếu có 2 điện thoại, thử chấm công tài khoản test ở 2 vị trí cách xa nhau trong thời gian ngắn (<3 tiếng) → cột `CoNghiNgoGPS` nên bật TRUE với lý do "Tốc độ di chuyển... phi thực tế", nhưng **chấm công vẫn phải được ghi nhận thành công** (không bị chặn), đúng thiết kế "chỉ cảnh báo, không chặn lương".
