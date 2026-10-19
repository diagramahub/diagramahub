# Plans and limits

In DiagramaHub plans are **data**, not code: each operator decides which plans to offer,
how many projects and diagrams each one allows and how much it costs (or whether it costs
anything at all). No feature is exclusive to a plan: every plan has access to every
feature, only the limits change.

## The `Plan` model

Plans live in MongoDB's `plans` collection.

| Field | Type | Description |
|---|---|---|
| `name` | text (1–50) | Display name. Unique. |
| `code` | text (1–30) | Unique code in uppercase letters, digits, `_` or `-` (e.g. `TEAM`). `FREE` is reserved. |
| `description` | text (≤500) | Optional description. |
| `max_projects` | integer | Maximum projects. `-1` or empty = unlimited. |
| `max_diagrams` | integer | Maximum diagrams. `-1` or empty = unlimited. |
| `prices` | dictionary | Monthly price per currency, e.g. `{"usd": 4, "mxn": 70}`. Empty = free. |
| `is_active` | boolean | An inactive plan is no longer offered, but its subscribers keep it. |
| `gateway_config` | object | Stripe product and price IDs; filled in automatically on sync. |

Supported currencies: `usd`, `eur`, `gbp`, `mxn` and `brl`.

## The free plan (`FREE`)

- It is created automatically on the **first registration of a non-admin user**, named
  `Gratuito`, with 1 project and 10 diagrams.
- Every new user gets a `FREE` subscription, including sign-ups with Google.
- It cannot be deleted, deactivated or have its code changed. You can edit its name,
  description and limits.

If the database comes from a version without plans, create the plan and give existing
users `FREE` with the backend scripts (both are idempotent):

```bash
docker exec -it diagramahub-backend python -m scripts.create_free_plan
docker exec -it diagramahub-backend python -m scripts.migrate_users_to_subscriptions --dry-run
docker exec -it diagramahub-backend python -m scripts.migrate_users_to_subscriptions
```

## Administrators

Administrators have no limits: usage checks let them create projects and diagrams freely
and they don't get a subscription.

## Creating and editing plans

Open **Administration → Plans** (route `/admin/plans`).

```mermaid
flowchart TD
    N[New plan] --> P{Price > 0?}
    P -->|No| G[Free plan<br/>MongoDB only]
    P -->|Yes| S{Stripe active?}
    S -->|No| E[Error: an active<br/>Stripe link is required]
    S -->|Yes| C[Product and price are created<br/>in Stripe and their IDs saved]
    C --> M[Add prices in<br/>other currencies]
```

Rules the server enforces:

- A paid plan needs an active Stripe gateway ([Integrations](integrations.md#payments-stripe)).
  On creation, DiagramaHub creates the product and price in Stripe.
- The USD price is the primary one. Other currencies are added afterwards, once the plan
  is synced with Stripe.
- **A plan's price cannot change while it has active subscribers.** Create a new plan and
  deactivate the old one.
- Changing a paid plan's name, description or price re-syncs it with Stripe.
- Deleting a plan **with** subscribers only deactivates it (and archives it in Stripe);
  subscribers keep it. **Without** subscribers, it is archived in Stripe and deleted.

## How limits are enforced

Limits are checked **on the server** before a project or diagram is created, including the
ones that arrive through an import. When the limit is reached, the API answers `403` and the
UI offers a plan change. The client never decides whether something is allowed.

```mermaid
sequenceDiagram
    participant U as User
    participant API as Backend
    participant L as Usage limiter
    U->>API: Create diagram
    API->>L: Within the plan's limit?
    alt admin or limit -1
        L-->>API: Allowed
    else usage < limit
        L-->>API: Allowed
    else usage ≥ limit
        L-->>API: Rejected
        API-->>U: 403 limit reached
    end
```

Each user can check their usage at `GET /api/v1/subscriptions/usage`.

## An instance without billing

If you don't connect Stripe, every user is on free plans. For an internal instance without
limits, edit `FREE` and set projects and diagrams to `-1`.
