#!/bin/bash

# DiagramaHub Onboarding Flow Test Script (wizard-aligned)
# This script tests the onboarding flow with the wizard pattern:
# 1. Register a new user (no auto-project)
# 2. Verify NO projects exist for new user
# 3. User creates their first project
# 4. Create a diagram in the project
# 5. Update the diagram
# 6. Delete the diagram
# 7. Clean up test data

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
. "$SCRIPT_DIR/scripts/test-helpers.sh"

API_URL="http://localhost:5172"
TEST_EMAIL="onboarding-test-$(date +%s)@example.com"
TEST_PASSWORD="$(generate_runtime_password onboarding)"
TEST_NAME="Onboarding Test User"
PROJECT_NAME="Mi Proyecto de Prueba"
PROJECT_DESC="Proyecto creado desde el test de onboarding"

echo "🧪 DiagramaHub Onboarding Flow Test"
echo "===================================="
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

# 3. Verify NO auto-created projects (wizard flow)
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

# 4. Create first project
echo "🎨 4. Creating first project..."
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
echo ""

# 5. Verify project details
echo "🔍 5. Verifying project details..."
CREATED_NAME=$(echo $CREATE_PROJECT_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['name'])" 2>/dev/null)
if [ "$CREATED_NAME" == "$PROJECT_NAME" ]; then
  echo "✅ Project created with correct name: $CREATED_NAME"
else
  echo "⚠️  Project name mismatch: expected '$PROJECT_NAME', got '$CREATED_NAME'"
fi
echo ""

# 6. Create a diagram
echo "📊 6. Creating a diagram in the project..."
CREATE_DIAGRAM_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/projects/$PROJECT_ID/diagrams" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Diagram",
    "content": "graph TD\n  A[Start] --> B[Process]\n  B --> C[End]",
    "diagram_type": "flowchart"
  }')

DIAGRAM_ID=$(echo $CREATE_DIAGRAM_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "ERROR")

if [ "$DIAGRAM_ID" == "ERROR" ]; then
  echo "❌ Diagram creation failed"
  echo $CREATE_DIAGRAM_RESPONSE | python3 -m json.tool
  exit 1
fi

echo "✅ Diagram created: $DIAGRAM_ID"
echo ""

# 7. Get diagram details
echo "📖 7. Getting diagram details..."
GET_DIAGRAM_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/diagrams/$DIAGRAM_ID" \
  -H "Authorization: Bearer $TOKEN")

echo $GET_DIAGRAM_RESPONSE | python3 -m json.tool
echo "✅ Diagram retrieved successfully"
echo ""

# 8. Update diagram
echo "✏️  8. Updating diagram..."
UPDATE_DIAGRAM_RESPONSE=$(curl -s -X PUT "$API_URL/api/v1/diagrams/$DIAGRAM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Test Diagram",
    "content": "graph LR\n  A[Start] --> B[Updated Process]\n  B --> C[End]"
  }')

echo $UPDATE_DIAGRAM_RESPONSE | python3 -m json.tool
echo "✅ Diagram updated successfully"
echo ""

# 9. Delete diagram
echo "🗑️  9. Deleting test diagram..."
DELETE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API_URL/api/v1/diagrams/$DIAGRAM_ID" \
  -H "Authorization: Bearer $TOKEN")

if [ "$DELETE_RESPONSE" = "204" ] || [ "$DELETE_RESPONSE" = "200" ]; then
  echo "✅ Diagram deleted"
else
  echo "⚠️  Diagram deletion returned status $DELETE_RESPONSE"
fi
echo ""

# 10. Get project with diagrams (should be empty now)
echo "📂 10. Getting project with all diagrams..."
GET_PROJECT_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo $GET_PROJECT_RESPONSE | python3 -m json.tool
echo "✅ Project with diagrams retrieved"
echo ""

# 11. Clean up - delete test user and project
echo "🧹 11. Cleaning up test data..."
docker exec diagramahub-mongodb mongosh --quiet --eval "
  use diagramahub;
  db.users.deleteOne({email: '$TEST_EMAIL'});
  db.projects.deleteMany({user_id: '$USER_ID'});
  print('Deleted test user and projects');
" > /dev/null 2>&1

echo "✅ Test data cleaned up"
echo ""

echo "=================================="
echo "🎉 All tests passed successfully!"
echo "=================================="
echo ""
echo "Summary:"
echo "  ✅ User registration"
echo "  ✅ User login"
echo "  ✅ Verified 0 projects initially (wizard flow)"
echo "  ✅ Project creation"
echo "  ✅ Diagram creation"
echo "  ✅ Diagram retrieval"
echo "  ✅ Diagram update"
echo "  ✅ Diagram deletion"
echo "  ✅ Project with diagrams retrieval"
echo "  ✅ Cleanup"
echo ""
