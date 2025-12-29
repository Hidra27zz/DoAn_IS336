# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG WAREHOUSE MANAGEMENT

## TỔNG QUAN HỆ THỐNG

Hệ thống Warehouse Management System (WMS) được thiết kế để quản lý toàn bộ quy trình kho hàng từ nhập kho, lưu trữ, đến xuất kho và giao hàng. Hệ thống sử dụng AI để tối ưu hóa các quy trình và cung cấp giao diện web hiện đại.

## 6. WAVE PLANNING - LẬP KẾ HOẠCH THU GOM

### 6.1. Wave Master (Quản lý Wave)

**Mục đích**: Quản lý tất cả các wave picking trong hệ thống

**Các bước thực hiện**:

1. **Truy cập Wave List**:
   - Vào menu "Picking" từ sidebar
   - Xem danh sách tất cả waves hiện có
   - Sử dụng các bộ lọc để tìm wave cụ thể

2. **Tìm kiếm và Lọc**:
   - **Search theo Wave Number**: Nhập mã wave vào ô tìm kiếm
   - **Filter theo Status**: Chọn trạng thái (Draft/Created, In Progress, Completed, Cancelled, Paused)
   - **Filter theo Operator**: Chọn nhân viên phụ trách
   - **Filter theo Date Range**: Chọn khoảng thời gian tạo wave

3. **Xem Chi tiết Wave**:
   - Click nút "View" trên wave muốn xem
   - Modal hiển thị thông tin chi tiết:
     - Mã wave, trạng thái, người tạo, thời gian
     - Danh sách đơn hàng trong wave
     - Thống kê: tổng items, tổng quantity, số locations

4. **Quản lý Wave**:
   - **Gán Operator**: Click "Assign Operator" để gán nhân viên
   - **Bắt đầu Wave**: Click "Start" để bắt đầu picking
   - **Tạm dừng**: Click "Pause" khi wave đang chạy
   - **Tiếp tục**: Click "Resume" khi wave bị tạm dừng
   - **Hoàn thành**: Click "Complete" khi picking xong
   - **Hủy Wave**: Click "Cancel" để hủy wave

### 6.2. Wave Build (Tạo Wave từ đơn hàng)

**Mục đích**: Tạo wave mới từ danh sách đơn hàng có sẵn

**Các bước thực hiện**:

1. **Mở Wave Build Modal**:
   - Click nút "Wave Build" trong phần Wave Planning
   - Hệ thống hiển thị wizard 2 bước

2. **Step 1 - Chọn Orders**:
   - Xem danh sách đơn hàng pending
   - Sử dụng filter để lọc theo priority
   - Sử dụng search để tìm đơn hàng cụ thể
   - Check các đơn hàng muốn thêm vào wave

3. **Step 2 - Preview Wave**:
   - Xem preview chi tiết wave sẽ tạo:
     - Tổng số đơn hàng
     - Tổng số SKU
     - Tổng số quantity
     - Ước lượng số locations cần đi
     - Ước lượng thời gian hoàn thành
     - Các zones liên quan

4. **Xác nhận tạo Wave**:
   - Kiểm tra thông tin preview
   - Click "Create Wave" để tạo
   - Hệ thống validate inventory và tạo picking tasks

### 6.3. Auto Wave Generation (Tự động tạo Wave)

**Mục đích**: Tự động tạo nhiều waves dựa trên quy tắc được cấu hình

**Các bước thực hiện**:

1. **Mở Auto Generation Modal**:
   - Click nút "Auto Generate Waves"
   - Cấu hình các quy tắc tự động

2. **Cấu hình Rules**:
   - **Max Orders per Wave**: Số đơn tối đa trong 1 wave (mặc định: 20)
   - **Max Picks per Wave**: Số tasks tối đa trong 1 wave (mặc định: 50)
   - **Time Window**: Khung thời gian xử lý (mặc định: 4 giờ)
   - **Priority Orders First**: Ưu tiên đơn hàng quan trọng

3. **Cấu hình Grouping Strategy**:
   - **Group by Zone**: Nhóm theo khu vực kho
   - **Group by Distance**: Nhóm theo khoảng cách
   - **Group by ABC**: Nhóm theo phân loại ABC

4. **Preview và Confirm**:
   - Click "Preview" để xem waves sẽ được tạo
   - Xem chi tiết từng wave được đề xuất
   - Click "Generate Waves" để tạo thực tế
   - Click "Confirm & Create" để xác nhận

### 6.4. Operator Assignment & Progress

**Mục đích**: Gán nhân viên và theo dõi tiến độ thực hiện

**Các bước thực hiện**:

1. **Gán Operator**:
   - Trong Wave Detail, click "Assign Operator"
   - Chọn nhân viên từ dropdown
   - Xác nhận gán

