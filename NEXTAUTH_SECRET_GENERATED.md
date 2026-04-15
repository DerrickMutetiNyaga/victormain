# Your NEXTAUTH_SECRET

## Quick Option: Use Online Generator

**Visit this link to generate your secret:**
👉 **https://generate-secret.vercel.app/32**

Just click the link, copy the generated secret, and use it below.

---

## Or Generate Locally

**Option 1: Using Node.js (if you have it)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option 2: Using OpenSSL (if you have it)**
```bash
openssl rand -base64 32
```

**Option 3: Using PowerShell**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

---

## Once You Have Your Secret

1. **Copy the generated secret** (it will look like: `aBc123XyZ789...`)

2. **Add to Vercel:**
   - Go to: https://vercel.com/dashboard
   - Select your project
   - Settings → Environment Variables
   - Add/Edit: `NEXTAUTH_SECRET`
   - Value: `[paste your generated secret]`
   - Environment: Select **Production**, **Preview**, and **Development**
   - Click **Save**

3. **Redeploy your application**

---

## Important Notes

- ✅ Keep this secret secure and private
- ✅ Never commit it to Git
- ✅ Use different secrets for development and production (optional but recommended)
- ✅ The secret should be at least 32 characters long

---

## Example Format

Your secret will look something like this (but longer and different):
```
kX9mP2qR5tV8wY1zA4bC7dE0fG3hI6jK9lM2nO5pQ8rS1tU4vW7xY0zA3bC6dE9f
```

**Note:** This is just an example - generate your own unique secret!

