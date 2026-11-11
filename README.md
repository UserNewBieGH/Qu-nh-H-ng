# Cô Tư Saigon Street Food Alley Odyssey
> **Tour Ẩm Thực Hẻm Sâu Gia Truyền & Trợ Lý Ảo AI Cô Tư Đồng Hành**  
> Dự án được phát triển dựa trên nguyên mẫu thiết kế Google Stitch (Resource: `projects/3645839550228469448`).

---

## 1. Giới Thiệu Tổng Quan
**Cô Tư Hẻm Explorer** là ứng dụng web đặt tour ẩm thực đường phố cao cấp luồn sâu vào các con hẻm cổ kính tại Sài Gòn (Đa Kao, Phú Nhuận, Chợ Lớn Quận 5, Tôn Đản Quận 4, Sư Vạn Hạnh Quận 10).

Ứng dụng kết hợp giữa tinh hoa ẩm thực truyền thống hơn 30 năm tuổi với công nghệ số hiện đại:
- **Hành trình 6 giai đoạn (6-Node Journey)**: *See → Search → Compare → Book → Experience → Review*.
- **Trợ lý AI Cô Tư**: Mô phỏng giọng điệu Nam Bộ ấm áp, thấu hiểu khẩu vị, tư vấn dị ứng thực phẩm và tự động điền đơn đặt tour.
- **Audio Tour tại hiện trường**: Phát thuyết minh văn hóa, tiếng chảo gang, tiếng rao hẻm xưa.
- **Trang Quản trị Đơn Tour (Admin Portal)**: Theo dõi đơn hàng theo thời gian thực, cập nhật trạng thái và xuất file CSV chuẩn tiếng Việt (UTF-8 BOM) cho Excel/Google Sheets.

---

## 2. Các Lỗi Giao Diện & Nút Bấm Đã Được Sửa Chữa (Bug Fixes)
Trong bản thảo thiết kế ban đầu và phiên bản thử nghiệm, tồn tại một số vấn đề về bố cục nút bấm, xung đột hiển thị và logic nghiệp vụ. Dự án đã rà soát và khắc phục triệt để:

1. **Khắc phục xung đột thanh CTA dính đáy (Sticky Bottom Bar Clashes)**:
   - *Lỗi cũ*: Tồn tại song song 2 thanh dính đáy (`fixed bottom-0` toàn màn hình và `aside fixed bottom-4` nổi), đè chồng lên nhau làm che khuất chân trang và nội dung các thẻ.
   - *Giải pháp*: Tích hợp thành **1 thanh duy nhất** (`.bottom-sticky-bar`) nổi nhẹ nhàng ở đáy với nền kính mờ (`backdrop-blur-xl`), có đệm lót an toàn cho nội dung chính (`pb-32 sm:pb-36`).
2. **Khắc phục vị trí nút mở Chat AI Cô Tư (Floating FAB Collision)**:
   - *Lỗi cũ*: Nút tròn mở chat nằm ở `bottom-24` bị che khuất hoặc đè lên nút "Đặt tour" khi xem trên màn hình điện thoại.
   - *Giải pháp*: Neo nút tại `.ai-fab-container` với khoảng cách an toàn `bottom: 5.5rem` trên mobile và `bottom: 6rem` trên desktop (`env(safe-area-inset-bottom)`), z-index cao hơn thanh đáy nhưng thấp hơn các hộp thoại modal.
3. **Sửa lỗi đè tiêu đề khi cuộn trang (Scroll Anchor Clipping)**:
   - *Lỗi cũ*: Khi nhấp menu hành trình để cuộn xuống các mục, tiêu đề chặng bị Header cố định và Thanh tiến trình đè lên che khuất.
   - *Giải pháp*: Thêm `html { scroll-padding-top: 8.5rem; }` cùng lớp đệm `h-18 / pt-18 / top-18` đồng bộ để nội dung dừng lại vừa vặn bên dưới thanh điều hướng.
