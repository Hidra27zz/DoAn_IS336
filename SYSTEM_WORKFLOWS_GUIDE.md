# 📋 HƯỚNG DẪN CHI TIẾT CÁC LUỒNG HOẠT ĐỘNG HỆ THỐNG WMS

## 🎯 TỔNG QUAN HỆ THỐNG

**Warehouse Management System (WMS)** với tích hợp AI Optimization là hệ thống quản lý kho hàng thông minh, bao gồm:

- 🏭 **Quản lý kho hàng**: Inventory, Storage Locations, Products
- 📦 **Quản lý đơn hàng**: Orders, Order Items, Customer Management  
- 🚚 **Quản lý picking**: Picking Waves, Tasks, Route Optimization
- 🤖 **AI Optimization**: K-Means Clustering, Route Optimization, Anomaly Detection
- 👥 **Quản lý nhân sự**: Operators, Performance Tracking
- 📊 **Báo cáo & Analytics**: Real-time Metrics, Dashboard, Reports

---

## 🔐 1. LUỒNG ĐĂNG NHẬP & PHÂN QUYỀN

### 1.1 Quy trình đăng nhập
```
Người dùng → Trang login → Nhập username/password → Xác thực → Dashboard
```

**Chi tiết thực hiện:**

1. **Truy cập hệ thống**: `http://localhost:3000/`
2. **Nhập thông tin đăng nhập**:
   - Admin: `admin` / `admin123`
   - Manager: `manager` / `manager123` 
   - Supervisor: `supervisor` / `supervisor123`
   - Operator: `operator` / `operator123`

3. **Xác thực**:
   - Hệ thống gửi request đến `/api/auth/login`
   - Server kiểm tra thông tin trong database
   - Trả về JWT token nếu hợp lệ

4. **Lưu session**:
   - Token được lưu trong localStorage
   - User info được lưu trong localStorage
   - Tự động redirect đến Dashboard

### 1.2 Phân quyền theo vai trò

| Vai trò | Quyền truy cập |
|---------|----------------|
| **Admin** | Toàn bộ hệ thống, cấu hình, báo cáo |
| **Manager** | Quản lý inventory, orders, picking, reports |
| **Supervisor** | Giám sát picking, operators, performance |
| **Operator** | Thực hiện picking tasks, cập nhật status |

---

## 📊 2. LUỒNG DASHBOARD & MONITORING

### 2.1 Dashboard chính
```
Login → Dashboard → Real-time Metrics → Charts & KPIs → Auto-refresh (30s)
```

**Các thông số hiển thị:**

1. **KPI Cards**:
   - Total Inventory: Tổng số sản phẩm trong kho
   - Pending Orders: Đơn hàng chờ xử lý
   - Active Waves: Đợt picking đang thực hiện
   - Today's Picks: Số lượng pick trong ngày

2. **Biểu đồ**:
   - **Inventory by Zone**: Phân bố hàng hóa theo khu vực (18 zones)
   - **Order Status**: Trạng thái đơn hàng (Pending, Picking, Shipped, etc.)

3. **Real-time Updates**:
   - Metrics tự động cập nhật mỗi 30 giây
   - Data được tính toán từ MetricsCalculator
   - Biểu đồ refresh theo thời gian thực

### 2.2 Navigation System
```
Dashboard → Sidebar Menu → Section Selection → Data Loading → Content Display
```

**Các module chính:**
- 🏠 Dashboard: Tổng quan hệ thống
- 📦 Inventory: Quản lý tồn kho
- 🛒 Orders: Quản lý đơn hàng
- 🚚 Picking: Quản lý picking operations
- 🏭 Warehouse: Quản lý kho bãi
- 🤖 AI Optimization: Tối ưu hóa AI
- 📋 Reports: Báo cáo & phân tích
- ⚙️ Storage Config: Cấu hình lưu trữ
- 👥 Operators: Quản lý nhân viên

---

## 📦 3. LUỒNG QUẢN LÝ INVENTORY

### 3.1 Xem inventory
```
Inventory Menu → Load Data → Filter/Search → Display Results → Actions
```

**Quy trình chi tiết:**

1. **Truy cập**: Click "Inventory" trong sidebar
2. **Load dữ liệu**: 
   - API call: `GET /api/inventory?limit=100`
   - Kết hợp data từ products, locations, inventory tables
   - Hiển thị trong bảng với pagination

3. **Filtering options**:
   - **By Zone**: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R
   - **By ABC Code**: A (high frequency), B (medium), C (low)
   - **Low Stock**: Sản phẩm dưới ngưỡng tồn kho

