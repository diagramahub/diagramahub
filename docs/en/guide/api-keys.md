# API Keys

**API keys** connect DiagramaHub with your scripts, CI or your own tools, without using your password. With a key you can read your projects and diagrams, change their code and description, publish them to the Community or remove them, and share them with a link or stop sharing. Each key can only do what you allow.

Manage them from **API Keys** in the sidebar, which has two tabs: **Your keys**, to create and revoke them, and **Documentation**, with the base URL, copy-paste examples (cURL, JavaScript and Python) and the reference of what each key can call.

## Context for AI agents

In **Documentation**, **Copy for AI** copies the whole documentation as Markdown to paste into an agent like Claude or Codex: base URL, authentication, permissions, errors, common tasks with examples, every endpoint and usage notes (for example, to confirm with you before deleting or publishing something). **Download .md** saves the same document, handy to keep in a repository as the agent's context. It includes no key: the agent reads it from the `DIAGRAMAHUB_API_KEY` environment variable.

## Create a key

1. Use **New API key**.
2. Give it a **name** that says where you'll use it (for example, "Docs CI") and an **expiration**: 30, 90 or 365 days, or never.
3. Choose its **permissions** per area (below). **Read only** and **Read and write** set them in one click; any other combination shows as **Custom**.
4. **Copy the key right away**: it is shown only once (only its SHA-256 hash is stored). The window includes a first call to try it.

## Permissions

Each area has its own level: **None**, **Read** or **Write** (write includes read).

| Area | Read | Write |
|---|---|---|
| **Projects** | List and view projects and folders; export a project | Create, rename and delete projects and folders |
| **Diagrams** | View diagrams, the recent ones, and search their content | Create diagrams; change title, code, description or folder; move, duplicate and delete them |
| **Sharing** | View a diagram's active link | Share (create a link), change it and stop sharing (revoke it) |
| **Community** | View your publications and browse the Community | Make public (publish), change category, tags and comments, make private (remove); star, comment and fork |
| **AI** | — | **Use**: fix and convert diagrams with your AI providers (uses your quota) |

- AI is off in the presets: turn it on only if the key needs it.
- **Importing** a project needs write on Projects and Diagrams, and **forking** needs write on Community and Diagrams.
- No key reaches your account, your security (password, MFA), your AI settings, the AI chat, the keys themselves or administration: those always need you to sign in.

## Use it

Send the key in the `Authorization` header to your instance's base URL (the **API Keys** page shows it with a copy button):

```bash
export DIAGRAMAHUB_API_KEY="dh_pat_..."
curl -H "Authorization: Bearer $DIAGRAMAHUB_API_KEY" https://your-instance/api/v1/projects
```

For example, to make a diagram public:

```bash
curl -X POST https://your-instance/api/v1/community/diagrams \
  -H "Authorization: Bearer $DIAGRAMAHUB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"diagram_id": "DIAGRAM_ID", "category": "architecture", "tags": ["api"]}'
```

If a key lacks the permission a path needs, the answer is `403` and says what's missing:

```json
{"detail": {"error": "api_key_permission", "message": "This API key needs write access to projects", "needs": {"projects": "write"}}}
```

An expired, revoked or unknown key gets `401`. The list of keys shows when each was last used. More in the [REST API](../development/api.md#api-keys-api_tokens).

## Revoke

Use **Revoke** on a key you no longer use or that may have leaked: it stops working right away. Deleting your account deletes all your keys. Creating and revoking keys is recorded in the [audit log](../security/audit-log.md).
