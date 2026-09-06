# Hướng dẫn triển khai - App chấm công khuôn mặt IDS

Ứng dụng gồm 2 phần:
- **Frontend**: `index.html` + `sw.js` — host miễn phí trên GitHub Pages, chạy trong trình duyệt điện thoại/máy tính.
- **Backend**: `Code.gs` — chạy trên Google Apps Script, gắn với 1 Google Sheet dùng làm cơ sở dữ liệu.

---

## Phần 1 — Tạo Google Sheet + Apps Script (backend)

1. Vào [sheets.google.com](https://sheets.google.com), tạo một **Google Sheet mới**, đặt tên ví dụ `ChamCong_IDS_Data`.
2. Trong Sheet, vào menu **Extensions (Tiện ích mở rộng) → Apps Script**.
3. Xoá hết nội dung mặc định trong file `Code.gs` của trình soạn thảo, dán toàn bộ nội dung file `Code.gs` (trong repo này) vào.
4. Bấm **Save** (biểu tượng đĩa mềm).
5. Ở thanh trên cùng, chọn hàm **`khoiTaoHeThong`** trong danh sách hàm (dropdown cạnh nút Run/Debug), rồi bấm **Run**.
   - Lần đầu chạy, Google sẽ hỏi cấp quyền — chọn tài khoản của Sếp, bấm **Advanced → Go to (tên project) (unsafe)** → **Allow**. Đây là quyền cho chính script của Sếp truy cập Sheet của Sếp, hoàn toàn bình thường.
   - Sau khi chạy xong, quay lại Google Sheet sẽ thấy tự động có 6 sheet mới: `NhanVien`, `MauKhuonMat`, `ChamCong`, `DiaDiem`, `CauHinh`, `NhatKyDangKy`.
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

## Phần 2 — Cập nhật `index.html`

Mở file `index.html`, tìm đoạn `CONFIG` gần đầu phần `<script>`:

```js
const CONFIG = {
  WEB_APP_URL: '...',
  APP_TOKEN: '...'
};
```

- Dán **Web app URL** đã copy ở bước 7 vào `WEB_APP_URL`.
- Dán **APP_TOKEN** mới (đã đổi ở bước 6) vào `APP_TOKEN` — phải khớp đúng với giá trị trong Script Properties.

Lưu file.

---

## Phần 3 — Deploy `index.html` lên GitHub Pages

Nếu repo `cham-cong-ids` đã bật GitHub Pages từ trước (đúng như URL hiện tại `https://quachtruongvimar131997-commits.github.io/cham-cong-ids/`), Sếp chỉ cần:

1. Commit các thay đổi (`index.html`, `sw.js` mới thêm) và **push** lên nhánh đang được GitHub Pages sử dụng (thường là `main`).
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
| ThoiGian | MaNV | HoTen | LoaiChamCong | Lat | Lng | DiaDiem | KhoangCachServer(m) | KhoangCachClient(m) | TrongVungServer | KetQua | LyDoTuChoi |
|---|---|---|---|---|---|---|---|---|---|---|---|
Nhật ký toàn bộ lượt chấm công, kể cả lượt bị từ chối (`KetQua` = `Từ chối`, có ghi `LyDoTuChoi`). Đây là sheet dùng để làm Pivot Table / Looker Studio xem báo cáo.

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

---

## Xem báo cáo (action `report`)

Backend có sẵn action `report` trả JSON tổng hợp giờ công, số lần đi trễ, số lần bị từ chối theo từng nhân viên. Không có giao diện riêng trong `index.html` (theo đúng yêu cầu), nhưng Sếp có thể:
- Mở Pivot Table ngay trên sheet `ChamCong` (Insert → Pivot table), hoặc
- Kết nối sheet `ChamCong` với **Looker Studio** để có dashboard trực quan, hoặc
- Gọi trực tiếp: `WEB_APP_URL?action=report&token=...&tuNgay=2026-09-01&denNgay=2026-09-30` để lấy JSON.

---

## Checklist tự kiểm tra sau khi triển khai

- [ ] Mở app trên điện thoại tài xế, thấy màn hình tải model chạy xong, không bị treo lâu.
- [ ] Tab "Chấm công": bấm bật camera, chụp mặt **giữ yên hoàn toàn không chớp mắt/quay đầu** → hệ thống phải báo cần chớp mắt/quay đầu, không cho qua luôn.
- [ ] Chấm công thử **ở ngoài bán kính cho phép** (ví dụ tắt GPS giả lập ở xa kho) → phải bị từ chối, không ghi nhận công.
- [ ] Chấm công "VÀO" xong bấm chấm công "VÀO" lần 2 ngay lập tức (chưa "RA") → phải bị từ chối do trùng loại / do trong 60 giây.
- [ ] Gọi thẳng API bằng token đúng (lấy từ `index.html`) nhưng `maNV` không tồn tại (dùng Postman hoặc `curl`) → phải trả lỗi "Mã nhân viên không tồn tại".
- [ ] Gọi API `register` với `adminPin` sai → phải bị từ chối, và dòng thất bại xuất hiện trong sheet `NhatKyDangKy`.
- [ ] Tab "Đăng ký nhân viên": nhập sai PIN vài lần liên tiếp → sau khoảng 10 lần sai, hệ thống báo khoá tạm.
- [ ] Đăng ký 1 nhân viên test đủ 5 mẫu → mở lại tab "Chấm công", nhân viên test phải nhận diện được ngay (không cần load lại trang nếu vừa đăng ký, vì app tự làm mới danh sách).
- [ ] Thử "Bổ sung mẫu" cho nhân viên đã có với mã NV không tồn tại → phải báo lỗi rõ ràng.
- [ ] Sửa thử 1 dòng trong sheet `DiaDiem` (đổi bán kính hoặc thêm địa điểm mới) → mở lại app, kiểm tra hành vi chấm công thay đổi theo đúng dữ liệu mới mà không cần sửa code.
- [ ] Tắt mạng giữa chừng lúc app đang tải mô hình → phải thấy thông báo lỗi thân thiện + nút "Thử lại", không phải màn hình trắng treo mãi.
