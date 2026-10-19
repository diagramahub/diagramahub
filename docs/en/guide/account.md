# Your account and security

Your account settings are spread over three places in the sidebar:

| Section | What it contains |
|---|---|
| **Profile** (My Profile) | Personal information, password, two-factor authentication and linked accounts. |
| **Settings** | AI integrations and the Danger Zone (delete the account). |
| **Subscription** | Your plan, resource usage and billing. |

## Language and theme

In the sidebar:

- **Language**: switches between Spanish and English. It also sets the language the [AI assistant](ai.md) replies in.
- **Toggle theme**: switches between **Light mode** and **Dark mode**.

Both preferences are stored **in your browser**: on another computer you will have to choose them again.

## Personal information

In **My Profile → Personal Information** you can change:

- **Profile Picture**: JPG, PNG or GIF up to 2 MB.
- **Full Name**.
- **Timezone**: used to display dates and times.

The **email address cannot be changed**.

## Password

To change it, go to **My Profile → Security → Change Password**. You need your current password. The new password must have:

- [x] at least 12 characters;
- [x] at least one uppercase and one lowercase letter;
- [x] at least one digit;
- [x] at least one special character (`! @ # $ % ^ & * ( ) _ + - = [ ] { } | ; : ' , . < > ? / ~`);
- [x] a value different from your email address.

!!! info "Changing your password signs out your other sessions"
    Sessions open in other browsers or devices stop being valid and you will need to sign in again there.

**Forgot your password?** On the sign-in screen, request a reset link. It reaches your inbox if the address is registered. This requires the operator to have set up email delivery.

### Lockout after failed attempts

After **5 failed** sign-in attempts, the account is locked for **15 minutes**.

## Two-factor authentication (MFA)

MFA adds a second step when you sign in. You can turn on one or both methods from **My Profile → Two-Factor Authentication (MFA)**:

=== "Authenticator app (TOTP)"

    1. Click **Enable authenticator app**.
    2. Scan the QR code with an app such as Google Authenticator or Authy. If you can't scan it, type the **Secret key** by hand.
    3. Enter the 6-digit code the app shows and click **Verify and activate**.

=== "Email code"

    1. Click **Enable email MFA**.
    2. Use **Send verification code** and enter the 6-digit code that reaches your inbox.

    Each code expires after **10 minutes**. When signing in you can ask for up to **3 resends**, 60 seconds apart. This method is only available if the operator set up email delivery.

If you turn on both methods, choose which one to use by default with **Default method**. When signing in you can also **Try another method**.

### Recovery codes

When you turn on MFA you get **8 recovery codes**. Use them if you lose access to your main method: each code works **only once**.

!!! warning "The codes are shown only once"
    Copy them (**Copy all**) and keep them somewhere safe, such as a password manager. If you lose them or run out, use **Regenerate recovery codes**: the previous codes stop working.

Turning a method off requires your current password.

### Session length

| How you signed in | Length |
|---|---|
| Email and password, no MFA | 2 days |
| Email and password, with MFA | 5 days |
| Google | 5 days |

## Sign in with Google

If the operator enabled Google as a provider, the sign-in and sign-up screens show **Sign in with Google**.

- If you already had an account with the same email, Google is **linked** to that account automatically.
- When you sign in with Google, DiagramaHub does not ask for its own second factor: verification is handled by your Google account.
- Linked external accounts appear in **My Profile → Linked Accounts**.
- If your account only uses Google and you also want to sign in with email and password, use **Create a password by email**.

## Subscription

In **Subscription** (My Subscription) you see:

- your **Current Plan** and its status;
- **Resource Usage**: how many projects and diagrams you use against your plan's limit;
- the **Available Plans**, if you want to **Change Plan**.

Plans, their limits and their prices are defined by the instance operator. Every account starts on the free plan. If the instance has payments configured, you will also see:

- **Change payment method** and **Billing History**;
- **Cancel Subscription**, with two options:

| Option | What happens |
|---|---|
| **At the end of the period** (recommended) | You keep your plan until the period ends, then move to the free plan. |
| **Immediately** | You move to the free plan right away, with no refund for the remaining time. |

## Delete your account

In **Settings → Danger Zone**, use **Delete my account** and type `delete me` to confirm.

Your projects, diagrams, folders, AI configuration and subscription, and prompt history are deleted **permanently**.

!!! danger "Before deleting"
    - If you are on a paid plan, switch to the free plan first.
    - If you are the instance's **only administrator**, you cannot delete your account from the app.
    - [Export your projects](export-import.md#export-a-project-or-a-folder) if you want to keep a copy.

For more technical detail on these mechanisms, see [Authentication](../security/authentication.md).
