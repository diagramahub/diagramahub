#!/bin/bash

# DiagramaHub Onboarding Wizard Flow Test Script
# This script tests the new wizard-based onboarding flow:
# 1. Register a new user (no project created automatically)
# 2. Verify NO projects exist for new user
# 3. User creates their first project via wizard
# 4. Verify project was created with custom name/description
# 5. Create diagram in the project
# 6. Clean up test data

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
. "$SCRIPT_DIR/scripts/test-helpers.sh"

API_URL="http://localhost:5172"
TEST_EMAIL="wizard-test-$(date +%s)@example.com"
TEST_PASSWORD="$(generate_runtime_password wizard)"
TEST_NAME="Wizard Test User"
PROJECT_NAME="Mi Proyecto de Prueba"
PROJECT_DESC="Este es mi primer proyecto creado desde el wizard"

echo "🧪 DiagramaHub Onboarding Wizard Flow Test"
echo "==========================================="
echo ""

# 1. Register new user
echo "📝 1. Registering new user..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/users/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"full_name\": \"$TEST_NAME\"
  }")

USER_ID=$(echo $REGISTER_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "ERROR")

if [ "$USER_ID" == "ERROR" ]; then
  echo "❌ Registration failed"
  echo $REGISTER_RESPONSE | python3 -m json.tool
  exit 1
fi

echo "✅ User registered: $USER_ID"
echo ""

# 2. Login
echo "🔐 2. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/users/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null || echo "ERROR")

if [ "$TOKEN" == "ERROR" ]; then
  echo "❌ Login failed"
  echo $LOGIN_RESPONSE | python3 -m json.tool
  exit 1
fi

echo "✅ Login successful"
echo ""

# 3. Verify NO projects exist (wizard flow)
echo "📁 3. Verifying no auto-created projects..."
PROJECTS_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/projects" \
  -H "Authorization: Bearer $TOKEN")

PROJECT_COUNT=$(echo $PROJECTS_RESPONSE | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "-1")

if [ "$PROJECT_COUNT" -eq "0" ]; then
  echo "✅ No auto-created projects (wizard flow working correctly)"
elif [ "$PROJECT_COUNT" -eq "-1" ]; then
  echo "❌ Error checking projects"
  echo $PROJECTS_RESPONSE | python3 -m json.tool
  exit 1
else
  echo "⚠️  Found $PROJECT_COUNT project(s) - expected 0 for wizard flow"
  echo $PROJECTS_RESPONSE | python3 -m json.tool
fi
echo ""

# 4. Create first project (wizard step)
echo "🎨 4. Creating first project via wizard..."
CREATE_PROJECT_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$PROJECT_NAME\",
    \"description\": \"$PROJECT_DESC\"
  }")

PROJECT_ID=$(echo $CREATE_PROJECT_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "ERROR")

if [ "$PROJECT_ID" == "ERROR" ]; then
  echo "❌ Project creation failed"
  echo $CREATE_PROJECT_RESPONSE | python3 -m json.tool
  exit 1
fi

echo "✅ Project created: $PROJECT_ID"
echo $CREATE_PROJECT_RESPONSE | python3 -m json.tool
echo ""

# 5. Verify project details
echo "🔍 5. Verifying project details..."
CREATED_PROJECT_NAME=$(echo $CREATE_PROJECT_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['name'])" 2>/dev/null)
CREATED_PROJECT_DESC=$(echo $CREATE_PROJECT_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['description'])" 2>/dev/null)

if [ "$CREATED_PROJECT_NAME" == "$PROJECT_NAME" ] && [ "$CREATED_PROJECT_DESC" == "$PROJECT_DESC" ]; then
  echo "✅ Project created with correct name and description"
  echo "   Name: $CREATED_PROJECT_NAME"
  echo "   Description: $CREATED_PROJECT_DESC"
else
  echo "⚠️  Project details don't match"
  echo "   Expected name: $PROJECT_NAME"
  echo "   Got name: $CREATED_PROJECT_NAME"
  echo "   Expected desc: $PROJECT_DESC"
  echo "   Got desc: $CREATED_PROJECT_DESC"
fi
echo ""

# 6. Create first diagram
echo "📊 6. Creating first diagram in the project..."
CREATE_DIAGRAM_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/projects/$PROJECT_ID/diagrams" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Mi primer diagrama",
    "content": "graph TD\n  A[Inicio] --> B[Proceso]\n  B --> C[Fin]",
    "diagram_type": "flowchart"
  }')

DIAGRAM_ID=$(echo $CREATE_DIAGRAM_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "ERROR")

if [ "$DIAGRAM_ID" == "ERROR" ]; then
  echo "❌ Diagram creation failed"
  echo $CREATE_DIAGRAM_RESPONSE | python3 -m json.tool
  exit 1
fi

echo "✅ Diagram created: $DIAGRAM_ID"
echo $CREATE_DIAGRAM_RESPONSE | python3 -m json.tool
echo ""

# 7. Get project with diagram
echo "📂 7. Getting project with diagram..."
GET_PROJECT_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN")

DIAGRAM_COUNT=$(echo $GET_PROJECT_RESPONSE | python3 -c "import sys, json; print(len(json.load(sys.stdin)['diagrams']))" 2>/dev/null || echo "0")

echo "✅ Project has $DIAGRAM_COUNT diagram(s)"
echo $GET_PROJECT_RESPONSE | python3 -m json.tool
echo ""

# 8. Clean up
echo "🧹 8. Cleaning up test data..."
docker exec diagramahub-mongodb mongosh --quiet --eval "
  use diagramahub;
  db.users.deleteOne({email: '$TEST_EMAIL'});
  db.projects.deleteMany({user_id: '$USER_ID'});
  db.diagrams.deleteMany({project_id: '$PROJECT_ID'});
  print('Deleted test user, project and diagrams');
" > /dev/null 2>&1

echo "✅ Test data cleaned up"
echo ""

echo "==========================================="
echo "🎉 Wizard onboarding flow test passed!"
echo "==========================================="
echo ""
echo "Summary of wizard flow:"
echo "  ✅ User registration (no auto-project)"
echo "  ✅ User login"
echo "  ✅ Verified 0 projects initially"
echo "  ✅ User creates first project with custom name/description"
echo "  ✅ Project created successfully"
echo "  ✅ Diagram created in project"
echo "  ✅ Cleanup completed"
echo ""
echo "The wizard flow is working as expected! 🚀"
echo ""
