# LUỒNG HỆ THỐNG QUẢN LÝ KHO HÀNG THÔNG MINH

## TỔNG QUAN HỆ THỐNG

Hệ thống Warehouse Management System (WMS) là một ứng dụng web quản lý kho hàng thông minh với tích hợp AI, giúp tối ưu hóa các hoạt động kho bãi từ nhập kho, xuất kho, lấy hàng đến báo cáo và phân tích.

---

## 1. LUỒNG ĐĂNG NHẬP VÀ XÁC THỰC

### **Bước 1: Truy cập hệ thống**
- Người dùng truy cập: `http://localhost:3000`
- Hệ thống hiển thị màn hình đăng nhập

### **Bước 2: Đăng nhập**
- Nhập **Username** và **Password**
- Hệ thống kiểm tra thông tin với database
- **Tài khoản có sẵn:**
  - `admin` / `admin123` (Quản trị viên)
  - `manager` / `manager123` (Quản lý)
  - `supervisor` / `supervisor123` (Giám sát)
  - `operator` / `operator123` (Nhân viên)

### **Bước 3: Xác thực thành công**
- Hệ thống tạo JWT token
- Lưu thông tin người dùng vào localStorage
- Chuyển hướng đến Dashboard chính

### **Bước 4: Phân quyền**
- **Admin**: Toàn quyền truy cập tất cả chức năng
- **Manager**: Quản lý kho, báo cáo, AI optimization
- **Supervisor**: Giám sát picking, inventory, orders
- **Operator**: Thực hiện picking tasks, xem inventory

---

## 2. LUỒNG DASHBOARD - TỔNG QUAN

### **Khi vào Dashboard:**
1. **Load thống kê tổng quan:**
   - Tổng số sản phẩm trong kho
   - Đơn hàng đang chờ xử lý
   - Waves đang hoạt động
   - Số lượng picks hôm nay

2. **Hiển thị biểu đồ:**
   - **Biểu đồ cột**: Phân bố inventory theo zone
   - **Biểu đồ tròn**: Trạng thái đơn hàng

3. **Cập nhật real-time:**
   - Metrics được tính toán từ dữ liệu thực
   - Refresh tự động mỗi 30 giây

---

## 3. LUỒNG QUẢN LÝ INVENTORY (TỒN KHO)

### **3.1 Xem Inventory**
1. Click menu **"Inventory"**
2. Hệ thống load danh sách sản phẩm từ database
3. Hiển thị bảng với thông tin:
   - Mã sản phẩm (Product Reference)
   - Phân loại ABC (A: cao, B: trung bình, C: thấp)
   - Vị trí lưu trữ (Location Code)
   - Khu vực (Zone)
   - Số lượng tồn kho
   - Số lượng đã đặt trước
   - Số lượng khả dụng

### **3.2 Filter và Tìm kiếm**
- **Filter theo Zone**: A, B, C, D, E, F...
- **Filter theo ABC Code**: A, B, C
- **Low Stock Only**: Chỉ hiển thị hàng sắp hết

### **3.3 Thao tác Inventory**

#### **A. Nhập Kho (Inbound)**
1. Click **"Inbound (Nhap Kho)"**
2. Nhập thông tin:
   - Mã sản phẩm (VD: O9YFO8)
   - Vị trí lưu trữ (VD: A-14-11)
   - Số lượng
   - Ghi chú (tùy chọn)
3. Hệ thống:
   - Kiểm tra sản phẩm có tồn tại
   - Kiểm tra vị trí lưu trữ hợp lệ
   - Cập nhật số lượng tồn kho
   - Ghi log movement history

#### **B. Xuất Kho (Outbound)**
1. Click **"Outbound (Xuat Kho)"**
2. Nhập thông tin:
   - Mã sản phẩm
   - Vị trí xuất hàng
   - Số lượng xuất
   - Ghi chú
3. Hệ thống:
   - Kiểm tra đủ hàng tồn kho
   - Trừ số lượng từ inventory
   - Cập nhật available quantity

#### **C. Chuyển Kho (Transfer)**
1. Click **"Transfer (Chuyen Kho)"**
2. Nhập thông tin:
   - Mã sản phẩm
   - Vị trí nguồn (From Location)
   - Vị trí đích (To Location)
   - Số lượng chuyển
3. Hệ thống:
   - Kiểm tra hàng tại vị trí nguồn
   - Chuyển hàng giữa các vị trí
   - Cập nhật cả hai vị trí

#### **D. Điều Chỉnh Tồn Kho (Adjust Stock)**
1. Click **"Adjust Stock"** trên từng dòng
2. Nhập:
   - Số lượng mới
   - Lý do điều chỉnh
3. Hệ thống cập nhật và ghi log

---

## 4. LUỒNG QUẢN LÝ ĐỚN HÀNG (ORDERS)

### **4.1 Xem Đơn Hàng**
1. Click menu **"Orders"**
2. Hiển thị danh sách đơn hàng với:
   - Số đơn hàng (Order Number)
   - Mã khách hàng (Customer Code)
   - Trạng thái (Status)
   - Độ ưu tiên (Priority)
   - Số lượng items
   - Ngày tạo