4. **Thông tin hiển thị**:
   - Product Reference
   - ABC Code
   - Location Code
   - Zone
   - Quantity
   - Reserved Quantity
   - Available Quantity

### 3.2 Inventory Operations

#### 3.2.1 Inbound (Nhập kho)
```
Inbound Button → Modal Form → Input Data → API Call → Update Inventory
```

**Thông tin cần nhập:**
- Product Reference
- Location Code
- Quantity
- Notes

**Quy trình xử lý:**
1. Validate product và location tồn tại
2. Tạo warehouse movement record
3. Cập nhật inventory quantity
4. Log transaction

#### 3.2.2 Outbound (Xuất kho)
```
Outbound Button → Modal Form → Input Data → Check Availability → Update Inventory
```

**Validation rules:**
- Kiểm tra số lượng available
- Không được xuất quá số lượng tồn
- Cập nhật reserved quantity nếu cần

#### 3.2.3 Transfer (Chuyển kho)
```
Transfer Button → Select From/To Locations → Input Quantity → Execute Transfer
```

**Quy trình:**
1. Giảm quantity tại location nguồn
2. Tăng quantity tại location đích
3. Tạo 2 movement records (out + in)

#### 3.2.4 Stock Adjustment
```
Adjust Button → Current Quantity → New Quantity → Reason → Confirm
```

**Lý do điều chỉnh:**
- Physical count difference
- Damaged goods
- System correction
- Other reasons

### 3.3 Inventory Summary & Analytics
```
Summary API → Calculate Metrics → Display KPIs → Zone Analysis → ABC Analysis
```

**Metrics được tính:**
- Total Products: Tổng số sản phẩm unique
- Total Quantity: Tổng số lượng tồn kho
- Total Locations: Số vị trí được sử dụng
- By Zone: Phân bố theo 18 zones
- By ABC Code: Phân loại theo tần suất pick

---

## 🛒 4. LUỒNG QUẢN LÝ ORDERS

### 4.1 Order Management Workflow
```
Order Creation → Validation → Assignment → Picking → Completion → Shipping
```

### 4.2 Tạo đơn hàng mới
```
Create Order → Input Details → Add Items → Validate Inventory → Save Order
```

**Thông tin đơn hàng:**
- Order Number: Mã đơn hàng unique
- Customer Code: Mã khách hàng
- Priority: normal, high, urgent
- Items: Danh sách sản phẩm và số lượng

**Validation process:**
1. Kiểm tra customer code hợp lệ
2. Validate product references
3. Check inventory availability
4. Calculate total items

### 4.3 Order Status Flow
```
pending → assigned → picking → picked → shipped
```

**Chi tiết từng trạng thái:**

1. **Pending**: Đơn hàng mới tạo, chờ xử lý
2. **Assigned**: Đã gán cho operator/wave
3. **Picking**: Đang thực hiện picking
4. **Picked**: Đã pick xong, chờ đóng gói
5. **Shipped**: Đã xuất kho, giao hàng

### 4.4 Order Operations

#### 4.4.1 View Order Details
```
Order List → Click Order → Load Details → Show Items → Display Status
```

#### 4.4.2 Update Order Status
```
Select Order → Change Status → Validate Transition → Update Database
```

**Status transition rules:**
- pending → assigned (khi tạo wave)
- assigned → picking (khi bắt đầu pick)
- picking → picked (khi hoàn thành pick)
- picked → shipped (khi xuất kho)

#### 4.4.3 Cancel Order
```
Select Order → Cancel Button → Confirm → Update Status → Release Inventory
```

---

## 🚚 5. LUỒNG PICKING OPERATIONS

### 5.1 Picking Workflow Overview
```
Orders → Wave Creation → Task Generation → Route Optimization → Picking Execution → Completion
```

### 5.2 Wave Management

#### 5.2.1 Tạo Picking Wave
```
Create Wave → Select Orders → Assign Operator → Generate Tasks → Optimize Route
```

**Quy trình chi tiết:**
1. **Select Orders**: Chọn các orders có status "pending"
2. **Assign Operator**: Gán cho operator có sẵn
3. **Generate Tasks**: Tạo picking tasks cho từng item
4. **Route Optimization**: Sử dụng Genetic Algorithm để tối ưu route
5. **Wave Status**: created → in_progress → completed

#### 5.2.2 Wave Status Management
```
created → Start Wave → in_progress → Complete Tasks → completed
```

