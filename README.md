# Sổ Quản Lý V10 — thiết lập Google Drive ngay trong app

## Tại sao không tự chạy từ file HTML local?
Tệp file:// không thể tự yêu cầu quyền Drive an toàn. Để ứng dụng mở link và tự khởi tạo Drive, cần xuất bản **một lần** trên Google Apps Script (miễn phí trong hạn mức).

## Cài lần đầu (một lần duy nhất)
1. Đăng nhập Gmail sẽ sở hữu dữ liệu. Mở https://script.google.com/home và tạo New project.
2. Đổi tên dự án `SoQuanLy_V10`.
3. Thay nội dung `Code.gs` bằng file `apps-script/Code.gs`.
4. Thêm HTML file mới tên `Index` và dán nội dung `apps-script/Index.html` (không thêm đuôi `.html` vào tên khi tạo file).
5. Nhấn Save. Trong editor, chọn hàm `apiInitialize` rồi bấm **Run** một lần và phê duyệt quyền Google Drive/Sheets. Tùy luồng quyền, Google có thể cảnh báo app chưa được xác minh vì đây là script do chính N tạo.
6. Deploy > New deployment > Web app. **Execute as: Me**, **Who has access: Only myself** (an toàn cho 1 Gmail, nhiều thiết bị cùng Gmail). Lấy URL `/exec`.
7. Truy cập URL trên iPhone/Android/PC. Màn hình kết nối hiện ra; bấm **Kết nối và khởi tạo dữ liệu**. App tạo hoặc nhận diện thư mục `SoQuanLy_App_Data`, các thư mục `Images`, `Backups`, `Attachments`, bảng tính `SoQuanLy_Database` chứa 12 tabs và tự tải dữ liệu.
8. Lần sau dùng cùng URL. Source trên Google Apps Script có thể cập nhật trong cùng deployment để giữ URL.

## Local mode
Mở `index.html` trong thư mục này qua trình duyệt (Windows/Android phù hợp). Local lưu IndexedDB; **không kết nối Google**. `index.html` và `apps-script/Index.html` là 2 bản chạy cùng giao diện, bản Apps Script đã gộp CSS/JS vào một HTML.

## Đồng thời và bảo mật — quan trọng
- Mỗi lần ghi chỉ chuyển các bản ghi đã thay đổi; backend `LockService` kiểm tra version từng bản ghi, vì vậy 2 người thêm các hóa đơn khác ID không ghi đè nhau.
- Mã hóa đơn mới được server phân bổ trong khóa ghi, thay vì tin mã tạm trên trình duyệt. Cần kiểm thử tình huống hai thiết bị lưu đồng thời trước khi dùng thực tế.
- **Chưa có xác thực nhân viên riêng**: Chỉ triển khai access `Only myself`, KHÔNG để `Anyone` / `Anyone with Google account`, bởi chế độ `Execute as me` sẽ khiến người có link có thể truy cập dữ liệu.
- Cập nhật nhiều bảng Sheets trong cùng batch chưa thực sự atomic: nếu Google bị lỗi giữa chừng, dữ liệu có thể ghi một phần. Chưa dùng để quản lý tài chính thực tế cho đến khi có nhật ký sự kiện và cơ chế phục hồi.
- Các giao dịch trong V9 đã bị sửa trực tiếp local trước khi chờ phản hồi server: khi xung đột, ứng dụng yêu cầu tải lại và nhập lại phần chưa đồng bộ, không tự động hợp nhất.
- Dữ liệu **ảnh vẫn là base64** trong record; chưa tải ảnh thành file vào `Images`. Hạn chế ảnh hiện tại và chuyển sang Drive file API về sau.
- Không coi giới hạn miễn phí là không giới hạn; Apps Script, Google Sheets và Google Drive đều có quotas.

## Dữ liệu tạo
```
SoQuanLy_App_Data/
  SoQuanLy_Database (Google Sheets: businesses, accounts, customers,
    products, orders, purchases, movements, expenses, transfers,
    audit, settings, invoiceSequences)
  Images/
  Backups/
  Attachments/
```

## Về kết nối một Gmail trên nhiều thiết bị
Sử dụng cùng URL Web App và đăng nhập cùng một Gmail; không cần sao chép source vào mỗi điện thoại. Nếu muốn Gmail riêng cho từng nhân viên, phải bổ sung xác thực/ủy quyền phù hợp trước khi đổi cấu hình quyền triển khai.