### **4.2 Trạng Thái Đơn Hàng**
- **Pending**: Đơn hàng mới, chờ xử lý
- **Assigned**: Đã phân công cho picking wave
- **Picking**: Đang trong quá trình lấy hàng
- **Picked**: Đã lấy hàng xong
- **Shipped**: Đã giao hàng

### **4.3 Tạo Đơn Hàng Mới**
1. Click **"Create Order"**
2. Nhập thông tin:
   - Số đơn hàng
   - Mã khách hàng
   - Độ ưu tiên (Normal/High/Urgent)
   - Danh sách sản phẩm (VD: O9YFO8:5, I1X92B:3)
3. Hệ thống:
   - Kiểm tra sản phẩm tồn tại
   - Tạo đơn hàng với status "Pending"
   - Cập nhật reserved quantity

### **4.4 Xử Lý Đơn Hàng**
- **Assign**: Chuyển từ Pending → Assigned
- **Cancel**: Hủy đơn hàng và giải phóng reserved quantity
- **Ship**: Chuyển từ Picked → Shipped

---

## 5. LUỒNG PICKING (LẤY HÀNG)

### **5.1 Tạo Picking Wave**
1. Click **"Create Picking Wave"**
2. Chọn các đơn hàng Pending
3. Phân công Operator (tùy chọn)
4. Hệ thống:
   - Tạo Wave với số hiệu duy nhất
   - Tạo các Picking Tasks từ order items
   - Chuyển orders sang status "Assigned"

### **5.2 Bắt Đầu Wave**
1. Operator click **"Start"** trên wave
2. Wave chuyển sang status "In Progress"
3. Hiển thị danh sách picking tasks

### **5.3 Thực Hiện Picking**
1. Operator xem danh sách tasks
2. Đi đến vị trí lưu trữ theo chỉ dẫn
3. Lấy hàng theo số lượng yêu cầu
4. Click **"Complete Task"** và nhập:
   - Số lượng thực tế lấy được
   - Thời gian picking (giây)

### **5.4 Hoàn Thành Wave**
- Khi tất cả tasks hoàn thành
- Wave chuyển sang "Completed"
- Orders chuyển sang "Picked"
- Cập nhật inventory và performance metrics

---

## 6. LUỒNG QUẢN LÝ KHO (WAREHOUSE)

### **6.1 Xem Thống Kê Kho**
1. Click menu **"Warehouse"**
2. Hiển thị thống kê:
   - Tổng số vị trí lưu trữ
   - Tổng sức chứa
   - Tỷ lệ sử dụng
   - Số lượng di chuyển hôm nay

### **6.2 Quản Lý Storage Locations**
- Xem bảng tất cả vị trí lưu trữ
- Filter theo Zone (A, B, C, D) và Status (Empty/Occupied/Full)
- Xem chi tiết từng vị trí:
  - Location Code (VD: A-14-11)
  - Zone và Position (x, y, z)
  - Capacity và Current Stock
  - Utilization percentage

### **6.3 Zone Summary**
- 4 zone chính: A, B, C, D
- Mỗi zone hiển thị:
  - Số lượng locations
  - Tỷ lệ sử dụng (utilization)

### **6.4 Quick Actions**
- **Movement History**: Xem lịch sử di chuyển hàng
- **Quick Inbound/Outbound**: Thao tác nhanh
- **Transfer Stock**: Chuyển hàng giữa các vị trí
- **Location Details**: Xem chi tiết vị trí
- **Generate Report**: Tạo báo cáo kho

---

## 7. LUỒNG AI OPTIMIZATION (TỐI ƯU HÓA AI)

### **7.1 K-Means Clustering**
1. Click **"Run K-Means"**
2. Chọn số clusters (K = 3 mặc định)
3. Hệ thống:
   - Phân tích tần suất picking của sản phẩm
   - Phân loại ABC dựa trên clustering
   - Hiển thị kết quả phân loại

### **7.2 DBSCAN Clustering**
1. Click **"Run DBSCAN"**
2. Thiết lập tham số:
   - Epsilon (0.3 mặc định)
   - Min Points (3 mặc định)
3. Hệ thống:
   - Phát hiện anomalies và outliers
   - Nhóm sản phẩm theo pattern
   - Hiển thị noise points (sản phẩm bất thường)

### **7.3 Route Optimization**
1. Chọn Picking Wave
2. Click **"Optimize Route"**
3. Hệ thống:
   - Sử dụng Genetic Algorithm
   - Tối ưu hóa đường đi picking
   - Hiển thị:
     - Khoảng cách gốc vs tối ưu
     - Phần trăm cải thiện
     - Thời gian ước tính
     - Route tối ưu từng bước

### **7.4 Storage Recommendations**
1. Click **"Get Recommendations"**
2. Hệ thống đưa ra gợi ý:
   - Sản phẩm nên đặt ở vị trí nào
   - Dựa trên tần suất picking
   - Tối ưu hóa khoảng cách di chuyển

---