4. **Bổ sung định nghĩa khoảng cách Spacing `18` cho Tailwind**:
   - *Lỗi cũ*: Các lớp `h-18`, `pt-18`, `top-18` không thuộc thang đo mặc định của Tailwind CDN dẫn đến Header không có chiều cao cố định và Tracker không bám dính chuẩn.
   - *Giải pháp*: Mở rộng `tailwind.config.theme.extend.spacing['18'] = '4.5rem'` và bổ sung fallback CSS trong `style.css`.
5. **Sửa lỗi định dạng ngày xác nhận Zalo ("ngày Hôm / ngày Ngày")**:
   - *Lỗi cũ*: `order.date.split(' ')[0]` bóc tách ngày từ chuỗi "Hôm nay 16:30" khiến tin nhắn Zalo hiển thị cụt lủn là "ngày Hôm" hoặc "ngày Ngày".
   - *Giải pháp*: Lưu trữ và sử dụng trường `order.tourDate` định dạng chuẩn ISO/Việt Nam để tin nhắn Zalo hiển thị chính xác ngày khởi hành.
6. **Chuẩn hóa xác thực số điện thoại & Form đặt tour**:
   - *Lỗi cũ*: Không kiểm tra đầu số viễn thông Việt Nam, cho phép số âm hoặc đặt ngày trong quá khứ.
   - *Giải pháp*: Áp dụng biểu thức chính quy chuẩn viễn thông Việt Nam (`/^(?:0|\+84)(?:3|5|7|8|9)\d{8}$/`), chặn ngày quá khứ bằng `dateInput.min = today`, chuyển đổi toàn bộ `alert()` chặn trình duyệt sang hệ thống Toast thông báo mượt mà.
7. **Sửa lỗi tính thời lượng Audio Tour & Tích hợp Web Audio API**:
   - *Lỗi cũ*: Vòng lặp phát âm thanh bị cố định cứng ở 165 giây cho mọi trạm dù các trạm có thời lượng khác nhau (ví dụ Trạm 2 là 3:10 = 190 giây).
   - *Giải pháp*: Hàm `parseDurationToSeconds(trackTime)` tự động trích xuất giây từ nhãn thời gian, kết hợp Web Audio API Synthesizer tạo tiếng chuông đón tour và tiếng xào chảo rộn ràng sống động.
8. **Đồng bộ bộ lọc Review khách lẻ & Thẻ bản đồ hẻm**:
   - *Lỗi cũ*: Bộ lọc đánh giá có nút "Khách lẻ" nhưng không có thẻ khớp trong HTML; bài đánh giá mới gửi thiếu lớp `review-item-card` nên không lọc được; ghim bản đồ không phản hồi khi lọc danh sách quán.
   - *Giải pháp*: Bổ sung review khách lẻ, gán thuộc tính `data-cat` động cho review mới, đồng bộ độ mờ (`dimmed`) cho các ghim bản đồ khi không khớp bộ lọc và bổ sung nút hoàn tác bộ lọc `#btn-reset-stops-filter`.
9. **Chuẩn hóa thống kê Admin Portal & Lọc đơn hủy**:
   - *Lỗi cũ*: Tổng doanh thu và số lượng khách tính cả các đơn hàng đã bị hủy (`Đã hủy`).
   - *Giải pháp*: Loại trừ các đơn hủy khỏi KPI tính toán, tự động vẽ lại mã QR thanh toán trên Canvas khi mở modal.

---

