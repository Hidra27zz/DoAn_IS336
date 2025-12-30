# PHÂN TÍCH VẤN ĐỀ SIZE GIÀY

**Ngày:** 30/12/2025  
**Vấn đề:** Size giày lưu sai format trong database

---

## PHÁT HIỆN TỪ CSV FILES

### 1. Picking_Wave.csv - ✅ ĐÚNG FORMAT
```
Size (US);quantityToPick
9.0;1
9.5;1
10.0;1
10.5;1
11.0;1
13.0;1
8.5;1
```
**Kết luận:** File này có size đúng format decimal (8.5, 9.5, 10.5, 11.0)

### 2. Customer_Order.csv - ❌ SAI FORMAT
```
Size (US);quantity
9;6        ← Đúng (size 9)
13;1       ← Đúng (size 13)
105;1      ← SAI! Phải là 10.5
13;1       ← Đúng (size 13)
11;1       ← Đúng (size 11)
10;1       ← Đúng (size 10)
85;1       ← SAI! Phải là 8.5
10;1       ← Đúng (size 10)
11;1       ← Đúng (size 11)
95;7       ← SAI! Phải là 9.5
85;3       ← SAI! Phải là 8.5
95;5       ← SAI! Phải là 9.5
105;1      ← SAI! Phải là 10.5
```

**Kết luận:** File này có MIX giữa size đúng (9, 10, 11, 13) và size SAI (85, 95, 105, 115)

### 3. Class_Based_Storage.csv - ✅ ĐÚNG FORMAT
```
Location;ABCCOD;Products with sizes
A-14-11;C;"8551FLX;15.0";"C5O9C9;4.0";"VF002;9.5"
```
**Kết luận:** File này có size đúng format (9.5, 10.0, 15.0)

---

## PHÂN TÍCH VẤN ĐỀ

### Pattern Nhận Diện
Size SAI có pattern:
- **85** → Phải là **8.5**
- **95** → Phải là **9.5**
- **105** → Phải là **10.5**
- **115** → Phải là **11.5**
- **125** → Phải là **12.5**
- **135** → Phải là **13.5**
- **145** → Phải là **14.5**
- **155** → Phải là **15.5**

### Logic Chuyển Đổi
```javascript
function convertSize(size) {
  const num = parseInt(size);
  
  // Nếu size >= 35 và kết thúc bằng 5 (85, 95, 105, 115...)
  if (num >= 35 && num % 10 === 5) {
    return (num / 10).toFixed(1);  // 85 / 10 = 8.5
  }
  
  return size;  // Giữ nguyên size khác (8, 9, 10, 11, 12, 13)
}
```

### Ví Dụ Chuyển Đổi
| Size Cũ | Kiểm Tra | Kết Quả | Size Mới |
|---------|----------|---------|----------|
| 85      | 85 >= 35 && 85 % 10 === 5 | ✅ True | 8.5 |
| 95      | 95 >= 35 && 95 % 10 === 5 | ✅ True | 9.5 |
| 105     | 105 >= 35 && 105 % 10 === 5 | ✅ True | 10.5 |
| 115     | 115 >= 35 && 115 % 10 === 5 | ✅ True | 11.5 |
| 8       | 8 >= 35 | ❌ False | 8 (giữ nguyên) |
| 9       | 9 >= 35 | ❌ False | 9 (giữ nguyên) |
| 10      | 10 >= 35 | ❌ False | 10 (giữ nguyên) |
| 11      | 11 >= 35 | ❌ False | 11 (giữ nguyên) |
| 13      | 13 >= 35 | ❌ False | 13 (giữ nguyên) |

---

## TÁC ĐỘNG

### Tables Bị Ảnh Hưởng
1. **order_items** - Chứa size từ Customer_Order.csv
2. **picking_tasks** - Chứa size từ Picking_Wave.csv (có thể đã đúng)

### Dữ Liệu Cần Kiểm Tra
- Tổng số records có size
- Số lượng size cần chuyển đổi
- Phân bố size trong database

---

## GIẢI PHÁP

### Bước 1: Kiểm Tra Dữ Liệu Hiện Tại
```bash
node check-size-data.js
```

Script này sẽ:
- Liệt kê tất cả size trong order_items
- Liệt kê tất cả size trong picking_tasks
- Đánh dấu size nào cần chuyển đổi
- Đếm tổng số records cần cập nhật

### Bước 2: Chuyển Đổi Size
```bash
node fix-shoe-sizes-simple.js
```

Script này sẽ:
- Hiện preview các size sẽ được chuyển đổi
- Cập nhật order_items table
- Cập nhật picking_tasks table
- Hiện kết quả sau khi chuyển đổi

### Bước 3: Xác Nhận Kết Quả
```bash
node check-size-data.js
```

Chạy lại để xác nhận không còn size nào cần chuyển đổi.

---

## VÍ DỤ THỰC TẾ

### Trước Khi Chuyển Đổi
```sql
SELECT order_number, product_reference, size, quantity
FROM order_items
WHERE size IN ('85', '95', '105', '115')
LIMIT 5;
```

Kết quả:
```
124438 | 0LNUOV  | 85  | 1
124437 | 05W6TK  | 95  | 7
124437 | M8W7TS  | 85  | 3
124437 | 05W6TK  | 95  | 5
124436 | 7BU1V7  | 105 | 1
```

### Sau Khi Chuyển Đổi
```sql
SELECT order_number, product_reference, size, quantity
FROM order_items
WHERE size IN ('8.5', '9.5', '10.5', '11.5')
LIMIT 5;
```

Kết quả:
```
124438 | 0LNUOV  | 8.5  | 1
124437 | 05W6TK  | 9.5  | 7
124437 | M8W7TS  | 8.5  | 3
124437 | 05W6TK  | 9.5  | 5
124436 | 7BU1V7  | 10.5 | 1
```

---

## LƯU Ý QUAN TRỌNG

### 1. Backup Trước Khi Chạy
Database đã có backup tự động, nhưng nên tạo thêm:
```bash
cp warehouse.db warehouse_backup_before_size_fix.db
```

### 2. Size Không Bị Ảnh Hưởng
Các size sau sẽ KHÔNG bị thay đổi:
- Size nguyên: 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
- Size decimal đúng: 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5

### 3. Chỉ Chuyển Đổi Size Sai
Chỉ có size theo pattern 85, 95, 105, 115... (>= 35 và kết thúc bằng 5) mới được chuyển đổi.

---

## KIỂM TRA NGAY

Chạy lệnh này để xem database hiện tại có bao nhiêu size cần chuyển đổi:

```bash
node check-size-data.js
```

Nếu có size cần chuyển đổi, chạy:

```bash
node fix-shoe-sizes-simple.js
```

---

## TÓM TẮT

**Vấn đề:** Size giày trong Customer_Order.csv được lưu sai format (85 thay vì 8.5)  
**Nguyên nhân:** Dữ liệu CSV gốc có lỗi format  
**Giải pháp:** Script tự động chuyển đổi 85→8.5, 95→9.5, 105→10.5, etc.  
**Tác động:** Chỉ ảnh hưởng order_items và picking_tasks tables  
**An toàn:** Script có transaction, rollback nếu lỗi  

**Hành động:** Chạy `node check-size-data.js` để kiểm tra ngay!
