#!/bin/bash
RESPONSE=$(curl -s -X POST http://localhost:8480/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dadaahouawe@gmail.com","password":"password123"}')
  
# Wait, AuthController cleanResponse removes token from body! It's in the cookie!
# Let's get the cookie instead.
curl -v -c cookies.txt -X POST http://localhost:8480/api/auth/login -H "Content-Type: application/json" -d '{"email":"dadaahouawe@gmail.com","password":"password123"}' > /dev/null 2>&1

echo "Got cookie, making request to /sessions..."
curl -v -b cookies.txt http://localhost:8480/api/auth/api/users/sessions
