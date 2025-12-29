# Hướng Dẫn Hệ Thống Picking - Workflow và Trạng Thái

## 🎯 Tổng Quan Hệ Thống Picking

Hệ thống picking được thiết kế để quản lý toàn bộ quy trình lấy hàng trong kho từ việc tạo đơn hàng đến hoàn thành giao hàng.

## 📋 Các Thành Phần Chính

### 1. **Orders (Đơn Hàng)**
- Chứa thông tin khách hàng và danh sách sản phẩm cần lấy
- Trạng thái: `pending` → `assigned` → `picked` → `shipped`

### 2. **Waves (Đợt Lấy Hàng)**
- Nhóm nhiều đơn hàng lại thành một đợt để tối ưu hóa việc lấy hàng
- Mỗi wave có một operator (nhân viên) được gán

### 3. **Picking Tasks (Nhiệm Vụ Lấy Hàng)**
- Các nhiệm vụ cụ thể trong một wave
- Mỗi task chỉ định sản phẩm, vị trí, và số lượng cần lấy

## 🔄 Workflow Hoàn Chỉnh

### Bước 1: Tạo Đơn Hàng
```
POST /api/orders
{
  "order_number": "ORD001",
  "customer_name": "Khách Hàng A",
  "items": [
    {
      "product_reference": "PROD001",
      "quantity": 5
    }
  ]
}
```
**Trạng thái**: `pending`

### Bước 2: Tạo Wave
```
POST /api/picking/waves
{
  "order_ids": [1, 2, 3],
  "operator_id": 123,
  "priority": "high"
}
```
**Kết quả**: 
- Orders chuyển từ `pending` → `assigned`
- Tạo picking tasks với trạng thái `created`
- Wave được tạo với trạng thái `created`

### Bước 3: Bắt Đầu Wave
```
POST /api/waves/430388/start
{
  "operator_id": 123
}
```
**Xử lý**:
1. ✅ Kiểm tra inventory có đủ không
2. ✅ Reserve inventory (đặt trước hàng)
3. ✅ Chuyển trạng thái tasks từ `created` → `in_progress`
4. ✅ Gán operator cho wave

### Bước 4: Thực Hiện Picking
```
POST /api/picking/tasks/12345/complete
{
  "quantity_picked": 5,
  "picking_time_seconds": 120,
  "notes": "Đã lấy đủ hàng"
}
```
**Xử lý**:
1. ✅ Cập nhật task từ `in_progress` → `completed`
2. ✅ Trừ inventory thực tế
3. ✅ Release reservation
4. ✅ Kiểm tra nếu tất cả tasks trong wave đã hoàn thành

### Bước 5: Hoàn Thành Wave
- **Tự động**: Khi tất cả tasks completed
- **Thủ công**: `POST /api/waves/430388/complete`

**Kết quả**: Orders chuyển từ `assigned` → `picked`

## 📊 Các Trạng Thái Chi Tiết

### 🔵 Order Status
| Trạng Thái | Mô Tả | Hành Động Tiếp Theo |
|------------|-------|---------------------|
| `pending` | Đơn hàng mới tạo, chưa được xử lý | Gán vào wave |
| `assigned` | Đã được gán vào wave | Bắt đầu picking |
| `picked` | Đã lấy hàng xong | Chuẩn bị giao hàng |
| `shipped` | Đã giao hàng | Hoàn thành |
| `cancelled` | Đã hủy | Không xử lý |

### 🟢 Wave Status
| Trạng Thái | Mô Tả | Hành Động Có Thể |
|------------|-------|------------------|
| `created` | Wave mới tạo | Start, Cancel |
| `in_progress` | Đang thực hiện picking | Pause, Complete, Cancel |
| `paused` | Tạm dừng | Resume, Cancel |
| `completed` | Hoàn thành | Không có |
| `cancelled` | Đã hủy | Không có |

### 🟡 Task Status
| Trạng Thái | Mô Tả | Operator Action |
|------------|-------|-----------------|
| `created` | Task mới tạo, chưa bắt đầu | Chờ wave start |
| `in_progress` | Đang thực hiện | Complete task |
| `paused` | Tạm dừng | Chờ resume |
| `completed` | Đã hoàn thành | Không có |
| `cancelled` | Đã hủy | Không có |

