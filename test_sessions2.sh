#!/bin/bash
echo "Logging in via direct auth-service port (8081)..."
curl -v -c cookies.txt -X POST http://localhost:8081/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dadaahouawe@gmail.com","password":"password123"}' > login_out.json 2>&1

echo "Cookie file:"
cat cookies.txt

echo "Checking database for user_sessions count..."
docker exec creativeai-postgres psql -U creativeai -d creativeai_auth -c "SELECT count(*) FROM user_sessions;"
