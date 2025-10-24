#!/bin/bash

# DiagramHub Installation Verification Script
# This script checks if all services are running correctly

echo "============================================"
echo "  DiagramHub - Installation Verification"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "🐳 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo "   Please start Docker and try again"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Check if services are running
echo "📦 Checking DiagramHub services..."

SERVICES=("backend" "frontend")
MONGODB_DISABLED=false

# Check if MongoDB service is disabled (external MongoDB)
if docker-compose config --services 2>/dev/null | grep -q "mongodb"; then
    if docker-compose ps mongodb 2>/dev/null | grep -q "disabled"; then
        MONGODB_DISABLED=true
        echo -e "${YELLOW}ℹ️  Local MongoDB is disabled (using external MongoDB)${NC}"
    else
        SERVICES+=("mongodb")
    fi
fi

ALL_RUNNING=true

for service in "${SERVICES[@]}"; do
    if docker-compose ps "$service" 2>/dev/null | grep -q "Up"; then
        echo -e "${GREEN}✅ $service is running${NC}"
    else
        echo -e "${RED}❌ $service is not running${NC}"
        ALL_RUNNING=false
    fi
done

echo ""

if [ "$ALL_RUNNING" = false ]; then
    echo -e "${RED}❌ Some services are not running${NC}"
    echo "   Run: docker-compose up -d"
    exit 1
fi

# Test Backend API
echo "🔍 Testing Backend API..."
if curl -s http://localhost:5172/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend API is responding${NC}"
else
    echo -e "${RED}❌ Backend API is not responding${NC}"
    echo "   Check logs: docker-compose logs backend"
    exit 1
fi
echo ""

# Test Frontend
echo "🔍 Testing Frontend..."
if curl -s http://localhost:5173/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is responding${NC}"
else
    echo -e "${RED}❌ Frontend is not responding${NC}"
    echo "   Check logs: docker-compose logs frontend"
    exit 1
fi
echo ""

# Test MongoDB connection (if not using external)
if [ "$MONGODB_DISABLED" = false ]; then
    echo "🔍 Testing MongoDB connection..."

    # Try to connect to MongoDB via backend container
    if docker exec diagramahub-backend python -c "from pymongo import MongoClient; client = MongoClient('mongodb://mongodb:27017', serverSelectionTimeoutMS=2000); client.server_info(); print('OK')" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ MongoDB connection successful${NC}"
    else
        echo -e "${RED}❌ MongoDB connection failed${NC}"
        echo "   Check logs: docker-compose logs mongodb"
        exit 1
    fi
    echo ""
fi

# Summary
echo "============================================"
echo -e "  ${GREEN}✅ All checks passed!${NC}"
echo "============================================"
echo ""
echo "🌐 Access DiagramHub:"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:5172"
echo "   API Docs:  http://localhost:5172/docs"
echo ""
echo "📝 Next steps:"
echo "   1. Open http://localhost:5173"
echo "   2. Click 'Register' to create your first account"
echo "   3. Start creating diagrams!"
echo ""
echo "🔍 View logs:"
echo "   docker-compose logs -f"
echo ""
echo "🎉 Happy diagramming!"
echo ""
