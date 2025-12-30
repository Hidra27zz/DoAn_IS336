# AI Features trong WMS System

## 1. AI Command Center (Trung tâm AI)
**Vị trí:** Menu > AI Command Center
**Chức năng:**
- K-Means Clustering: Nhóm sản phẩm theo đặc điểm
- DBSCAN: Phát hiện outliers
- Route Optimization: Tối ưu đường đi picking
- Demand Forecasting: Dự đoán nhu cầu
- Storage Optimization: Tối ưu vị trí lưu trữ

## 2. AI trên 2D Warehouse Map
**Vị trí:** Warehouse > 2D Map > nút "AI Optimize"
**Chức năng:**
- Hotspot Detection: Phát hiện khu vực hot
- Storage Optimization: Đề xuất vị trí tốt nhất
- Capacity Prediction: Dự đoán công suất
- Route Optimization: Tối ưu route picking
- Anomaly Detection: Phát hiện bất thường

## 3. AI Insights trong Reports
**Vị trí:** Reports > Warehouse Summary / Operator Performance
**Chức năng:**
- Phân tích utilization
- Phát hiện backlog
- Đề xuất actions
- Recommendations tự động

## 4. Storage Strategy Config
**Vị trí:** Storage Config
**Trạng thái:** DEMO ONLY - không kết nối backend
**Mục đích:** UI prototype cho ABC classification

## Vấn đề hiện tại:
- Storage Config chỉ là UI, không có logic backend
- Reports có nhiều giá trị 0/undefined do query sai
- Cần sửa reports để hiển thị đúng dữ liệu
