#!/bin/bash

# Shared helpers for local smoke/integration scripts.

set -e

generate_runtime_password() {
  local label="${1:-test}"

  python3 - "$label" <<'PY'
import secrets
import string
import sys

label = sys.argv[1]
alphabet = string.ascii_letters + string.digits
fragment = ''.join(secrets.choice(alphabet) for _ in range(10))
special = secrets.choice('!@#$%^&*')
print(f"{label}-{fragment}Aa1{special}")
PY
}
