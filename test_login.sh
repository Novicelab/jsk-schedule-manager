#!/bin/bash

echo "============================================"
echo "🔐 ID/PW 로그인 API 테스트"
echo "============================================"
echo ""

# 테스트 계정 정보
ACCOUNTS=(
  "admin:admin:admin 등급"
  "siljang:siljang:manager 등급"
  "user:user:일반 팀원"
)

for account in "${ACCOUNTS[@]}"; do
  IFS=':' read -r username password role <<< "$account"
  
  echo "🔑 $username 로그인 시도 ($role)"
  echo "─────────────────────────"
  
  response=$(curl -s -X POST http://localhost:8081/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$username\",\"password\":\"1234\"}")
  
  # 응답 확인
  if echo "$response" | grep -q "accessToken"; then
    echo "✅ 로그인 성공!"
    accessToken=$(echo "$response" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    userName=$(echo "$response" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
    userRole=$(echo "$response" | grep -o '"role":"[^"]*' | cut -d'"' -f4)
    echo "   - 사용자: $userName"
    echo "   - 권한: $userRole"
    echo "   - 토큰: ${accessToken:0:30}..."
  else
    echo "❌ 로그인 실패"
    echo "   응답: $response"
  fi
  
  echo ""
done

echo "============================================"
echo "✅ 로그인 테스트 완료"
echo "============================================"
