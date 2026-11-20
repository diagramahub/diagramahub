"""
Tests for the admin user actions: block / unblock, delete, and billing detail.

``authenticated_client`` is the first registered user, so it is the admin.
"""

from types import SimpleNamespace
from typing import Optional

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.v1.projects.schemas import ProjectInDB
from app.api.v1.subscriptions.exceptions import PaymentProviderError
from app.api.v1.subscriptions.schemas import PlanInDB, SubscriptionInDB
from app.api.v1.users import admin_routes
from app.api.v1.users.audit_log import AuditLogEntry
from app.api.v1.users.schemas import UserInDB
from app.main import app
from tests.utils import generate_test_password


class FakeProvider:
    """Stands in for Stripe: records cancellations and serves canned invoices."""

    def __init__(self, invoices: Optional[list] = None, fail_cancel: bool = False):
        self.invoices = invoices or []
        self.fail_cancel = fail_cancel
        self.cancelled: list[tuple[str, bool]] = []

    async def cancel_subscription(self, subscription_id: str, immediate: bool = False) -> dict:
        if self.fail_cancel:
            raise PaymentProviderError("stripe", "card network down")
        self.cancelled.append((subscription_id, immediate))
        return {"status": "cancelled", "cancel_at": None}

    async def get_billing_history(self, customer_id: str, limit: int = 10) -> list:
        return [inv for inv in self.invoices if inv.customer == customer_id]


def _invoice(invoice_id: str, cents: int, created: int, status: str = "paid", customer="cus_1"):
    return SimpleNamespace(
        id=invoice_id,
        customer=customer,
        amount_paid=cents,
        currency="usd",
        status=status,
        lines=SimpleNamespace(data=[SimpleNamespace(description="Pro plan", plan=None)]),
        invoice_pdf=f"https://stripe.test/{invoice_id}.pdf",
        hosted_invoice_url=f"https://stripe.test/{invoice_id}",
        created=created,
        status_transitions=SimpleNamespace(paid_at=created if status == "paid" else None),
    )


def _use_provider(monkeypatch, provider):
    async def from_db_or_env():
        return provider

    monkeypatch.setattr(admin_routes.StripePaymentProvider, "from_db_or_env", from_db_or_env)


async def _new_user(email: str) -> tuple[UserInDB, AsyncClient, str]:
    """Register and sign in a regular user on its own client (the admin keeps its own)."""
    password = generate_test_password()
    transport = ASGITransport(app=app)
    user_client = AsyncClient(transport=transport, base_url="http://test")
    response = await user_client.post(
        "/api/v1/users/register",
        json={"email": email, "password": password, "full_name": "Target User"},
    )
    assert response.status_code == 201
    login = await user_client.post(
        "/api/v1/users/login", json={"email": email, "password": password}
    )
    assert login.status_code == 200
    user_client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
    user = await UserInDB.find_one(UserInDB.email == email)
    return user, user_client, password


async def _paid_subscription(user: UserInDB) -> SubscriptionInDB:
    # Registration gave the user a FREE subscription: retire it like a plan change does.
    await SubscriptionInDB.find(SubscriptionInDB.user_id == str(user.id)).update(
        {"$set": {"status": "cancelled"}}
    )
    plan = await PlanInDB(name="Pro", code="PRO", prices={"usd": 3.0}).insert()
    return await SubscriptionInDB(
        user_id=str(user.id),
        plan_id=str(plan.id),
        status="active",
        stripe_customer_id="cus_1",
        stripe_subscription_id="sub_1",
    ).insert()


@pytest.mark.integration
class TestAdminBlockUser:
    async def test_block_ends_sessions_and_sign_in_until_unblocked(
        self, authenticated_client: AsyncClient
    ):
        user, user_client, password = await _new_user("blocked@example.com")
        try:
            assert (await user_client.get("/api/v1/users/me")).status_code == 200

            response = await authenticated_client.put(
                f"/api/v1/users/admin/{user.id}/status",
                json={"is_active": False, "reason": "Spam"},
            )
            assert response.status_code == 200
            assert response.json()["is_active"] is False
            assert response.json()["blocked_reason"] == "Spam"

            me = await user_client.get("/api/v1/users/me")
            assert me.status_code == 401
            assert me.json()["detail"] == "Account disabled"

            login = await user_client.post(
                "/api/v1/users/login", json={"email": user.email, "password": password}
            )
            assert login.status_code == 400
            assert login.json()["detail"] == "Inactive user"

            listing = await authenticated_client.get(
                "/api/v1/mfa/admin/users", params={"status": "blocked"}
            )
            assert [u["email"] for u in listing.json()["items"]] == [user.email]
            assert listing.json()["items"][0]["blocked_reason"] == "Spam"

            unblock = await authenticated_client.put(
                f"/api/v1/users/admin/{user.id}/status", json={"is_active": True}
            )
            assert unblock.status_code == 200
            assert unblock.json()["blocked_at"] is None
            login = await user_client.post(
                "/api/v1/users/login", json={"email": user.email, "password": password}
            )
            assert login.status_code == 200
        finally:
            await user_client.aclose()

        entries = await AuditLogEntry.find(AuditLogEntry.user_email == user.email).to_list()
        events = [e.event for e in entries]
        assert "admin_user_blocked" in events
        assert "admin_user_unblocked" in events

    async def test_admin_cannot_block_themselves(
        self, authenticated_client: AsyncClient, registered_user: dict
    ):
        admin = await UserInDB.find_one(UserInDB.email == registered_user["email"])
        response = await authenticated_client.put(
            f"/api/v1/users/admin/{admin.id}/status", json={"is_active": False}
        )
        assert response.status_code == 400

    async def test_regular_user_cannot_block(self, authenticated_client: AsyncClient):
        target, target_client, _ = await _new_user("target@example.com")
        await target_client.aclose()
        _, other_client, _ = await _new_user("other@example.com")
        try:
            response = await other_client.put(
                f"/api/v1/users/admin/{target.id}/status", json={"is_active": False}
            )
        finally:
            await other_client.aclose()
        assert response.status_code == 403

    async def test_unknown_user_is_404(self, authenticated_client: AsyncClient):
        for user_id in ("not-an-id", "0123456789abcdef01234567"):
            response = await authenticated_client.put(
                f"/api/v1/users/admin/{user_id}/status", json={"is_active": False}
            )
            assert response.status_code == 404