### 5.3 Picking Task Execution

#### 5.3.1 Task Assignment
```
Wave → Generate Tasks → Assign to Operator → Display Pick List
```

**Thông tin picking task:**
- Product Reference
- Location Code
- Quantity to Pick
- Priority/Sequence
- Estimated Time

#### 5.3.2 Pick Execution
```
Scan Location → Verify Product → Input Quantity → Record Time → Next Task
```

**Validation steps:**
1. Verify location code matches
2. Confirm product reference
3. Check quantity availability
4. Record actual quantity picked
5. Update picking time

#### 5.3.3 Task Completion
```
Complete Task → Update Status → Calculate Performance → Next Task/Complete Wave
```

### 5.4 Route Optimization

#### 5.4.1 Genetic Algorithm Process
```
Tasks → Calculate Distances → Generate Routes → Optimize → Best Route
```

**Optimization factors:**
- Distance between locations
- Pick sequence efficiency
- Zone clustering
- Operator walking time

#### 5.4.2 Performance Metrics
```
Original Route → Optimized Route → Calculate Improvement → Display Results
```

**Metrics tracked:**
- Original Distance vs Optimized Distance
- Improvement Percentage
- Estimated Time Savings
- Route Efficiency Score

---

## 🏭 6. LUỒNG WAREHOUSE MANAGEMENT

### 6.1 Storage Location Management
```
Location Setup → Zone Assignment → Capacity Configuration → Utilization Tracking
```

### 6.2 Warehouse Layout

#### 6.2.1 Zone Structure
```
18 Zones: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R
```

**Zone characteristics:**
- Each zone has multiple storage locations
- Location format: `{Zone}-{Row}-{Position}` (e.g., A-14-11)
- Capacity and occupancy tracking per location

#### 6.2.2 Layout Visualization
```
Warehouse Map → Zone Selection → Location Details → Occupancy Status
```

**Features:**
- 2D warehouse map visualization
- Zone-based color coding
- Occupancy heat map
- Location details on hover

### 6.3 Storage Strategy Configuration

#### 6.3.1 ABC Classification Setup
```
Configuration → Set Thresholds → Class A: 20%, Class B: 30%, Class C: 50%
```

#### 6.3.2 Storage Strategies
- **Class-based Storage**: High frequency items in accessible zones
- **Random Storage**: Items stored in any available location
- **Dedicated Storage**: Fixed locations for specific items
- **Hybrid Storage**: Combination of strategies

### 6.4 Warehouse Movements Tracking
```
All Movements → Movement Type → Location Changes → Audit Trail
```

**Movement types:**
- Inbound: Goods receiving
- Outbound: Goods shipping
- Transfer: Internal movements
- Adjustment: Stock corrections

---

## 🤖 7. LUỒNG AI OPTIMIZATION

### 7.1 AI Algorithms Overview
```
Data Collection → Algorithm Execution → Results Analysis → Recommendations
```

### 7.2 K-Means Clustering

#### 7.2.1 Product Classification
```
Order History → Frequency Analysis → K-Means Algorithm → ABC Classification
```

**Process:**
1. Analyze order frequency from Customer_Order.csv
2. Calculate product picking frequency
3. Apply K-Means clustering (k=3)
4. Classify into A, B, C categories
5. Compare with existing classifications
6. Calculate accuracy percentage

#### 7.2.2 Results & Recommendations
```
Classification Results → Storage Recommendations → Zone Assignments
```

### 7.3 Route Optimization

#### 7.3.1 Genetic Algorithm
```
Picking Tasks → Distance Matrix → Population Generation → Evolution → Best Route
```

**Algorithm steps:**
1. Create initial population of routes
2. Calculate fitness (total distance)
3. Selection, crossover, mutation
4. Evolve over generations
5. Return best route

#### 7.3.2 Performance Analysis
```
Original Route → Optimized Route → Improvement Calculation → Time Savings
```

### 7.4 DBSCAN Anomaly Detection
```
Product Data → Density Analysis → Cluster Formation → Outlier Detection
```

**Applications:**
- Identify unusual picking patterns
- Detect inventory anomalies
- Find optimization opportunities

### 7.5 AI Dashboard & Metrics
```
Real-time Calculation → Performance Metrics → Efficiency Scores → Recommendations
```

**Key metrics:**
- K-Means Accuracy: 57.2%
- Route Improvement: 22.1%
- Overall AI Efficiency: 73.5%
- Space Utilization: 71.9%

---

## 👥 8. LUỒNG OPERATOR MANAGEMENT

