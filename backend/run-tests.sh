#!/bin/sh

# Script to run pytest tests in Diagramahub backend
# Usage: ./run-tests.sh [options]

set -e

echo "🧪 Running Diagramahub Backend Tests..."
echo ""

# Parse arguments
case "${1:-}" in
    --unit)
        echo "Running unit tests only..."
        shift
        poetry run pytest -m unit "$@"
        ;;
    --integration)
        echo "Running integration tests only..."
        shift
        poetry run pytest -m integration "$@"
        ;;
    --cov)
        echo "Running tests with coverage report..."
        shift
        poetry run pytest --cov=app --cov-report=html --cov-report=term-missing "$@"
        ;;
    --quick)
        echo "Running quick tests (no coverage)..."
        shift
        poetry run pytest -v --no-cov "$@"
        ;;
    *)
        echo "Running all tests with coverage..."
        # Coverage floor for the full suite. Measured 47% on 2026-09-25; raise it
        # as 0.7.0 lands the missing tests. Subset runs (--unit/--integration) are
        # exempt on purpose: partial suites cannot reach the whole-project floor.
        poetry run pytest --cov-fail-under=45 "$@"
        ;;
esac

echo ""
echo "✅ Tests completed!"
