# Frequently asked questions

## Using DiagramaHub

??? question "Which diagram languages are supported?"
    Mermaid, PlantUML, D2 and DBML, plus the freehand whiteboard. Mermaid is drawn in your
    browser; PlantUML, D2 and DBML are drawn by the Kroki service that runs inside the same
    installation. See [Diagram types](guide/diagram-types.md).

??? question "Can I turn a diagram into another language?"
    Yes, with the editor's AI-assisted conversion, which shows the result side by side before
    applying it. You need an AI provider configured. See [The editor](guide/editor.md).

??? question "How do I get my diagrams out of DiagramaHub?"
    Each diagram exports to PNG, SVG, PDF or Markdown, and a whole project or folder exports as
    a ZIP. You can also import ZIP archives, diagram files and Excalidraw drawings. See
    [Export and import](guide/export-import.md).

??? question "Who can see a diagram I share?"
    Anyone with the link; if the link is protected, they also need the access code. Links can
    expire after 5, 10 or 30 days or never, and you can revoke them. See
    [Sharing diagrams](guide/sharing.md).

## Artificial intelligence

??? question "Does the AI cost anything?"
    DiagramaHub doesn't charge for or resell AI: you use your own API key (BYOL) for Gemini,
    OpenAI, Claude, DeepSeek or MiniMax, and your provider bills you directly.

??? question "What is sent to the AI provider, and where is my API key stored?"
    Only when you use an AI feature, the backend sends your provider the request and the
    diagram context. The key is stored encrypted in the database and the API never returns it
    in full. See [AI assistant](guide/ai.md) and [Protections](security/protections.md).

??? question "The AI returned a diagram that doesn't render. What now?"
    For Mermaid and D2 the chat validates the code and, if it fails, asks the model to fix it
    (you can turn this off in the AI settings). A reply cut off for length is not applied and
    you get a notice. See [AI assistant](guide/ai.md).

## Account

??? question "I forgot my password"
    Request a recovery link from the sign-in screen. It requires the instance operator to have
    set up email delivery. See [Your account and security](guide/account.md).

??? question "I lost the phone with my authenticator app"
    Sign in with one of your recovery codes (each works once) or with the email code if you
    have it enabled. If you have neither, an instance administrator can reset your MFA. See
    [Your account and security](guide/account.md).

## Self-host

??? question "Does running it on my server cost anything?"
    No. The software is open source under Apache 2.0. Your instance's plans, limits and prices
    are yours to define; Stripe payments are optional. See [Plans and limits](self-host/plans.md).

??? question "What do I need to install it?"
    Docker with Docker Compose. You can use the MongoDB the installation starts or an external
    one. See [Self-host](self-host/index.md) and [Installation](installation.md).

??? question "How do I upgrade to a new version?"
    Back up the database, read the [release notes](release-notes/index.md) and follow
    [Maintenance and upgrades](self-host/maintenance.md).

??? question "Something doesn't work in my installation"
    Check [Troubleshooting](self-host/troubleshooting.md). If it's a bug, open an issue on
    [GitHub](https://github.com/diagramahub/diagramahub/issues); if it's a vulnerability, report
    it privately as described in [Security](security/index.md).
