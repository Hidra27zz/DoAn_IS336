# Quick Commands Reference - WMS with AI

## Server Commands

```bash
# Start server
npm start

# Start with auto-reload (development)
npm run dev

# Run tests
node test-complete-system.js

# Import data (if needed)
node scripts/import-all-data-complete.js
```

## Access URLs

```
Main Application:     http://localhost:3000
2D Warehouse Map:     http://localhost:3000/warehouse/2d-map
Health Check:         http://localhost:3000/health
API Base:             http://localhost:3000/api
```

## Login Credentials

```
Username: admin
Password: admin123
Role: Administrator
```

## Quick API Tests (using curl)

### Authentication
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Save token
TOKEN="your_token_here"
```

### Warehouse Operations
```bash
# Get warehouse overview
curl http://localhost:3000/api/warehouse/overview \
  -H "Authorization: Bearer $TOKEN"

# Get 2D layout
curl "http://localhost:3000/api/warehouse/layout?include_inventory=true" \
  -H "Authorization: Bearer $TOKEN"

# Quick inbound
curl -X POST http://localhost:3000/api/warehouse/inbound \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "product_reference": "P001",
    "location_code": "A-01-01",
    "quantity": 10
  }'
```

### AI Operations
```bash
# K-Means clustering
curl -X POST http://localhost:3000/api/ai/clustering/kmeans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"k": 3}'

# DBSCAN clustering
curl -X POST http://localhost:3000/api/ai/clustering/dbscan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"epsilon": 0.8, "minPoints": 3}'

# Route optimization
curl -X POST http://localhost:3000/api/ai/route/optimize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"wave_id": null}'

# Storage analysis
curl http://localhost:3000/api/ai/storage/analyze \
  -H "Authorization: Bearer $TOKEN"

# Demand forecast
curl "http://localhost:3000/api/ai/demand/forecast?forecast_days=14" \
  -H "Authorization: Bearer $TOKEN"

# Predictive insights
curl "http://localhost:3000/api/ai/predictive/insights?time_horizon=14" \
  -H "Authorization: Bearer $TOKEN"

# Comprehensive AI analysis
curl "http://localhost:3000/api/ai/optimization/comprehensive" \
  -H "Authorization: Bearer $TOKEN"
```

### Data APIs
```bash
# Get products
curl "http://localhost:3000/api/products?limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Get locations
curl "http://localhost:3000/api/locations?limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Get inventory summary
curl http://localhost:3000/api/inventory/summary \
  -H "Authorization: Bearer $TOKEN"

# Get waves
curl "http://localhost:3000/api/waves?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

## Database Commands

```bash
# View database
sqlite3 warehouse.db

# Common queries
sqlite3 warehouse.db "SELECT COUNT(*) FROM products;"
sqlite3 warehouse.db "SELECT COUNT(*) FROM storage_locations;"
sqlite3 warehouse.db "SELECT COUNT(*) FROM inventory;"
sqlite3 warehouse.db "SELECT COUNT(*) FROM orders;"
```

## Testing Commands

```bash
# Run complete system test
node test-complete-system.js

# Test specific endpoint
curl http://localhost:3000/health

# Test AI algorithms
curl -X POST http://localhost:3000/api/ai/clustering/kmeans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"k": 3}'
```

## Troubleshooting Commands

```bash
# Check if server is running
curl http://localhost:3000/health

# Check database
ls -lh warehouse.db

# View server logs
npm start | tee server.log

# Check port usage
lsof -i :3000

# Kill process on port 3000 (if needed)
kill -9 $(lsof -t -i:3000)
```

## Development Commands

```bash
# Install dependencies
npm install

# Update dependencies
npm update

# Check for security issues
npm audit

# Fix security issues
npm audit fix
```

## Quick Feature Access

### Via Browser
```
Dashboard:           http://localhost:3000/
2D Map:              http://localhost:3000/warehouse/2d-map
Inventory:           http://localhost:3000/inventory
Orders:              http://localhost:3000/orders
Picking:             http://localhost:3000/picking
AI:                  http://localhost:3000/ai
Reports:             http://localhost:3000/reports
```

### Via API
```
Warehouse:           /api/warehouse/*
AI:                  /api/ai/*
Products:            /api/products
Locations:           /api/locations
Inventory:           /api/inventory/*
Orders:              /api/orders
Waves:               /api/waves
Picking:             /api/picking/*
```

## Performance Monitoring

```bash
# Check system metrics
curl http://localhost:3000/api/metrics/real-time

# Check AI performance
curl http://localhost:3000/api/public/ai/stats

# Check warehouse stats
curl http://localhost:3000/api/warehouse/overview \
  -H "Authorization: Bearer $TOKEN"
```

## Backup Commands

```bash
# Backup database
cp warehouse.db warehouse_backup_$(date +%Y%m%d_%H%M%S).db

# Restore database
cp warehouse_backup_YYYYMMDD_HHMMSS.db warehouse.db

# Export data
sqlite3 warehouse.db .dump > warehouse_dump.sql

# Import data
sqlite3 warehouse.db < warehouse_dump.sql
```

## Environment Variables

```bash
# Set port (default: 3000)
export PORT=3000

# Set JWT secret
export JWT_SECRET=your_secret_key

# Set node environment
export NODE_ENV=production
```

## Quick Checks

```bash
# Check if all services are running
curl http://localhost:3000/health && \
curl http://localhost:3000/api/health && \
curl http://localhost:3000/api/health/database

# Check data counts
echo "Products:" && sqlite3 warehouse.db "SELECT COUNT(*) FROM products;" && \
echo "Locations:" && sqlite3 warehouse.db "SELECT COUNT(*) FROM storage_locations;" && \
echo "Inventory:" && sqlite3 warehouse.db "SELECT COUNT(*) FROM inventory;" && \
echo "Orders:" && sqlite3 warehouse.db "SELECT COUNT(*) FROM orders;"

# Check AI endpoints
curl -X POST http://localhost:3000/api/ai/clustering/kmeans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"k": 3}' | jq '.success'
```

## Documentation Access

```bash
# View complete guide
cat COMPLETE_AI_WMS_GUIDE.md

# View quick guide (Vietnamese)
cat HUONG_DAN_SU_DUNG_NHANH.md

# View completion summary
cat SYSTEM_COMPLETION_SUMMARY.md

# View this file
cat QUICK_COMMANDS.md
```

---

**Quick Reference Version**: 1.0
**Last Updated**: December 30, 2024
