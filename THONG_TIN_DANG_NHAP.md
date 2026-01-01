# THÔNG TIN ĐĂNG NHẬP HỆ THỐNG

## Tài khoản có sẵn

### 1. Admin (Quản trị viên)
- **Username:** `admin`
- **Password:** `admin123`
- **Quyền:** Toàn quyền quản trị hệ thống

### 2. Manager (Quản lý)
- **Username:** `manager`
- **Password:** `manager123`
- **Quyền:** Quản lý kho, tạo wave, xem báo cáo

### 3. Operator (Nhân viên kho)
- **Username:** `operator`
- **Password:** `operator123`
- **Quyền:** Thực hiện picking, xem nhiệm vụ

### 4. Operator 1
- **Username:** `operator1`
- **Password:** `operator123`
- **Quyền:** Thực hiện picking, xem nhiệm vụ

### 5. Operator 2
- **Username:** `operator2`
- **Password:** `operator123`
- **Quyền:** Thực hiện picking, xem nhiệm vụ

## Cách đăng nhập

1. Mở trình duyệt và truy cập: http://localhost:3000
2. Nhập username và password từ danh sách trên
3. Click "Login"

## Lưu ý

- Tất cả mật khẩu đều là mật khẩu demo, không dùng trong môi trường production
- Token đăng nhập có hiệu lực 24 giờ
- Nếu quên đăng xuất, token sẽ tự động hết hạn sau 24h

## Xem dữ liệu trong Database

### Cách 1: Sử dụng script có sẵn
```bash
node view-database.js
```

### Cách 2: Sử dụng sqlite3 command line
```bash
sqlite3 warehouse.db

# Xem tất cả bảng
.tables

# Xem users
SELECT * FROM users;

# Xem products
SELECT * FROM products LIMIT 10;

# Thoát
.exit
```

### Cách 3: Cài đặt DB Browser for SQLite (Khuyên dùng)
```bash
# macOS
brew install --cask db-browser-for-sqlite

# Sau đó mở file warehouse.db bằng ứng dụng
```

## Khắc phục sự cố

### Không đăng nhập được
1. Kiểm tra server đang chạy: http://localhost:3000
2. Kiểm tra username/password chính xác
3. Xóa cache trình duyệt (Cmd+Shift+R trên macOS)
4. Kiểm tra console log trong Developer Tools (F12)

### Server không chạy
```bash
# Khởi động server
node server.js

# Hoặc
npm start
```

### Port 3000 đã được sử dụng
```bash
# Kill process đang dùng port 3000
lsof -ti:3000 | xargs kill -9

# Sau đó khởi động lại server
node server.js
```
