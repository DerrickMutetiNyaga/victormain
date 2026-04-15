# Form email (Nodemailer) – cPanel checklist

Your app sends form submissions via **business@infusionjaba.co.ke** using SMTP. If you get connection timeouts, use this checklist in cPanel (HostPinnacle).

## 1. Open the email account

- Log in to cPanel.
- Go to **Email** → **Email Accounts**.
- Find **business@infusionjaba.co.ke** and click **Manage**.

## 2. Allow outgoing mail (required)

In **Restrictions**:

- **Sending Outgoing Mail** must be **Allow** (not Suspend or Hold).
- If it was Suspend or Hold, change to **Allow** and click **Update Email Settings**.

## 3. Confirm SMTP settings

In the same **Manage** page:

- Click **Connect Devices** (or **Set Up Mail Client**).
- Note the **outgoing** settings. The app expects:
  - **Server:** `mail.infusionjaba.co.ke`
  - **Port:** `465` (SSL) or `587` (STARTTLS)
  - **Username:** `business@infusionjaba.co.ke`
  - **Password:** the account password (same as in `.env` as `SMTP_PASSWORD`)

Your `.env` should have:

```env
SMTP_EMAIL=business@infusionjaba.co.ke
SMTP_PASSWORD=your_password_here
SMTP_HOST=mail.infusionjaba.co.ke
SMTP_PORT=587
FORM_SUBMISSION_TO=dee254041@gmail.com
```

SMTP_PORT=465
FORM_SUBMISSION_TO=jaba.infusion@gmail.com
```

## 3a. Test if your machine can reach the SMTP port

In **PowerShell** run:

```powershell
Test-NetConnection mail.infusionjaba.co.ke -Port 465
```

- If **TcpTestSucceeded : False** → your network/ISP/firewall is blocking SMTP. Use Gmail SMTP (section 4) or run the app on a server that allows outbound SMTP.
- If **TcpTestSucceeded : True** → the port is reachable; the issue is likely TLS or credentials.

## 3b. Test SMTP connection from the app

With the dev server running, open in browser or curl:

```
http://localhost:3000/api/submit-form
```

(GET request.) The response shows whether the SMTP connection and `verify()` succeeded. If it times out, check the terminal for `logger: true` / `debug: true` output. Same as 3a: if verify() times out, it’s network/port/host, not credentials.

## 4. If it still times out

Many networks block outbound SMTP (ports 465/587) to cPanel. You can still send using **Gmail SMTP**:

1. Use a Gmail account (e.g. jaba.infusion@gmail.com).
2. Create an **App Password**: Google Account → Security → 2-Step Verification → App passwords → generate.
3. In `.env`, switch to Gmail and set the app password:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=465`
   - `SMTP_EMAIL=jaba.infusion@gmail.com`
   - `SMTP_PASSWORD=your_16_char_app_password`
   - Keep `REPLY_TO=business@infusionjaba.co.ke` so replies go to your business address.

Emails will be sent via Gmail and delivered to `FORM_SUBMISSION_TO`; recipients can reply to `business@infusionjaba.co.ke`.
