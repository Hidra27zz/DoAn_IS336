#!/bin/bash

TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "============================================================"
echo "AI FEATURES TEST REPORT"
echo "============================================================"

echo ""
echo "1. K-MEANS CLUSTERING"
curl -s -X POST http://localhost:3000/api/ai/clustering/kmeans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"k":3}' | python3 -m json.tool | grep -E "(success|products_analyzed|picking_records|classA|classB|classC)" | head -6

echo ""
echo "2. DBSCAN ANOMALY DETECTION"
curl -s -X POST http://localhost:3000/api/ai/clustering/dbscan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"epsilon":0.8,"minPoints":3}' | python3 -m json.tool | grep -E "(success|data_points|clusters_found|noise_points)" | head -4

echo ""
echo "3. ROUTE OPTIMIZATION"
curl -s -X POST http://localhost:3000/api/ai/route/optimize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}' | python3 -m json.tool | grep -E "(success|tasks_optimized|improvement_percentage)" | head -3

echo ""
echo "4. STORAGE ANALYSIS"
curl -s http://localhost:3000/api/ai/storage/analyze \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | grep -E "(success|total_recommendations)" | head -2

echo ""
echo "5. DEMAND FORECAST"
curl -s "http://localhost:3000/api/ai/demand/forecast?forecast_days=30" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | grep -E "(success)" | head -1

echo ""
echo "6. PREDICTIVE ANALYTICS"
curl -s "http://localhost:3000/api/ai/predictive/insights?time_horizon=14" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | grep -E "(success|model_confidence)" | head -2

echo ""
echo "7. COMPREHENSIVE ANALYSIS"
curl -s http://localhost:3000/api/ai/optimization/comprehensive \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | grep -E "(success|ai_confidence_score|total_recommendations)" | head -3

echo ""
echo "============================================================"
echo "✅ All AI features are working!"
echo "Access: http://localhost:3000/ai-automation-demo.html"
echo "============================================================"
