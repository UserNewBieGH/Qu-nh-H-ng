# Hộ chiếu của Cô Tư

Giao diện tour ẩm thực hẻm Sài Gòn: quiz nhận hộ chiếu theo gu, lịch trình năm trạm, đặt tour, sưu tầm tem, đánh giá và tải thẻ chia sẻ.

## Chạy giao diện

Mở `index.html` trong trình duyệt hoặc phục vụ thư mục này bằng máy chủ tĩnh. Font và QR tải từ CDN; nếu không có mạng, phần tạo QR sẽ không hiện.

## Lưu đơn

Mặc định đơn được lưu trong `localStorage` của trình duyệt. Mở `?admin=1` để xem dashboard hoặc dùng liên kết **Quản lý đơn** ở chân trang. Nút xuất CSV tạo tệp UTF-8 có BOM để mở trong Google Sheets.

Để ghi vào Google Sheets và gửi email xác nhận:

1. Tạo một Google Sheet.
2. Trong dự án Apps Script, dán `apps-script.gs`; đặt Script Property `SPREADSHEET_ID` bằng ID của sheet.
3. Deploy Apps Script dưới dạng Web App, chạy với quyền tài khoản của bạn và cấp quyền truy cập cho endpoint.
4. Dán URL Web App vào `config.js` tại `window.SHEETS_WEBHOOK`.

Endpoint tạo tab `DonTour`, thêm hàng đơn và thử gửi email xác nhận tới địa chỉ được nhập khi đặt. Giao diện luôn lưu đơn cục bộ trước khi gọi webhook.

## Ghi chú dữ liệu

Mã đơn có dạng `HS-xxxx`; nguồn UTM được lưu cùng đơn. Dashboard chỉ đọc đơn trên trình duyệt hiện tại; để xem dữ liệu tập trung, dùng sheet đã cấu hình. Reviews cũng được lưu cục bộ trong trình duyệt. Hội thoại Cô Tư là mô phỏng có kịch bản, không gọi dịch vụ AI bên ngoài.
