# Subscription System API Documentation

This document describes the REST API endpoints for the DiagramaHub subscription system.

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication

Most endpoints require authentication using JWT Bearer tokens:

```
Authorization: Bearer <your_jwt_token>
```

## Admin Endpoints

### Create Plan

Create a new subscription plan (admin only).

**Endpoint:** `POST /admin/plans`

**Auth:** Required (Admin)

**Request Body:**
```json
{
  "name": "Pro",
  "description": "Professional plan with advanced features",
  "price_usd": 29.99,
  "max_projects": 10,
  "max_diagrams": 100
}
```

**Response:** `201 Created`
```json
{
  "id": "507f1f77bcf86cd799439011",
  "name": "Pro",
  "description": "Professional plan with advanced features",
  "price_usd": 29.99,
  "max_projects": 10,
  "max_diagrams": 100,
  "is_active": true,
  "is_free": false,
  "active_subscriptions": 0,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### Get All Plans (Admin)

Get all plans including inactive ones (admin only).

**Endpoint:** `GET /admin/plans`

**Auth:** Required (Admin)

**Response:** `200 OK`
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "name": "FREE",
    "price_usd": 0.0,
    "max_projects": 1,
    "max_diagrams": 10,
    "is_active": true,
    "is_free": true,
    "active_subscriptions": 150
  },
  {
    "id": "507f1f77bcf86cd799439012",
    "name": "Pro",
    "price_usd": 29.99,
    "max_projects": 10,
    "max_diagrams": 100,
    "is_active": false,
    "is_free": false,
    "active_subscriptions": 0
  }
]
```

### Update Plan

Update an existing plan (admin only).

**Endpoint:** `PUT /admin/plans/{plan_id}`

**Auth:** Required (Admin)

**Request Body:**
```json
{
  "name": "Pro Plus",
  "price_usd": 39.99,
  "max_projects": 20
}
```

**Response:** `200 OK`

### Deactivate Plan

Deactivate a plan (admin only). Cannot deactivate FREE plan.

**Endpoint:** `DELETE /admin/plans/{plan_id}`

**Auth:** Required (Admin)

**Response:** `200 OK`
```json
{
  "message": "Plan deactivated successfully",
  "plan_id": "507f1f77bcf86cd799439012",
  "active_subscriptions_maintained": 5
}
```

## Public Plan Endpoints

### Get Active Plans

Get all active plans available for subscription.

**Endpoint:** `GET /plans`

**Auth:** Not required

**Response:** `200 OK`
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "name": "FREE",
    "description": "Free plan with basic features",
    "price_usd": 0.0,
    "max_projects": 1,
    "max_diagrams": 10,
    "is_active": true,
    "is_free": true
  },
  {
    "id": "507f1f77bcf86cd799439012",
    "name": "Pro",
    "description": "Professional plan",
    "price_usd": 29.99,
    "max_projects": 10,
    "max_diagrams": 100,
    "is_active": true,
    "is_free": false
  }
]
```

### Get Plan Details

Get details of a specific plan.

**Endpoint:** `GET /plans/{plan_id}`

**Auth:** Not required

**Response:** `200 OK`

## Subscription Endpoints

### Get My Subscription

Get current user's active subscription.

**Endpoint:** `GET /subscriptions/me`

**Auth:** Required

**Response:** `200 OK`
```json
{
  "id": "507f1f77bcf86cd799439013",
  "user_id": "507f191e810c19729de860ea",
  "plan": {
    "id": "507f1f77bcf86cd799439011",
    "name": "FREE",
    "price_usd": 0.0,
    "max_projects": 1,
    "max_diagrams": 10,
    "is_free": true
  },
  "status": "active",
  "stripe_customer_id": null,
  "stripe_subscription_id": null,
  "payment_provider": "stripe",
  "started_at": "2024-01-15T10:30:00Z",
  "current_period_start": null,
  "current_period_end": null,
  "cancelled_at": null,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### Create Checkout Session

Initiate plan change or upgrade.

**Endpoint:** `POST /subscriptions/checkout`

**Auth:** Required

**Request Body:**
```json
{
  "plan_id": "507f1f77bcf86cd799439012"
}
```

**Response:** `200 OK`

For FREE plan (immediate change):
```json
{
  "session_id": null,
  "session_url": null,
  "message": "Plan changed immediately to FREE"
}
```

For paid plan (Stripe checkout):
```json
{
  "session_id": "cs_test_a1b2c3d4e5f6",
  "session_url": "https://checkout.stripe.com/pay/cs_test_a1b2c3d4e5f6"
}
```

### Cancel Subscription

Cancel current paid subscription.

**Endpoint:** `POST /subscriptions/cancel`

**Auth:** Required

**Response:** `200 OK`
```json
{
  "message": "Subscription cancelled successfully",
  "cancel_at": "2024-02-15T10:30:00Z",
  "access_until": "2024-02-15T10:30:00Z"
}
```

### Get Usage Summary

Get current resource usage and limits.

**Endpoint:** `GET /subscriptions/usage`

**Auth:** Required

**Response:** `200 OK`
```json
{
  "plan_name": "FREE",
  "projects": {
    "current": 1,
    "limit": 1
  },
  "diagrams": {
    "current": 8,
    "limit": 10
  },
  "usage_percentage": {
    "projects": 100.0,
    "diagrams": 80.0
  }
}
```

## Webhook Endpoint

### Stripe Webhook

Receive Stripe payment events.

**Endpoint:** `POST /webhooks/stripe`

**Auth:** Not required (validated via signature)

**Headers:**
```
stripe-signature: t=1234567890,v1=abc123...
```

**Events Handled:**
- `checkout.session.completed` - Activate subscription
- `customer.subscription.updated` - Update subscription status
- `customer.subscription.deleted` - Cancel subscription
- `invoice.payment_failed` - Mark payment as failed

**Response:** `200 OK`
```json
{
  "status": "processed"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Invalid plan data"
}
```

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden

Resource limit exceeded:
```json
{
  "detail": {
    "error": "resource_limit_exceeded",
    "resource_type": "projects",
    "current_usage": 1,
    "limit": 1,
    "message": "You have reached your projects limit (1/1)"
  }
}
```

Admin access required:
```json
{
  "detail": "Admin access required"
}
```

### 404 Not Found
```json
{
  "detail": "Plan with id 507f1f77bcf86cd799439011 not found"
}
```

### 502 Bad Gateway
```json
{
  "detail": "Payment provider (stripe) error: Connection timeout"
}
```

## Rate Limiting

Webhook endpoint is rate limited to 100 requests per minute per IP.

## Testing

Use Stripe test cards for testing payments:

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Insufficient funds: `4000 0000 0000 9995`

See [Stripe Testing Guide](https://stripe.com/docs/testing) for more test cards.