2. **Theo dõi Progress**:
   - Xem % hoàn thành trong bảng waves
   - Xem ETA (thời gian dự kiến hoàn thành)
   - Theo dõi số tasks đã hoàn thành / tổng tasks

3. **Activity Log**:
   - Xem lịch sử hoạt động của wave
   - Theo dõi ai bắt đầu, ai hoàn thành
   - Xem các thay đổi trạng thái

## 7. PICKING OPERATIONS - HOẠT ĐỘNG THU GOM

### 7.1. Pick Task Management (Quản lý Pick Task)

**Mục đích**: Quản lý từng task picking cụ thể

**Các bước thực hiện**:

1. **Xem Pick Tasks**:
   - Trong Wave Detail Modal, xem tab "Picking Tasks"
   - Danh sách hiển thị:
     - Product Reference
     - Location Code
     - Zone
     - Quantity cần lấy
     - Quantity đã lấy
     - Status (Created, In Progress, Completed)

2. **Thực hiện Picking**:
   - Operator đi đến location được chỉ định
   - Lấy đúng số lượng sản phẩm
   - Click "Mark as Picked" để xác nhận
   - Nhập số lượng thực tế đã lấy

3. **Báo cáo Issues**:
   - Nếu có vấn đề (thiếu hàng, sai vị trí)
   - Click "Report Issue"
   - Mô tả chi tiết vấn đề gặp phải

### 7.2. Picking Progress Dashboard

**Mục đích**: Theo dõi tiến độ picking tổng quan

**Thông tin hiển thị**:

1. **Thống kê Tổng quan**:
   - Active Waves: Số waves đang hoạt động
   - Total Tasks: Tổng số tasks
   - Completed Today: Số tasks hoàn thành hôm nay
   - Avg Pick Time: Thời gian picking trung bình

2. **Theo dõi Real-time**:
   - Wave nào đang chậm tiến độ
   - Operator nào đang active
   - % hoàn thành theo từng wave
   - ETA cho từng wave

### 7.3. Pick List Generation

**Mục đích**: Tạo danh sách picking để in hoặc xuất file

**Các bước thực hiện**:

1. **Chọn Wave**:
   - Chọn wave muốn tạo pick list
   - Chọn format (PDF hoặc Excel)

2. **Tùy chọn Format**:
   - **Group by Location**: Nhóm theo vị trí
   - **Sort by Route**: Sắp xếp theo tuyến đường tối ưu
   - **Include Barcode/QR**: Thêm mã vạch nếu cần

3. **Download**:
   - Click "Generate" để tạo file
   - Download file về máy
   - In hoặc sử dụng trên thiết bị di động

## CÁC TÍNH NĂNG KHÁC

### Dashboard - Tổng quan

**Mục đích**: Xem tổng quan tình hình kho hàng

**Thông tin hiển thị**:
- Total Inventory: Tổng số sản phẩm trong kho
- Pending Orders: Số đơn hàng chờ xử lý
- Active Waves: Số waves đang hoạt động
- Today's Picks: Số lượng đã picking hôm nay

**Biểu đồ**:
- Inventory by Zone: Phân bố hàng tồn theo khu vực
- Order Status: Trạng thái đơn hàng

### Inventory Management - Quản lý Tồn kho

**Các chức năng chính**:

1. **Xem Inventory**:
   - Danh sách tất cả sản phẩm trong kho
   - Filter theo zone, ABC code, low stock
   - Thông tin: Product, Location, Quantity, Reserved, Available

2. **Nhập Kho (Inbound)**:
   - Chọn sản phẩm và location
   - Nhập số lượng
   - Thêm ghi chú nếu cần

3. **Xuất Kho (Outbound)**:
   - Chọn sản phẩm và location xuất
   - Nhập số lượng xuất
   - Thêm lý do xuất kho

4. **Chuyển Kho (Transfer)**:
   - Chọn sản phẩm
   - Chọn location nguồn và đích
   - Nhập số lượng chuyển

5. **Điều chỉnh Tồn kho (Adjust)**:
   - Chọn inventory record
   - Nhập số lượng mới
   - Nhập lý do điều chỉnh

### Order Management - Quản lý Đơn hàng

**Các chức năng chính**:

1. **Xem Orders**:
   - Danh sách tất cả đơn hàng
   - Filter theo status
   - Thông tin: Order Number, Customer, Status, Priority, Items, Created Date

2. **Tạo Order mới**:
   - Nhập Order Number và Customer
   - Chọn Priority
   - Nhập danh sách sản phẩm (format: Product:Quantity)

