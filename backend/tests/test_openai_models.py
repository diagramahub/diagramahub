"""
Test script para verificar compatibilidad de modelos OpenAI configurados.
Ejecutar dentro del contenedor:
  docker exec diagramahub-backend python tests/test_openai_models.py
"""
import asyncio
import sys
import os
import time

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from cryptography.fernet import Fernet

# ── Config ──────────────────────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongodb:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "diagramahub")
AI_ENCRYPTION_KEY = os.getenv("AI_ENCRYPTION_KEY", "")

SIMPLE_DIAGRAM_PROMPT = "Create a simple mermaid flowchart with 3 nodes: Start -> Process -> End"
IMPROVE_PROMPT = "Add a Decision node between Process and End with Yes/No branches"


def decrypt_key(encrypted: str) -> str:
    if not AI_ENCRYPTION_KEY:
        raise ValueError("AI_ENCRYPTION_KEY not set")
    cipher = Fernet(AI_ENCRYPTION_KEY.encode())
    return cipher.decrypt(encrypted.encode()).decode()


def print_result(label: str, success: bool, detail: str = "", elapsed: float = 0):
    icon = "✅" if success else "❌"
    time_str = f" ({elapsed:.1f}s)" if elapsed else ""
    print(f"  {icon} {label}{time_str}")
    if detail:
        # Truncate long details
        lines = detail.strip().split("\n")
        preview = "\n".join(lines[:5])
        if len(lines) > 5:
            preview += f"\n     ... ({len(lines) - 5} more lines)"
        for line in preview.split("\n"):
            print(f"     {line}")


async def test_model(api_key: str, model: str):
    """Test a single OpenAI model with generate + improve flow."""
    import httpx

    base_url = "https://api.openai.com/v1"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    print(f"\n{'─' * 60}")
    print(f"🔍 Testing model: {model}")
    print(f"{'─' * 60}")

    # ── Test 1: Basic chat completion (generate diagram) ──
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a diagram expert. Return only mermaid code, no markdown fences."},
            {"role": "user", "content": SIMPLE_DIAGRAM_PROMPT},
        ],
        "max_completion_tokens": 1024,
    }

    t0 = time.time()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
        elapsed = time.time() - t0

        if resp.status_code != 200:
            print_result("Generate diagram", False, f"HTTP {resp.status_code}: {resp.text[:300]}", elapsed)
            return
        
        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            print_result("Generate diagram", False, "Empty response from API", elapsed)
            return

        print_result("Generate diagram", True, content, elapsed)
        diagram_code = content

    except Exception as e:
        print_result("Generate diagram", False, str(e), time.time() - t0)
        return

    # ── Test 2: Improve diagram ──
    payload2 = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a diagram expert. Return only the improved mermaid code, no markdown fences."},
            {"role": "user", "content": f"Here is a mermaid diagram:\n\n{diagram_code}\n\n{IMPROVE_PROMPT}"},
        ],
        "max_completion_tokens": 1024,
    }

    t0 = time.time()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload2)
        elapsed = time.time() - t0

        if resp.status_code != 200:
            print_result("Improve diagram", False, f"HTTP {resp.status_code}: {resp.text[:300]}", elapsed)
            return

        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            print_result("Improve diagram", False, "Empty response from API", elapsed)
            return

        print_result("Improve diagram", True, content, elapsed)

    except Exception as e:
        print_result("Improve diagram", False, str(e), time.time() - t0)

    # ── Test 3: With temperature (check if supported) ──
    payload3 = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Say hello."},
            {"role": "user", "content": "Hi"},
        ],
        "max_completion_tokens": 50,
        "temperature": 0.7,
    }

    t0 = time.time()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload3)
        elapsed = time.time() - t0

        if resp.status_code == 200:
            print_result("temperature=0.7", True, "Supported", elapsed)
        else:
            error_msg = resp.text[:200]
            print_result("temperature=0.7", False, f"Not supported: {error_msg}", elapsed)

    except Exception as e:
        print_result("temperature=0.7", False, str(e), time.time() - t0)

    # ── Test 4: With max_tokens (legacy param) ──
    payload4 = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Say hello."},
            {"role": "user", "content": "Hi"},
        ],
        "max_tokens": 50,
    }

    t0 = time.time()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload4)
        elapsed = time.time() - t0

        if resp.status_code == 200:
            print_result("max_tokens (legacy)", True, "Supported", elapsed)
        else:
            error_msg = resp.text[:200]
            print_result("max_tokens (legacy)", False, f"Not supported: {error_msg}", elapsed)

    except Exception as e:
        print_result("max_tokens (legacy)", False, str(e), time.time() - t0)


async def main():
    print("=" * 60)
    print("🧪 DiagramaHub - OpenAI Model Compatibility Test")
    print("=" * 60)

    # Connect to MongoDB and find OpenAI providers
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DATABASE_NAME]
    collection = db["user_ai_settings"]

    # Find all users with OpenAI providers
    openai_configs = []
    async for doc in collection.find({}):
        providers = doc.get("providers", [])
        for p in providers:
            if p.get("provider") == "openai" and p.get("is_active", True):
                try:
                    api_key = decrypt_key(p["api_key"])
                    model = p.get("model", "gpt-4o-mini")
                    openai_configs.append({"api_key": api_key, "model": model, "user_id": doc.get("user_id", "?")})
                except Exception as e:
                    print(f"⚠️  Could not decrypt key for user {doc.get('user_id', '?')}: {e}")

    if not openai_configs:
        print("\n⚠️  No active OpenAI providers found in the database.")
        print("   Make sure you have configured an OpenAI provider in DiagramaHub settings.")
        client.close()
        return

    print(f"\nFound {len(openai_configs)} active OpenAI config(s):")
    for cfg in openai_configs:
        print(f"  • User: {cfg['user_id']} | Model: {cfg['model']}")

    # Test each unique model (avoid duplicate API calls)
    tested = set()
    for cfg in openai_configs:
        key = (cfg["api_key"][:10], cfg["model"])
        if key in tested:
            continue
        tested.add(key)
        await test_model(cfg["api_key"], cfg["model"])

    print(f"\n{'=' * 60}")
    print("✅ Test complete")
    print("=" * 60)
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
