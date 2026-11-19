# Users

**Administration → Users** lists every account on your installation: its plan, usage, security and status. From there you can block or delete an account and check its payments. Only users with the `admin` role see it.

## The list

| Column | What it shows |
|---|---|
| **User** | Name, email and the **Admin** mark when it applies. |
| **Plan** | The plan of their active subscription (or **No plan**) and the **Paid** mark when they pay for a priced plan through the payment provider. |
| **Usage** | Projects and diagrams. |
| **Security** | Whether they use MFA, and which methods. |
| **Last sign-in** | Their latest sign-in. |
| **Status** | **Active** or **Blocked**. |

You can search by name or email, filter by **All**, **Active** or **Blocked**, and download the whole list as Excel. On a phone the table shows only user, plan and status; the rest is in the detail panel.

## A user's detail

Choosing a user opens a side panel with two tabs:

- **Summary**: role, plan, sign-up date and last sign-in; projects and diagrams by type; the AI models they connected; their MFA (with **Disable MFA**, for someone who lost access to their factors); and the **Danger zone** with block and delete.
- **Payments**: the current plan, since when they're subscribed and their next charge, the total paid per currency, the payment provider's invoices (each with a link) and the subscription history. Without a payment provider configured you see the subscriptions but not the invoices.

You can't block or delete your own account here: delete it from your profile. This way there's always at least one active administrator.

## Block and unblock

**Block** stops access without deleting anything:

- They can't sign in, with a password or with Google; they see "Your account is blocked".
- Their open sessions end on their next action, and their [API keys](../guide/api-keys.md) stop working.
- Their data, publications and subscription are kept. **Blocking doesn't cancel a paid subscription**: the dialog warns you when they have one.
- You can add a reason (optional); only administrators see it, along with who blocked the account and when.

**Unblock** gives access back right away, and their API keys work again unless they expired.

## Delete

**Delete** removes the account and all its data: projects, folders, diagrams, Community publications, API keys, AI settings, prompt history and subscriptions. It can't be undone, and you confirm it by typing the user's email.

If they have an active paid subscription, it's cancelled immediately with the payment provider first. If that cancellation fails, or no payment provider is configured, **nothing is deleted**: removing the account while the provider keeps charging would be worse.

## Audit log

Blocking, unblocking and deleting are recorded in the [audit log](../security/audit-log.md) (`admin_user_blocked`, `admin_user_unblocked`, `admin_user_deleted`) with the administrator who did it, the block reason and, on delete, the cancelled subscription.