### 8.1 Operator Workflow
```
Operator Registration → Performance Tracking → Task Assignment → Evaluation
```

### 8.2 Operator Operations

#### 8.2.1 Create/Edit Operator
```
Operator Form → Input Details → Assign Shift → Set Status → Save
```

**Operator information:**
- Operator ID
- Name
- Status: active, inactive
- Shift: morning, afternoon, night
- Performance metrics

#### 8.2.2 Performance Tracking
```
Task Completion → Time Recording → Quality Assessment → Performance Score
```

**Metrics tracked:**
- Total picks completed
- Average pick time
- Accuracy rate
- Efficiency score

#### 8.2.3 Performance Analysis
```
Data Collection → Performance Calculation → Ranking → Improvement Recommendations
```

### 8.3 Operator Dashboard
```
Performance Charts → Individual Metrics → Comparison → Trends
```

---

## 📋 9. LUỒNG REPORTS & ANALYTICS

### 9.1 Report Generation Workflow
```
Report Selection → Parameter Input → Data Processing → Report Generation → Export
```

### 9.2 Available Reports

#### 9.2.1 Warehouse Summary Report
```
Warehouse Data → Utilization Analysis → Zone Breakdown → Performance Summary
```

**Content:**
- Warehouse overview
- Zone utilization
- Order statistics
- Picking performance

#### 9.2.2 Operator Performance Report
```
Operator Data → Performance Metrics → Comparison Analysis → Recommendations
```

#### 9.2.3 Inventory Analysis Report
```
Inventory Data → ABC Analysis → Zone Distribution → Low Stock Alerts
```

#### 9.2.4 AI Optimization Report
```
AI Metrics → Algorithm Performance → Optimization Results → ROI Analysis
```

### 9.3 Real-time Analytics
```
Live Data → Metric Calculation → Dashboard Update → Alert Generation
```

---

## ⚙️ 10. LUỒNG SYSTEM CONFIGURATION

### 10.1 Storage Configuration
```
Configuration Menu → ABC Thresholds → Storage Strategy → Zone Assignment
```

### 10.2 System Settings

#### 10.2.1 ABC Classification Thresholds
- Class A: Top 20% high-frequency items
- Class B: Next 30% medium-frequency items  
- Class C: Remaining 50% low-frequency items

#### 10.2.2 Storage Strategy Selection
- Class-based Storage
- Random Storage
- Dedicated Storage
- Hybrid Storage

#### 10.2.3 Zone Configuration
- High-frequency zone assignment
- Low-frequency zone assignment
- Capacity management

---

## 🔄 11. LUỒNG DATA FLOW & INTEGRATION

### 11.1 Data Architecture
```
CSV Datasets → Data Processing → Local Database → API Layer → Frontend
```

### 11.2 Database Integration

#### 11.2.1 Firebase Integration
```
Firebase Admin SDK → Firestore Database → Real-time Sync → Local Fallback
```

#### 11.2.2 Local Database Fallback
```
Firebase Failure → Local JSON Database → Seamless Operation → Data Sync
```

### 11.3 Real-time Data Updates
```
Data Change → Database Update → Metrics Recalculation → UI Refresh
```

**Update frequency:**
- Real-time: Immediate for user actions
- Periodic: Every 30 seconds for metrics
- Batch: Daily for heavy calculations

---

## 🚨 12. LUỒNG ERROR HANDLING & RECOVERY

### 12.1 Error Handling Strategy
```
Error Detection → Error Classification → Recovery Action → User Notification
```

### 12.2 Common Error Scenarios

#### 12.2.1 Database Connection Issues
```
Connection Failure → Local Database Fallback → Continue Operation → Sync Later
```

#### 12.2.2 Authentication Errors
```
Token Expiry → Auto Logout → Redirect to Login → Session Recovery
```

#### 12.2.3 Data Validation Errors
```
Invalid Input → Validation Message → User Correction → Retry Operation
```

### 12.3 System Recovery
```
Error Logging → Automatic Recovery → Manual Intervention → System Restore
```

---

## 📱 13. LUỒNG USER EXPERIENCE

### 13.1 Responsive Design
```
Device Detection → Layout Adaptation → Touch Optimization → Performance Tuning
```

### 13.2 User Interface Flow
```
Login → Dashboard → Navigation → Operations → Feedback → Logout
```

### 13.3 Accessibility Features
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode
- Font size adjustment

---

## 🔧 14. LUỒNG MAINTENANCE & MONITORING