3. **Quản lý Status**:
   - Assign: Gán đơn hàng vào wave
   - Ship: Chuyển trạng thái sang shipped
   - Cancel: Hủy đơn hàng

### Warehouse Management - Quản lý Kho

**Các chức năng chính**:

1. **Xem Layout Kho**:
   - Tổng số locations
   - Capacity và utilization
   - Movements hôm nay

2. **2D Warehouse Map**:
   - Xem bản đồ kho 2D
   - Filter theo floor và zone
   - Zoom và search locations
   - Chi tiết từng vị trí

3. **Quick Actions**:
   - Movement History: Lịch sử di chuyển
   - Location Details: Chi tiết vị trí
   - Generate Report: Tạo báo cáo kho

### AI Optimization - Tối ưu hóa AI

**Các thuật toán AI**:

1. **K-Means Clustering**:
   - Phân loại sản phẩm theo tần suất bán
   - Cấu hình số clusters (K)
   - Kết quả: ABC classification tự động

2. **DBSCAN Clustering**:
   - Phát hiện anomalies trong patterns
   - Cấu hình Epsilon và Min Points
   - Kết quả: Outliers và clusters

3. **Route Optimization**:
   - Tối ưu tuyến đường picking
   - Sử dụng Genetic Algorithm
   - Kết quả: Giảm thời gian và khoảng cách

4. **Storage Recommendations**:
   - Đề xuất vị trí lưu trữ tối ưu
   - Dựa trên phân tích AI
   - Kết quả: Recommendations list

### Reports - Báo cáo

**Các loại báo cáo**:

1. **Warehouse Summary**: Tổng quan kho hàng
2. **Operator Performance**: Hiệu suất nhân viên
3. **Inventory Analysis**: Phân tích tồn kho
4. **AI Optimization**: Kết quả tối ưu AI

### Storage Config - Cấu hình Lưu trữ

**Các cấu hình**:

1. **ABC Classification**:
   - Class A Threshold: Ngưỡng loại A (%)
   - Class B Threshold: Ngưỡng loại B (%)
   - Class C: Tự động tính (100% - A - B)

2. **Storage Strategy**:
   - Class-Based Storage: Lưu trữ theo phân loại
   - Random Storage: Lưu trữ ngẫu nhiên
   - Dedicated Storage: Lưu trữ cố định
   - Hybrid Storage: Kết hợp các phương pháp

3. **Zone Configuration**:
   - High-Frequency Zone: Khu vực cho hàng bán chạy
   - Low-Frequency Zone: Khu vực cho hàng ít bán

### Operators - Quản lý Nhân viên

**Các chức năng**:

1. **Xem Operators**:
   - Danh sách tất cả nhân viên
   - Thông tin: ID, Name, Status, Current Wave, Performance

2. **Thêm Operator mới**:
   - Nhập Operator ID và tên
   - Chọn status và ca làm việc

3. **Quản lý Performance**:
   - Theo dõi số picks đã hoàn thành
   - Thời gian picking trung bình
   - Điểm performance tổng thể

## WORKFLOW HOÀN CHỈNH

### Quy trình từ Order đến Shipping:

1. **Tạo Order** (Order Management)
2. **Tạo Wave** (Wave Planning)
3. **Gán Operator** (Operator Assignment)
4. **Start Wave** (Begin Picking)
5. **Thực hiện Picking** (Pick Task Management)
6. **Complete Tasks** (Mark as Picked)
7. **Complete Wave** (Finish Picking)
8. **Ship Orders** (Update to Shipped)

### Trạng thái chuyển đổi:

**Orders**: pending → assigned → picked → shipped
**Waves**: created → in_progress → completed
**Tasks**: created → in_progress → completed

## LƯU Ý QUAN TRỌNG

1. **Development Mode**: Có AUTO_FIX_INVENTORY để tự động thêm inventory khi thiếu
2. **Production Mode**: Strict validation, không tự động fix
3. **Inventory Reservation**: Hệ thống tự động reserve inventory khi start wave
4. **Transaction Safety**: Tất cả operations đều có rollback khi có lỗi
5. **Real-time Updates**: UI tự động cập nhật khi có thay đổi

## TROUBLESHOOTING

### Lỗi thường gặp:

1. **"Invalid operator ID"**: Kiểm tra operator có tồn tại trong database
2. **"Insufficient inventory"**: Kiểm tra tồn kho và reserved quantity
3. **"Wave not found"**: Kiểm tra wave ID hoặc wave number
4. **404 API errors**: Kiểm tra server đang chạy và endpoints có sẵn

### Giải pháp:

1. **Refresh browser** khi gặp lỗi UI
2. **Check server logs** để debug API errors
3. **Verify database** khi có data inconsistency
4. **Restart server** nếu cần thiết