## 3. Cấu Trúc Mã Nguồn
```
Co_tu/
├── index.html          # Trang chủ Khách Hàng (6 chặng hành trình, đặt tour & mã QR giới thiệu)
├── admin-login.html    # Cổng đăng nhập riêng cho Quản Trị Viên (RBAC guard)
├── admin.html          # Dashboard Quản Trị độc lập toàn màn hình (6 phân hệ quản trị)
├── css/
│   └── style.css       # Biến màu Design Tokens, hiệu ứng âm thanh Waveform, bubbles
├── js/
│   ├── data.js         # Dữ liệu 5 trạm hẻm, bảng giá, voucher, review, tri thức AI
│   ├── auth.js         # Xác thực & phân quyền tách biệt Khách Hàng vs Quản Trị Viên
│   ├── booking.js      # Thuật toán tính tiền, đặt tour trực tiếp & đặt tour trước
│   ├── ai-cotu.js      # Trợ lý ảo AI Cô Tư NLP intent, audio player, ambience
│   ├── qr-generator.js # Bộ sinh mã QR chuẩn ISO/IEC 18004 (GF256 Reed-Solomon, ECC Level H)
│   ├── admin.js        # Logic quản trị đơn tour, khách hàng, nhật ký & xuất Excel 4 sheet
│   └── app.js          # Điều khiển Scrollspy, bộ lọc ma trận món ăn, review feed & QR giới thiệu
└── README.md           # Tài liệu hướng dẫn sử dụng & kiến trúc
```

---

## 4. Thuật Toán & Luồng Nghiệp Vụ Cốt Lõi

### 4.1. Công Thức Tính Tiền Tour
$$\text{Tổng Chưa Giảm} = (N_{\text{người lớn}} \times 590.000₫) + (N_{\text{trẻ em}} \times 350.000₫)$$
- Nếu áp dụng mã giảm giá:
  - `TIKTOK50`: Giảm trực tiếp 50.000₫
  - `HEMSAIGON`: Giảm 10% trên tổng giá trị
  - `COTU2026`: Giảm 100.000₫ cho đoàn từ 2 khách trở lên
- Tự động hiển thị cảnh báo chia tốp hướng dẫn viên nếu đoàn vượt quá 8 khách để tránh kẹt hẻm nhỏ.

### 4.2. Bộ Lọc Ma Trận Đa Tiêu Chí (Multi-Criteria Alley Filter)
Cho phép người dùng kết hợp đồng thời:
1. Từ khóa văn bản (tên quán, nguyên liệu, quận).
2. Tầng vị giác: Thanh tao, Đậm đà, Cay nồng, Ngọt dịu.
3. Chế độ ăn uống: Ăn chay được, Không nội tạng.

### 4.3. Mô Hình Phân Tích Ý Định AI (Culinary NLP Intent Parsing)
Trợ lý AI Cô Tư phân tích ngữ cảnh câu hỏi theo các nhóm chủ đề:
- Vệ sinh thực phẩm (`vệ sinh`, `đau bụng`, `an toàn`)
- Khẩu vị cay (`cay`, `ít cay`, `sa tế`)
- Ăn kiêng (`chay`, `dị ứng tôm`, `không ăn bò`)
- Hướng dẫn viên tiếng Anh, chính sách hủy tour, vé trẻ em, ưu đãi voucher
- Tự động điền đơn: Bóc tách tên và số lượng khách từ tin nhắn để tự động điền vào Form đặt chỗ phía dưới trang.

---

## 5. Hướng Dẫn Chạy & Kiểm Thử
Trang web được thiết kế hoàn toàn tĩnh, độc lập và tương thích với mọi trình duyệt hiện đại (Chrome, Edge, Safari, Firefox).

### Mở trực tiếp:
Mở file `index.html` trong trình duyệt bằng cách nhấn đúp chuột hoặc dùng lệnh:
```powershell
Start-Process "C:\Users\HP\.gemini\antigravity\scratch\co-tu-tour-booking\index.html"
```

### Chạy qua Local Web Server:
```bash
npx serve . -l 3000
```

### Kiểm tra cú pháp & kiểm thử tự động:
```bash
# Chạy toàn bộ 3 bộ test tự động
npm test

# Hoặc chạy từng bộ kiểm thử:
node test_runner.js
node test_functional.js
node test_deep_verification.js
```

---

## 8. Hệ Thống Phân Quyền & Xuất Báo Cáo Excel Nâng Cao (Phiên Bản Mới)