### 14.1 System Monitoring
```
Health Checks → Performance Metrics → Error Tracking → Alert Generation
```

### 14.2 Maintenance Operations

#### 14.2.1 Data Backup
```
Scheduled Backup → Data Export → Storage → Verification → Recovery Testing
```

#### 14.2.2 Performance Optimization
```
Performance Analysis → Bottleneck Identification → Optimization → Testing
```

#### 14.2.3 System Updates
```
Update Planning → Testing → Deployment → Verification → Rollback Plan
```

---

## 🎯 15. BEST PRACTICES & RECOMMENDATIONS

### 15.1 Operational Best Practices

1. **Daily Operations**:
   - Check dashboard metrics every morning
   - Review pending orders and create waves
   - Monitor operator performance
   - Address low stock alerts

2. **Weekly Reviews**:
   - Analyze warehouse utilization
   - Review AI optimization results
   - Generate performance reports
   - Plan capacity adjustments

3. **Monthly Analysis**:
   - Comprehensive performance review
   - Storage strategy optimization
   - Operator training needs assessment
   - System configuration updates

### 15.2 Performance Optimization

1. **Inventory Management**:
   - Maintain optimal stock levels
   - Regular ABC classification review
   - Zone utilization balancing
   - Movement pattern analysis

2. **Picking Optimization**:
   - Use AI route optimization
   - Balance operator workloads
   - Monitor picking efficiency
   - Continuous improvement

3. **System Performance**:
   - Regular data cleanup
   - Performance monitoring
   - Capacity planning
   - Technology updates

---

## 📞 16. SUPPORT & TROUBLESHOOTING

### 16.1 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Login fails | Check credentials, clear browser cache |
| Dashboard not loading | Refresh page, check network connection |
| Charts not displaying | Verify Chart.js library, check console errors |
| Data not updating | Check API endpoints, verify database connection |
| Performance slow | Clear browser data, check server resources |

### 16.2 System Health Checks

**Daily checks:**
- Database connectivity
- API response times
- User authentication
- Data synchronization

**Weekly checks:**
- Performance metrics
- Error logs review
- Backup verification
- Security updates

---

## 🎓 17. TRAINING & ONBOARDING

### 17.1 User Training Program

#### 17.1.1 Admin Training (4 hours)
- System overview and architecture
- User management and permissions
- Configuration and settings
- Reports and analytics
- Troubleshooting

#### 17.1.2 Manager Training (3 hours)
- Dashboard navigation
- Inventory management
- Order processing
- Performance monitoring
- Report generation

#### 17.1.3 Operator Training (2 hours)
- Basic navigation
- Picking operations
- Task completion
- Performance tracking
- Mobile interface

### 17.2 Quick Start Guide

1. **First Login**: Use provided credentials
2. **Dashboard Tour**: Familiarize with main metrics
3. **Basic Operations**: Try inventory lookup
4. **Practice Tasks**: Complete sample picking wave
5. **Help Resources**: Access documentation and support

---

## 📈 18. FUTURE ENHANCEMENTS

### 18.1 Planned Features

1. **Mobile Application**:
   - Native iOS/Android apps
   - Barcode scanning
   - Offline capabilities
   - Push notifications

2. **Advanced AI**:
   - Machine learning predictions
   - Demand forecasting
   - Automated replenishment
   - Predictive maintenance

3. **Integration Capabilities**:
   - ERP system integration
   - WCS (Warehouse Control System)
   - Transportation management
   - Customer portals

4. **Enhanced Analytics**:
   - Advanced reporting
   - Business intelligence
   - Custom dashboards
   - Data visualization

### 18.2 Scalability Considerations

- Cloud deployment options
- Multi-warehouse support
- High availability setup
- Performance optimization
- Security enhancements

---

## 📋 SUMMARY

Hệ thống WMS cung cấp giải pháp toàn diện cho quản lý kho hàng với các tính năng:

✅ **Quản lý tồn kho** với real-time tracking
✅ **Xử lý đơn hàng** từ tạo đến xuất kho  
✅ **Tối ưu picking** với AI algorithms
✅ **Quản lý nhân sự** và performance tracking
✅ **Báo cáo phân tích** chi tiết và real-time
✅ **Cấu hình linh hoạt** theo nhu cầu doanh nghiệp

Hệ thống được thiết kế để tăng hiệu quả, giảm chi phí và cải thiện độ chính xác trong các hoạt động kho bãi.

---

*Tài liệu này được cập nhật thường xuyên. Vui lòng kiểm tra phiên bản mới nhất.*