@pytest.mark.integration
class TestAdminDeleteUser:
    async def test_delete_requires_matching_email_then_removes_everything(
        self, authenticated_client: AsyncClient, monkeypatch
    ):
        _use_provider(monkeypatch, None)
        user, user_client, _ = await _new_user("gone@example.com")
        await user_client.aclose()
        await ProjectInDB(name="P", user_id=str(user.id)).insert()

        wrong = await authenticated_client.request(
            "DELETE", f"/api/v1/users/admin/{user.id}", json={"confirm_email": "nope@example.com"}
        )
        assert wrong.status_code == 400
        assert await UserInDB.get(user.id) is not None

        response = await authenticated_client.request(
            "DELETE", f"/api/v1/users/admin/{user.id}", json={"confirm_email": "GONE@example.com"}
        )
        assert response.status_code == 200
        assert response.json()["subscription_cancelled"] is False
        assert await UserInDB.get(user.id) is None
        assert await ProjectInDB.find(ProjectInDB.user_id == str(user.id)).count() == 0
        assert await AuditLogEntry.find_one(AuditLogEntry.event == "admin_user_deleted") is not None

    async def test_admin_cannot_delete_themselves(
        self, authenticated_client: AsyncClient, registered_user: dict, monkeypatch
    ):
        _use_provider(monkeypatch, None)
        admin = await UserInDB.find_one(UserInDB.email == registered_user["email"])
        response = await authenticated_client.request(
            "DELETE", f"/api/v1/users/admin/{admin.id}", json={"confirm_email": admin.email}
        )
        assert response.status_code == 400
        assert await UserInDB.get(admin.id) is not None

    async def test_paid_subscription_is_cancelled_before_deleting(
        self, authenticated_client: AsyncClient, monkeypatch
    ):
        provider = FakeProvider()
        _use_provider(monkeypatch, provider)
        user, user_client, _ = await _new_user("payer@example.com")
        await user_client.aclose()
        await _paid_subscription(user)

        response = await authenticated_client.request(
            "DELETE", f"/api/v1/users/admin/{user.id}", json={"confirm_email": user.email}
        )
        assert response.status_code == 200
        assert response.json()["subscription_cancelled"] is True
        assert provider.cancelled == [("sub_1", True)]
        assert await UserInDB.get(user.id) is None

    @pytest.mark.parametrize("provider", [None, FakeProvider(fail_cancel=True)])
    async def test_nothing_is_deleted_when_the_subscription_cannot_be_cancelled(
        self, authenticated_client: AsyncClient, monkeypatch, provider
    ):
        _use_provider(monkeypatch, provider)
        user, user_client, _ = await _new_user("stuck@example.com")
        await user_client.aclose()
        await _paid_subscription(user)

        response = await authenticated_client.request(
            "DELETE", f"/api/v1/users/admin/{user.id}", json={"confirm_email": user.email}
        )
        assert response.status_code == (409 if provider is None else 502)
        assert await UserInDB.get(user.id) is not None


@pytest.mark.integration
class TestAdminUserBilling:
    async def test_billing_lists_subscriptions_invoices_and_totals(
        self, authenticated_client: AsyncClient, monkeypatch
    ):
        provider = FakeProvider(
            invoices=[
                _invoice("in_1", 300, 1_760_000_000),
                _invoice("in_2", 300, 1_762_600_000),
                _invoice("in_3", 300, 1_765_200_000, status="open"),
            ]
        )
        _use_provider(monkeypatch, provider)
        user, user_client, _ = await _new_user("billing@example.com")
        await user_client.aclose()
        await _paid_subscription(user)

        response = await authenticated_client.get(f"/api/v1/users/admin/{user.id}/billing")
        assert response.status_code == 200
        data = response.json()
        assert data["provider_configured"] is True
        assert data["is_paying"] is True
        assert data["current"]["plan_name"] == "Pro"
        assert data["current"]["stripe_subscription_id"] == "sub_1"
        assert [s["status"] for s in data["subscriptions"]] == ["active", "cancelled"]
        assert [i["id"] for i in data["invoices"]] == ["in_3", "in_2", "in_1"]
        assert data["total_paid"] == {"USD": 6.0}

        listing = await authenticated_client.get(
            "/api/v1/mfa/admin/users", params={"search": user.email}
        )
        item = listing.json()["items"][0]
        assert item["is_paying"] is True
        assert item["plan_code"] == "PRO"

    async def test_billing_without_provider_still_shows_subscriptions(
        self, authenticated_client: AsyncClient, monkeypatch
    ):
        _use_provider(monkeypatch, None)
        user, user_client, _ = await _new_user("free@example.com")
        await user_client.aclose()

        response = await authenticated_client.get(f"/api/v1/users/admin/{user.id}/billing")
        assert response.status_code == 200
        data = response.json()
        assert data["provider_configured"] is False
        assert data["is_paying"] is False
        assert data["invoices"] == []
        assert data["total_paid"] == {}
