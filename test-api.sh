#!/bin/bash

# Script para probar todas las APIs del backend de Diagramahub
# Uso: ./test-api.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
. "$SCRIPT_DIR/scripts/test-helpers.sh"

API_URL="http://localhost:5172"
RANDOM_EMAIL="test$(date +%s)@example.com"
PASSWORD="$(generate_runtime_password api)"
WRONG_PASSWORD="$(generate_runtime_password wrong)"

echo "🚀 Iniciando pruebas de API de Diagramahub..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${BLUE}📊 Test 1: Health Check${NC}"
HEALTH=$(curl -s $API_URL/health)
if echo "$HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    exit 1
fi
echo ""

# Test 2: Root endpoint
echo -e "${BLUE}📊 Test 2: Root Endpoint${NC}"
ROOT=$(curl -s $API_URL/)
if echo "$ROOT" | grep -q "Diagramahub"; then
    echo -e "${GREEN}✓ Root endpoint passed${NC}"
else
    echo -e "${RED}✗ Root endpoint failed${NC}"
    exit 1
fi
echo ""

# Test 3: Register User
echo -e "${BLUE}📊 Test 3: Register User${NC}"
echo "Email: $RANDOM_EMAIL"
REGISTER=$(curl -s -X POST $API_URL/api/v1/users/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$PASSWORD\",\"full_name\":\"Test User\"}")

