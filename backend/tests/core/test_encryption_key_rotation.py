"""
Encryption key rotation: old keys keep decrypting, the script re-encrypts.
"""

import pytest
from cryptography.fernet import Fernet, InvalidToken
from pymongo import AsyncMongoClient

from app.core.config import settings
from app.core.security import decrypt_api_key, encrypt_api_key, get_cipher
from scripts.rotate_encryption_key import rotate_secrets

pytestmark = pytest.mark.integration


@pytest.fixture
def keys(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    """An old key configured as current; the test switches to a new one."""
    old, new = Fernet.generate_key().decode(), Fernet.generate_key().decode()
    monkeypatch.setattr(settings, "AI_ENCRYPTION_KEY", old)
    monkeypatch.setattr(settings, "AI_ENCRYPTION_KEY_PREVIOUS", "")
    return {"old": old, "new": new}


def _switch_to_new_key(monkeypatch: pytest.MonkeyPatch, keys: dict[str, str]) -> None:
    monkeypatch.setattr(settings, "AI_ENCRYPTION_KEY", keys["new"])
    monkeypatch.setattr(settings, "AI_ENCRYPTION_KEY_PREVIOUS", f" {keys['old']} ,")


def test_previous_key_still_decrypts(monkeypatch: pytest.MonkeyPatch, keys: dict) -> None:
    token = encrypt_api_key("sk-test-value")

    _switch_to_new_key(monkeypatch, keys)

    assert decrypt_api_key(token) == "sk-test-value"


def test_new_data_uses_the_current_key(monkeypatch: pytest.MonkeyPatch, keys: dict) -> None:
    _switch_to_new_key(monkeypatch, keys)

    token = encrypt_api_key("sk-test-value")

    assert Fernet(keys["new"].encode()).decrypt(token.encode()) == b"sk-test-value"
    with pytest.raises(InvalidToken):
        Fernet(keys["old"].encode()).decrypt(token.encode())


def test_without_the_previous_key_old_data_is_unreadable(
    monkeypatch: pytest.MonkeyPatch, keys: dict
) -> None:
    token = encrypt_api_key("sk-test-value")

    monkeypatch.setattr(settings, "AI_ENCRYPTION_KEY", keys["new"])

    with pytest.raises(InvalidToken):
        decrypt_api_key(token)


async def test_script_re_encrypts_every_kind_of_secret(
    test_db, monkeypatch: pytest.MonkeyPatch, keys: dict
) -> None:
    old_token = encrypt_api_key("secret-value")
    garbage = "not-a-fernet-token"
    client: AsyncMongoClient = AsyncMongoClient(settings.MONGO_URI)
    db = client[f"{settings.DATABASE_NAME}_test"]
    try:
        await db["user_ai_settings"].insert_one(
            {"user_id": "u1", "providers": [{"provider": "gemini", "api_key": old_token}]}
        )
        await db["vendor_configs"].insert_one({"encrypted_config": old_token})
        await db["users"].insert_many(
            [
                {"email": "a@example.com", "totp_secret_encrypted": old_token},
                {"email": "b@example.com", "totp_secret_encrypted": garbage},
                {"email": "c@example.com", "totp_secret_encrypted": None},
            ]
        )

        _switch_to_new_key(monkeypatch, keys)
        dry = await rotate_secrets(db, get_cipher(), apply=False)
        assert (await db["vendor_configs"].find_one())["encrypted_config"] == old_token

        report = await rotate_secrets(db, get_cipher(), apply=True)

        assert dry.counts == report.counts
        assert report.counts["ai_provider_keys"] == {"checked": 1, "rotated": 1, "unreadable": 0}
        assert report.counts["integration_configs"] == {"checked": 1, "rotated": 1, "unreadable": 0}
        assert report.counts["totp_secrets"] == {"checked": 2, "rotated": 1, "unreadable": 1}

        # Everything now decrypts with the new key alone.
        monkeypatch.setattr(settings, "AI_ENCRYPTION_KEY_PREVIOUS", "")
        ai = await db["user_ai_settings"].find_one()
        vendor = await db["vendor_configs"].find_one()
        user = await db["users"].find_one({"email": "a@example.com"})
        for token in (
            ai["providers"][0]["api_key"],
            vendor["encrypted_config"],
            user["totp_secret_encrypted"],
        ):
            assert decrypt_api_key(token) == "secret-value"
        untouched = await db["users"].find_one({"email": "b@example.com"})
        assert untouched["totp_secret_encrypted"] == garbage
    finally:
        await client.close()
