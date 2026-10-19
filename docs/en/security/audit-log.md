# Audit log

DiagramaHub stores each account's security events in an audit log inside MongoDB. It is used to investigate incidents (sign-in attempts, password changes, recovery code use) and to meet monitoring controls such as SOC 2 CC7.2.

## Storage and retention

| Aspect | Value |
|---|---|
| Collection | `audit_log` |
| Retention | **90 days**: a TTL index on `timestamp` deletes entries automatically |
| Indexes | `user_email`, `event`, `timestamp` (TTL) |
| Writes | Only the backend adds entries; no API modifies or deletes them |

If writing to the log fails, the error goes to the server logs and the user's operation goes on: the log never blocks a sign-in.

### Entry fields

| Field | Description |
|---|---|
| `timestamp` | UTC date and time of the event |
| `event` | Event type (see the table below) |
| `user_email` | Email of the account involved |
| `user_id` | User ID, when known |
| `ip_address` | Source IP, on password sign-in events |
| `details` | Extra context (for example, the MFA method or the OAuth provider) |

## Recorded events

| Event | When it is recorded |
|---|---|
| `login_success` | Correct email and password (if the account has MFA, it is recorded before the second factor) |
| `login_failed` | Wrong password or unknown user; also written (with `details: mfa_max_attempts`) when a sign-in runs out of MFA codes |
| `login_locked` | The account was locked after consecutive failures |
| `login_mfa_verified` | Second factor verified (`details` includes the method) |
| `mfa_recovery_used` | Sign-in completed with a recovery code |
| `mfa_enabled` | The user enabled TOTP or email as a factor |
| `mfa_disabled` | The user disabled an MFA method |
| `admin_mfa_reset` | An administrator reset a user's MFA |
| `password_changed` | The user changed their password from the profile |
| `password_reset_requested` | A password reset email was requested |
| `password_reset_confirmed` | The password was reset with the emailed link |
| `oauth_login_success` | Successful sign-in with an OAuth provider |
| `oauth_login_failed` | An OAuth sign-in failed (for example, unverified email or token validation) |
| `oauth_account_linked` | An existing account was linked to an OAuth provider |
| `account_deleted` | The user deleted their account |

## Querying the log

The application **has no view** of the audit log yet: whoever operates the instance queries it with direct access to MongoDB.

```bash
docker exec -it diagramahub-mongodb mongosh diagramahub
```

```javascript
// Last 20 events of an account
db.audit_log.find({ user_email: "person@example.com" })
  .sort({ timestamp: -1 }).limit(20)

// Account lockouts in the last 24 hours
db.audit_log.find({
  event: "login_locked",
  timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
})

// Count by event type
db.audit_log.aggregate([{ $group: { _id: "$event", total: { $sum: 1 } } }])
```

!!! warning "Personal data"
    The log holds emails and IPs. Limit MongoDB access to whoever operates the instance and treat its exports as sensitive information.

If you need to keep events for more than 90 days (for example, because of a compliance policy), export them regularly to your log system before they expire.