if echo "$REGISTER" | grep -q "email"; then
    echo -e "${GREEN}✓ User registration passed${NC}"
    USER_ID=$(echo $REGISTER | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    echo "User ID: $USER_ID"
else
    echo -e "${RED}✗ User registration failed${NC}"
    echo "$REGISTER"
    exit 1
fi
echo ""

# Test 4: Register Duplicate User (Should Fail)
echo -e "${BLUE}📊 Test 4: Register Duplicate User (Should Fail)${NC}"
DUPLICATE=$(curl -s -X POST $API_URL/api/v1/users/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$PASSWORD\",\"full_name\":\"Test User\"}")

if echo "$DUPLICATE" | grep -q "already exists"; then
    echo -e "${GREEN}✓ Duplicate user validation passed${NC}"
else
    echo -e "${RED}✗ Duplicate user validation failed${NC}"
    echo "$DUPLICATE"
fi
echo ""

# Test 5: Login
echo -e "${BLUE}📊 Test 5: Login${NC}"
LOGIN=$(curl -s -X POST $API_URL/api/v1/users/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$PASSWORD\"}")

if echo "$LOGIN" | grep -q "access_token"; then
    echo -e "${GREEN}✓ Login passed${NC}"
    TOKEN=$(echo $LOGIN | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    echo "Token: ${TOKEN:0:50}..."
else
    echo -e "${RED}✗ Login failed${NC}"
    echo "$LOGIN"
    exit 1
fi
echo ""

# Test 6: Login with Wrong Password (Should Fail)
echo -e "${BLUE}📊 Test 6: Login with Wrong Password (Should Fail)${NC}"
WRONG_LOGIN=$(curl -s -X POST $API_URL/api/v1/users/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$WRONG_PASSWORD\"}")

if echo "$WRONG_LOGIN" | grep -q "Incorrect"; then
    echo -e "${GREEN}✓ Wrong password validation passed${NC}"
else
    echo -e "${RED}✗ Wrong password validation failed${NC}"
    echo "$WRONG_LOGIN"
fi
echo ""

# Test 7: Get Current User
echo -e "${BLUE}📊 Test 7: Get Current User${NC}"
CURRENT_USER=$(curl -s -X GET $API_URL/api/v1/users/me \
    -H "Authorization: Bearer $TOKEN")

if echo "$CURRENT_USER" | grep -q "$RANDOM_EMAIL"; then
    echo -e "${GREEN}✓ Get current user passed${NC}"
    echo "User: $(echo $CURRENT_USER | grep -o '"full_name":"[^"]*"' | cut -d'"' -f4)"
else
    echo -e "${RED}✗ Get current user failed${NC}"
    echo "$CURRENT_USER"
    exit 1
fi
echo ""

# Test 8: Get Current User Without Token (Should Fail)
echo -e "${BLUE}📊 Test 8: Get Current User Without Token (Should Fail)${NC}"
NO_AUTH=$(curl -s -X GET $API_URL/api/v1/users/me)

if echo "$NO_AUTH" | grep -q "Not authenticated"; then
    echo -e "${GREEN}✓ Authentication validation passed${NC}"
else
    echo -e "${RED}✗ Authentication validation failed${NC}"
    echo "$NO_AUTH"
fi
echo ""

# Test 9: Change Password
echo -e "${BLUE}📊 Test 9: Change Password${NC}"
NEW_PASSWORD="$(generate_runtime_password changed)"
CHANGE_PWD=$(curl -s -X PUT $API_URL/api/v1/users/change-password \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"current_password\":\"$PASSWORD\",\"new_password\":\"$NEW_PASSWORD\"}")

if echo "$CHANGE_PWD" | grep -q "successfully"; then
    echo -e "${GREEN}✓ Change password passed${NC}"
else
    echo -e "${RED}✗ Change password failed${NC}"
    echo "$CHANGE_PWD"
fi
echo ""

# Test 10: Login with New Password
echo -e "${BLUE}📊 Test 10: Login with New Password${NC}"
NEW_LOGIN=$(curl -s -X POST $API_URL/api/v1/users/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$NEW_PASSWORD\"}")

if echo "$NEW_LOGIN" | grep -q "access_token"; then
    echo -e "${GREEN}✓ Login with new password passed${NC}"
else
    echo -e "${RED}✗ Login with new password failed${NC}"
    echo "$NEW_LOGIN"
    exit 1
fi
echo ""

# Test 11: Password Reset Request
echo -e "${BLUE}📊 Test 11: Password Reset Request${NC}"
RESET_REQUEST=$(curl -s -X POST $API_URL/api/v1/users/reset-password-request \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$RANDOM_EMAIL\"}")

if echo "$RESET_REQUEST" | grep -q "token"; then
    echo -e "${GREEN}✓ Password reset request passed${NC}"
    RESET_TOKEN=$(echo $RESET_REQUEST | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "Reset Token: ${RESET_TOKEN:0:50}..."
else
    echo -e "${RED}✗ Password reset request failed${NC}"
    echo "$RESET_REQUEST"
fi
echo ""

# Test 12: Password Reset Confirm
if [ ! -z "$RESET_TOKEN" ] && [ "$RESET_TOKEN" != "null" ]; then
    echo -e "${BLUE}📊 Test 12: Password Reset Confirm${NC}"
    FINAL_PASSWORD="$(generate_runtime_password reset)"
    RESET_CONFIRM=$(curl -s -X POST $API_URL/api/v1/users/reset-password-confirm \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$RANDOM_EMAIL\",\"token\":\"$RESET_TOKEN\",\"new_password\":\"$FINAL_PASSWORD\"}")

    if echo "$RESET_CONFIRM" | grep -q "successfully"; then
        echo -e "${GREEN}✓ Password reset confirm passed${NC}"

        # Test login with final password
        FINAL_LOGIN=$(curl -s -X POST $API_URL/api/v1/users/login \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$FINAL_PASSWORD\"}")

        if echo "$FINAL_LOGIN" | grep -q "access_token"; then
            echo -e "${GREEN}✓ Login with reset password passed${NC}"
        else
            echo -e "${RED}✗ Login with reset password failed${NC}"
        fi
    else
        echo -e "${RED}✗ Password reset confirm failed${NC}"
        echo "$RESET_CONFIRM"
    fi
    echo ""
fi

echo ""
echo -e "${GREEN}🎉 Todas las pruebas completadas exitosamente!${NC}"
echo ""
echo "Resumen:"
echo "  - Email de prueba: $RANDOM_EMAIL"
echo "  - Usuario ID: $USER_ID"
echo "  - Backend URL: $API_URL"
echo "  - Docs: $API_URL/docs"
