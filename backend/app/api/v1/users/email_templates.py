"""
Shared HTML email templates.

Houses the MFA verification-code email template used by both the login flow
(``users/routes.py``) and the MFA endpoints (``mfa/routes.py``).
"""


def build_mfa_email_html(code: str, lang: str = "es") -> str:
    """Return an HTML email template for the MFA verification code."""
    if lang == "en":
        title = "Verification code"
        body = (
            "Use the following code to complete your sign in. "
            "This code expires in <strong>10 minutes</strong>."
        )
        footer_note = "If you did not try to sign in, you can ignore this email."
        copyright_text = "&copy; DiagramaHub. All rights reserved."
    else:
        title = "Código de verificación"
        body = (
            "Usa el siguiente código para completar tu inicio de sesión. "
            "Este código expira en <strong>10 minutos</strong>."
        )
        footer_note = "Si no intentaste iniciar sesión, puedes ignorar este correo."
        copyright_text = "&copy; DiagramaHub. Todos los derechos reservados."

    return f"""\
<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#9333ea 100%);padding:28px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">DiagramaHub</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 20px;">
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600;">{title}</h2>
              <p style="margin:0 0 24px;color:#51545e;font-size:15px;line-height:1.6;">
                {body}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <span style="display:inline-block;background-color:#faf5ff;color:#7c3aed;font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 32px;border-radius:8px;border:1px solid #e9d5ff;">
                      {code}
                    </span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#9b9ba5;font-size:13px;line-height:1.5;">
                {footer_note}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #eaeaec;text-align:center;">
              <p style="margin:0;color:#9b9ba5;font-size:12px;">{copyright_text}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