### 8.1. Phân quyền Người dùng & Quản trị viên (RBAC Tách Biệt)
- **Giao diện Khách Hàng (`index.html`)**:
  - Xác thực dành riêng cho Khách Hàng (đăng nhập/đăng ký, không hiển thị nút đăng nhập nhanh Admin hay nút truy cập quản trị ở Footer).
  - Cổng Khách Hàng (`Customer Portal`): Xem đơn tour cá nhân, gửi & theo dõi **Đặt Tour Trước (Pre-booking)**, lưu hồ sơ & khẩu vị mặc định tự động đồng bộ, sử dụng kho voucher (`COTU2026`, `HEMSAIGON`, `TIKTOK50`).
  - **Mã QR Giới Thiệu Bạn Bè**: Sinh mã QR chuẩn ISO/IEC 18004 (ECC Level H) trên HTML5 Canvas dẫn thẳng vào website Cô Tư, hỗ trợ tải ảnh PNG và sao chép liên kết chia sẻ.
- **Hệ Thống Quản Trị Độc Lập (`admin-login.html` & `admin.html`)**:
  - Bảo vệ RBAC đa lớp: Truy cập `admin.html` khi chưa đăng nhập hoặc đang dùng tài khoản Khách Hàng sẽ lập tức bị chuyển hướng về `admin-login.html`; đăng nhập vào `admin-login.html` bằng tài khoản Khách Hàng sẽ bị từ chối.
  - Bảng điều hành toàn màn hình: Quản lý Đơn Tour Trực Tiếp, Duyệt Đặt Tour Trước, Danh Sách Hội Viên Khách Hàng (lọc theo hạng), Nhật Ký Hoạt Động Hệ Thống, Trung Tâm Xuất Báo Cáo Excel 4 Trang Tính, và Tạo Mã QR Tiếp Thị Tại Bàn.

### 8.2. Trung Tâm Xuất Báo Cáo Excel Trực Quan (Advanced Visual Excel Export)
- **Tệp Excel chuẩn XML Spreadsheet (`.xls`)**:
  - Tương thích 100% với Microsoft Excel, WPS Office, Apple Numbers, Google Sheets.
  - Tự động áp dụng bảng màu nhận diện thương hiệu Cô Tư (`#835500`, `#f5a623`, `#006c49`), tiêu đề banner trang trọng, đường viền ô kẻ lưới, zebra striping và độ rộng cột tối ưu.
  - Hiển thị nhãn trạng thái có màu sắc trực quan (Xanh lá: *Đã xác nhận/Đã chốt cọc*; Vàng: *Chờ tư vấn/Chờ gặp*; Đỏ: *Đã hủy*).
  - Định dạng số tiền tệ chuẩn Việt Nam (`#,##0 ₫`) kèm dòng tổng kết (Total Summary Row).
- **Các tùy chọn xuất báo cáo**:
  1. **Báo cáo Quản trị Đa Trang (Multi-Sheet Master Report)**: 4 trang tính gồm *Đơn Tour Chính*, *Khách Đặt Trước*, *Nhật Ký Hành Động*, và *Danh Sách Hội Viên*.
  2. **Báo cáo Khách Đặt Tour Trước**: Bảng tính chuyên sâu danh sách các yêu cầu đặt trước ngày lễ, tour đoàn doanh nghiệp.
  3. **Báo cáo Nhật Ký Tương Tác**: Lịch sử thao tác của khách hàng và ban quản trị.
  4. **Tệp CSV Tiếng Việt (UTF-8 BOM)**: Tương thích phân tích dữ liệu nhanh.

### 8.3. Tài khoản thử nghiệm (Tham chiếu cho Lập trình viên / QA)
*(Thông tin đăng nhập thử nghiệm chỉ lưu trong tài liệu kỹ thuật, không hiển thị gợi ý công khai trên giao diện đăng nhập)*
- **Khách hàng**: `quan.tran@gmail.com` / `123456` (Trần Minh Quân)
- **Quản trị viên**: `admin@cotu-saigon.vn` / `cotu@2026` (Admin Cô Tư — truy cập tại `admin-login.html`)
