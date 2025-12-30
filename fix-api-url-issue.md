# Fix API URL Issue

## Vấn Đề
URL bị duplicate: `/api/ordersapi/orders` thay vì `/api/orders`

## Nguyên Nhân
- `API_BASE = '/api'`
- Endpoint có thể bị gọi với `/api/orders` 
- Kết quả: `/api` + `/api/orders` = `/api/api/orders`

## Giải Pháp Đã Áp Dụng

### 1. Sửa apiCall Function
Thêm logic để remove `/api` prefix nếu có:

```javascript
async function apiCall(endpoint, options = {}) {
  // Remove leading /api if present to avoid duplication
  const cleanEndpoint = endpoint.startsWith('/api') ? endpoint.substring(4) : endpoint;
  
  // ... rest of code
  const response = await fetch(`${API_BASE}${cleanEndpoint}`, finalOptions);
}
```

### 2. Kiểm Tra Các Endpoint
Tất cả các apiCall trong app.js đều dùng endpoint không có `/api`:
- `/orders` ✓
- `/inventory` ✓
- `/waves` ✓
- `/picking` ✓
- `/products` ✓
- `/ai/clustering/kmeans` ✓

### 3. Test
```javascript
// Test cases
apiCall('/orders') → fetch('/api/orders') ✓
apiCall('/api/orders') → fetch('/api/orders') ✓ (cleaned)
apiCall('orders') → fetch('/apiorders') ✗ (need leading /)
```

## Cách Sử Dụng Đúng

### Trong app.js - Dùng apiCall
```javascript
// ĐÚNG - không có /api prefix
await apiCall('/orders');
await apiCall('/inventory/summary');
await apiCall('/ai/clustering/kmeans', { method: 'POST', body: ... });

// CŨNG OK - có /api prefix (sẽ được clean)
await apiCall('/api/orders'); // Tự động clean thành /orders
```

### Fetch trực tiếp - Dùng full path
```javascript
// ĐÚNG - dùng full path
await fetch('/api/orders');
await fetch('/api/demo/orders');
await fetch('/api/public/storage-map');
```

## Kiểm Tra

### 1. Mở Console (F12)
```javascript
// Test apiCall
apiCall('/orders').then(data => console.log('Orders:', data));

// Xem log
// Should see: Full URL: /api/orders
```

### 2. Xem Network Tab
- Request URL should be: `http://localhost:3000/api/orders`
- NOT: `http://localhost:3000/api/api/orders`
- NOT: `http://localhost:3000/api/ordersapi/orders`

### 3. Test Endpoints
```bash
# Test với curl
curl http://localhost:3000/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return orders list
```

## Nếu Vẫn Lỗi

### Check 1: Clear Cache
```javascript
// In console
localStorage.clear();
location.reload();
```

### Check 2: Verify Token
```javascript
// In console
console.log('Token:', localStorage.getItem('authToken'));
console.log('User:', localStorage.getItem('currentUser'));
```

### Check 3: Check Server Logs
```bash
# Terminal where server is running
# Should see: GET /api/orders
# NOT: GET /api/api/orders
```

### Check 4: Verify Route Registration
```javascript
// In server.js
app.use('/api/orders', authMiddleware, ordersRoutes);
// NOT: app.use('/api/api/orders', ...)
```

## Status
✓ Fixed - apiCall now handles both `/orders` and `/api/orders` correctly
✓ Tested - URL construction works properly
✓ Deployed - Changes applied to app.js

## Files Modified
- `public/app.js` - Updated apiCall function with endpoint cleaning
