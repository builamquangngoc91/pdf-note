# Margin — Ghi chú PDF

📖 **[Hướng dẫn sử dụng bằng tiếng Việt, kèm ảnh từng màn hình](huong-dan/README.md)**

Website ghi chú PDF tiếng Việt, chạy ở http://localhost:3002.

Truy cập qua Tailscale bằng `http://<IP-Tailscale-của-máy-chủ>:3002` (thiết bị truy cập cần kết nối cùng tailnet). Server lắng nghe trên 0.0.0.0; API vẫn cùng origin, không bật CORS.

## Chạy

Cần Node.js >= 22.13 và npm.

```sh
npm install
npm run dev
```

Lệnh dev tạo PDF mẫu/worker và áp dụng migration local. Port được cố định 3002 với strictPort; nếu cổng bận, tiến trình báo lỗi thay vì tự đổi cổng.

## Chức năng

- Thư viện gồm Tất cả, Gần đây và Thư mục.
- Tạo thư mục/thư mục con, đổi tên, chuyển PDF giữa các thư mục.
- Gần đây sắp theo lần mở PDF, được lưu ở server.
- Lịch sử riêng cho từng PDF: mở bằng nút Lịch sử cạnh file hoặc trên thanh công cụ của PDF đang đọc. Mỗi file hiển thị 100 phiên bản gần nhất và chỉ khôi phục phiên bản của chính file đó; không có lịch sử chung của thư viện. Dữ liệu có trước tính năng này được giữ thành bản đầu tiên khi chỉnh sửa tiếp.
- Tải lên, mở lại PDF (tối đa 25 MB, 100 trang).
- Viết/vẽ, highlight nhiều màu, thay đổi độ dày, tẩy từng nét.
- Undo/redo: Ctrl/Cmd+Z và Ctrl/Cmd+Shift+Z (hoặc Ctrl/Cmd+Y). Undo/redo dùng trong phiên mở tài liệu; lịch sử phiên bản vẫn còn sau tải lại trang.
- Chèn chữ trực tiếp lên PDF (T), thanh định dạng gọn như Word: chọn font, cỡ/màu, đậm/nghiêng/gạch chân/gạch ngang, căn trái/giữa/phải, giãn dòng và xóa định dạng. Định dạng áp dụng toàn hộp chữ; phím Ctrl/Cmd+B, I, U được hỗ trợ. Kéo để di chuyển và đổi kích thước hộp.
- Font Liberation Sans/Serif/Mono được đóng gói cùng origin (kèm giấy phép SIL OFL); định dạng được giữ khi lưu, hoàn tác, khôi phục lịch sử và xuất PDF.
- Chèn ảnh PNG/JPG/WebP (nút Hình), kéo di chuyển, kéo góc đổi kích thước giữ tỉ lệ.
- Chọn đối tượng bằng công cụ Di chuyển (V); nhấp đúp hoặc Sửa chữ để chỉnh nội dung, Delete để xóa; undo/redo áp dụng cho cả chữ và hình.
- Ghi chú văn bản theo trang, xem toàn bộ ghi chú.
- Tự lưu PDF và ghi chú phía server; không dùng localStorage làm dữ liệu chính.
- Xuất PDF có nét vẽ, chữ và hình đã chèn. Ghi chú văn bản được nối thành các trang cuối.
- Bản PDF xuất được làm phẳng thành ảnh để giữ đúng vị trí trên cả trang xoay; không giữ lớp chữ có thể chọn của bản gốc. Bản gốc không bị ghi đè.

## Dữ liệu và origin

Giao diện, API /api/documents, tài liệu, font hệ thống và PDF worker đều cùng origin.
Không bật CORS và từ chối mutation từ origin khác. Không tải font/CDN bên ngoài.
Dữ liệu phát triển nằm trong .wrangler/state; không xóa thư mục này nếu cần giữ tài liệu.
Đây là workspace cá nhân; không triển khai công khai như ứng dụng nhiều tài khoản khi chưa thêm phân quyền người dùng.

## Kiểm tra

```sh
npm run build
npx tsc --noEmit
node --experimental-strip-types --test tests/*.test.mjs
# Khi dev server đang chạy:
python3 tests/library.integration.py
```

WebMCP add_pdf_note được bật khi trình duyệt hỗ trợ. Chưa xác minh bằng môi trường WebMCP vì công cụ phiên này không cung cấp context tương thích.