## 🛠️ API Endpoints Chính

### Wave Management
```bash
# Lấy danh sách waves
GET /api/waves?status=in_progress&page=1&limit=20

# Lấy chi tiết wave
GET /api/waves/430388

# Bắt đầu wave
POST /api/waves/430388/start
{
  "operator_id": 123
}

# Tạm dừng wave
POST /api/waves/430388/pause
{
  "reason": "Nghỉ giải lao"
}

# Tiếp tục wave
POST /api/waves/430388/resume

# Hoàn thành wave
POST /api/waves/430388/complete

# Hủy wave
POST /api/waves/430388/cancel
{
  "reason": "Hết hàng"
}
```

### Task Management
```bash
# Hoàn thành task
POST /api/picking/tasks/12345/complete
{
  "quantity_picked": 5,
  "picking_time_seconds": 120,
  "notes": "OK"
}

# Lấy danh sách tasks
GET /api/picking?wave_number=W12345678&status=in_progress
```

### Performance & Analytics
```bash
# Xem performance
GET /api/picking/performance?period=7d&operator_id=123

# Tối ưu route
GET /api/picking/waves/430388/optimize-route
```

## 🔍 Tính Năng Nâng Cao

### 1. **Inventory Reservation**
- Tự động reserve hàng khi start wave
- Prevent overselling
- Auto release khi cancel wave

### 2. **Route Optimization**
- AI-powered genetic algorithm
- Tối ưu đường đi picking
- Giảm thời gian di chuyển

### 3. **Real-time Monitoring**
- Track completion percentage
- Monitor operator performance
- Detect inventory issues

### 4. **Error Handling**
- Transaction safety
- Rollback on failures
- Comprehensive logging

## 🚨 Xử Lý Lỗi Thường Gặp

### 1. **404 Not Found**
```json
{
  "error": "Wave not found"
}
```
**Nguyên nhân**: Wave ID không tồn tại
**Giải pháp**: Kiểm tra lại wave ID

### 2. **400 Bad Request - Insufficient Inventory**
```json
{
  "error": "Insufficient inventory for some items",
  "inventory_issues": [
    {
      "product_reference": "PROD001",
      "required": 10,
      "available": 5
    }
  ]
}
```
**Nguyên nhân**: Không đủ hàng trong kho
**Giải pháp**: Nhập thêm hàng hoặc điều chỉnh đơn hàng

### 3. **400 Bad Request - Wave Already Started**
```json
{
  "error": "Wave is already in progress"
}
```
**Nguyên nhân**: Wave đã được start rồi
**Giải pháp**: Kiểm tra trạng thái wave

## 📈 Metrics & KPIs

### Performance Metrics
- **Picks per hour**: Số lượng picks/giờ
- **Items per hour**: Số sản phẩm/giờ  
- **Wave completion rate**: Tỷ lệ hoàn thành wave
- **Average pick time**: Thời gian pick trung bình

### Operator Metrics
- **Tasks completed**: Số task hoàn thành
- **Accuracy rate**: Tỷ lệ chính xác
- **Productivity**: Năng suất làm việc

### Inventory Metrics
- **Stock levels**: Mức tồn kho
- **Reservation rate**: Tỷ lệ đặt trước
- **Turnover rate**: Tỷ lệ luân chuyển

## 🎯 Best Practices

### 1. **Wave Planning**
- Nhóm orders theo zone để giảm di chuyển
- Cân bằng workload giữa các operators
- Ưu tiên orders có deadline gần

### 2. **Inventory Management**
- Thường xuyên kiểm tra stock levels
- Sử dụng ABC analysis cho prioritization
- Maintain safety stock levels

### 3. **Performance Optimization**
- Sử dụng route optimization
- Monitor và analyze performance metrics
- Continuous training cho operators

### 4. **Error Prevention**
- Validate inventory trước khi start wave
- Double-check critical orders
- Maintain backup plans

---

**Lưu ý**: Hệ thống sử dụng SQL database với transaction safety, đảm bảo data integrity trong mọi tình huống.