/* ======================= CẤU HÌNH DÙNG CHUNG - CHỈNH Ở ĐÂY ======================= */
/* File này được dùng chung bởi index.html (chấm công) và bao-cao.html (dashboard),
   để sửa 1 chỗ là áp dụng cho cả 2 trang, tránh lệch dữ liệu giữa 2 nơi. */
const CONFIG = {
  // URL Web App sau khi deploy Google Apps Script (xem HUONG_DAN.md)
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbxb6MDE9Gy_7_1rKIT3G83ukJryt0Maep4xGmftwiB3AQHg0NmO331fOInC-jC6BJh_/exec',
  // Phải khớp với APP_TOKEN trong Script Properties của Code.gs.
  // GHI CHÚ BẢO MẬT: đây là code chạy trong trình duyệt, ai mở DevTools cũng đọc
  // được giá trị này - KHÔNG có cách nào giấu tuyệt đối một secret ở phía client.
  // Token chỉ có tác dụng chặn truy cập ngẫu nhiên; toàn bộ quyết định quan trọng
  // (đúng nhân viên, đúng vị trí, đúng PIN, chống trùng lặp...) đều được Code.gs
  // tự kiểm tra lại ở server, không tin dữ liệu client tự khai.
  APP_TOKEN: 'Ids5922@'
};
/* =================================================================================== */
