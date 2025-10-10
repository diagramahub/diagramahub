#!/bin/bash

# Script to run pytest tests in Diagramahub backend
# Usage: ./run-tests.sh [options]

set -e

echo "🧪 Running Diagramahub Backend Tests..."
echo ""

# Parse arguments
if [ "$1" == "--unit" ]; then
    echo "Running unit tests only..."
    poetry run pytest -m unit "$@"
elif [ "$1" == "--integration" ]; then
    echo "Running integration tests only..."
    poetry run pytest -m integration "$@"
elif [ "$1" == "--cov" ]; then
    echo "Running tests with coverage report..."
    poetry run pytest --cov=app --cov-report=html --cov-report=term-missing
elif [ "$1" == "--quick" ]; then
    echo "Running quick tests (no coverage)..."
    poetry run pytest -v --no-cov
else
    echo "Running all tests with coverage..."
    poetry run pytest
fi

echo ""
echo "✅ Tests completed!"
