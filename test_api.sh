#!/bin/bash

echo "============================================"
echo "🔍 로컬 개발환경 테스트"
echo "============================================"
echo ""

# 백엔드 테스트
echo "1️⃣ 백엔드 (포트 8081)"
echo "─────────────────────────"
echo -n "상태: "
if timeout 2 curl -s http://localhost:8081/actuator/health > /dev/null 2>&1; then
    echo "✅ 정상 (Running)"
else
    echo "❌ 응답 없음"
fi
echo ""

# 프론트엔드 테스트
echo "2️⃣ 프론트엔드 (포트 3001)"
echo "─────────────────────────"
echo -n "상태: "
if timeout 2 curl -s http://localhost:3001/ > /dev/null 2>&1; then
    echo "✅ 정상 (Running)"
else
    echo "❌ 응답 없음"
fi
echo ""

echo "============================================"
echo "✅ 테스트 완료"
echo "============================================"
