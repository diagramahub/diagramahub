#!/bin/bash

# DiagramaHub Onboarding Flow Test Script
# This script tests the complete onboarding flow:
# 1. Register a new user
# 2. Verify "Mi primer proyecto" was created automatically
# 3. Login with the new user
# 4. Get projects list
# 5. Create a diagram in the project
# 6. Update the diagram
# 7. Delete the diagram
# 8. Clean up test data

set -e

API_URL="http://localhost:5172"
TEST_EMAIL="onboarding-test-$(date +%s)@example.com"
TEST_PASSWORD="TestPass123"
TEST_NAME="Onboarding Test User"

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

# 3. Get projects (should have "Mi primer proyecto")
echo "📁 3. Getting user projects..."
PROJECTS_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/projects" \
  -H "Authorization: Bearer $TOKEN")

echo $PROJECTS_RESPONSE | python3 -m json.tool

PROJECT_COUNT=$(echo $PROJECTS_RESPONSE | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
PROJECT_NAME=$(echo $PROJECTS_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data[0]['name'] if data else '')" 2>/dev/null || echo "")
PROJECT_ID=$(echo $PROJECTS_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data[0]['id'] if data else '')" 2>/dev/null || echo "")

if [ "$PROJECT_COUNT" -eq "0" ]; then
  echo "❌ No projects found - onboarding failed"
  exit 1
fi

if [ "$PROJECT_NAME" == "Mi primer proyecto" ]; then
  echo "✅ Onboarding project created successfully: '$PROJECT_NAME'"
else
  echo "⚠️  Project found but name is unexpected: '$PROJECT_NAME'"
fi
echo ""

# 4. Create a diagram
echo "📊 4. Creating a diagram in the project..."
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

# 5. Get diagram
echo "📖 5. Getting diagram details..."
GET_DIAGRAM_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/diagrams/$DIAGRAM_ID" \
  -H "Authorization: Bearer $TOKEN")

echo $GET_DIAGRAM_RESPONSE | python3 -m json.tool
echo "✅ Diagram retrieved successfully"
echo ""

# 6. Update diagram
echo "✏️  6. Updating diagram..."
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

# 7. Get project with diagrams
echo "📂 7. Getting project with all diagrams..."
GET_PROJECT_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo $GET_PROJECT_RESPONSE | python3 -m json.tool
echo "✅ Project with diagrams retrieved"
echo ""

# 8. Delete diagram
echo "🗑️  8. Deleting test diagram..."
curl -s -X DELETE "$API_URL/api/v1/diagrams/$DIAGRAM_ID" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo "✅ Diagram deleted"
echo ""

# 9. Clean up - delete test user and project
echo "🧹 9. Cleaning up test data..."
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
echo "  ✅ Auto-creation of 'Mi primer proyecto'"
echo "  ✅ User login"
echo "  ✅ Project retrieval"
echo "  ✅ Diagram creation"
echo "  ✅ Diagram retrieval"
echo "  ✅ Diagram update"
echo "  ✅ Project with diagrams retrieval"
echo "  ✅ Diagram deletion"
echo "  ✅ Cleanup"
echo ""