## 8. LUỒNG BÁO CÁO (REPORTS)

### **8.1 Warehouse Summary**
- Tổng quan hoạt động kho
- Thống kê locations, capacity, utilization
- Breakdown theo zone

### **8.2 Operator Performance**
- Hiệu suất từng nhân viên
- Số lượng picks, thời gian trung bình
- Thống kê waves hoàn thành

### **8.3 Inventory Analysis**
- Phân tích tồn kho chi tiết
- Phân loại ABC
- Cảnh báo hàng sắp hết

### **8.4 AI Optimization Report**
- Kết quả clustering analysis
- Route optimization statistics
- Thuật toán đã sử dụng

---

## 9. LUỒNG CẤU HÌNH HỆ THỐNG

### **9.1 Storage Config**
- **ABC Classification**: Thiết lập ngưỡng phân loại
  - Class A: 80% (mặc định)
  - Class B: 15% (mặc định)
  - Class C: 5% còn lại

- **Storage Strategy**: Chọn chiến lược lưu trữ
  - Class-Based Storage
  - Random Storage
  - Dedicated Storage
  - Hybrid Storage

- **Zone Configuration**: Cấu hình zone
  - High-Frequency Zone: A (mặc định)
  - Low-Frequency Zone: F (mặc định)

### **9.2 Operators Management**
- Thêm/sửa/xóa nhân viên
- Phân ca làm việc (Morning/Afternoon/Night)
- Theo dõi performance
- Kích hoạt/vô hiệu hóa tài khoản

---

## 10. LUỒNG DỮ LIỆU VÀ TÍCH HỢP

### **10.1 Database**
- **Primary**: Firebase Firestore (cloud)
- **Fallback**: Local JSON database
- **Real-time sync**: Tự động đồng bộ

### **10.2 Data Sources**
- **Products**: 208 sản phẩm từ Product.csv
- **Orders**: 32,634 đơn hàng từ Customer_Order.csv
- **Storage Locations**: 2,292 vị trí từ Storage_Location.csv
- **Picking Tasks**: 215,192 tasks từ Picking_Wave.csv

### **10.3 Metrics Calculation**
- **Real-time**: Tính toán từ dữ liệu thực
- **K-Means Accuracy**: 57.2%
- **Route Optimization**: 22.1% improvement
- **Storage Utilization**: 71.9%
- **Overall Efficiency**: 73.5%

---

## 11. LUỒNG XỬ LÝ LỖI VÀ FALLBACK

### **11.1 Authentication Errors**
- Token hết hạn → Tự động logout
- Login failed → Hiển thị thông báo lỗi
- No permission → Redirect về dashboard

### **11.2 API Errors**
- Network error → Retry 3 lần
- Server error → Fallback to local data
- Data not found → Hiển thị empty state

### **11.3 Chart Rendering Errors**
- Chart.js not loaded → Show fallback message
- Data format error → Display raw data
- Canvas not found → Retry button

---

## 12. LUỒNG RESPONSIVE VÀ MOBILE

### **12.1 Mobile Layout**
- Sidebar collapse thành hamburger menu
- Tables scroll horizontally
- Charts resize automatically
- Touch-friendly buttons

### **12.2 Tablet Layout**
- 2-column grid cho stats
- Compact navigation
- Optimized chart sizes

---

## 13. LUỒNG MAINTENANCE VÀ DEBUG

### **13.1 Debug Tools**
- Browser console: `debugFunctions()`
- Manual chart test: `testCharts()`
- API test endpoints
- System health check

### **13.2 Monitoring**
- Real-time metrics updates
- Error logging
- Performance tracking
- User activity logs

---

## 14. CHECKLIST SỬ DỤNG HỆ THỐNG

### **Cho Admin:**
- [ ] Đăng nhập với admin/admin123
- [ ] Kiểm tra Dashboard metrics
- [ ] Cấu hình Storage Strategy
- [ ] Quản lý Operators
- [ ] Tạo báo cáo tổng quan

### **Cho Manager:**
- [ ] Xem báo cáo hiệu suất
- [ ] Chạy AI optimization
- [ ] Phân tích inventory
- [ ] Tối ưu hóa routes

### **Cho Supervisor:**
- [ ] Tạo picking waves
- [ ] Giám sát picking progress
- [ ] Quản lý orders
- [ ] Kiểm tra inventory levels

### **Cho Operator:**
- [ ] Nhận picking assignments
- [ ] Thực hiện picking tasks
- [ ] Cập nhật task completion
- [ ] Báo cáo issues

---

## KẾT LUẬN

Hệ thống WMS cung cấp một luồng làm việc hoàn chỉnh từ quản lý tồn kho, xử lý đơn hàng, picking operations đến tối ưu hóa AI. Với giao diện thân thiện, hỗ trợ tiếng Việt và tích hợp công nghệ AI, hệ thống giúp tối ưu hóa hiệu quả hoạt động kho bãi và nâng cao năng suất làm việc.

**Liên hệ hỗ trợ**: Sử dụng debug tools hoặc kiểm tra console logs để troubleshoot các vấn đề kỹ thuật.