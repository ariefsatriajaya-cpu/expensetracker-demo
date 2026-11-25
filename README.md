# Expense Tracker

Telegram bot + mobile dashboard (Next.js, Neon Postgres, Vercel).

## Setup
1. @BotFather → `/newbot` → copy token. Get your user ID from @userinfobot.
2. Create a Neon Postgres DB (Vercel → Storage, or neon.tech); copy the connection string.
3. Copy `.env.example` to `.env.local` and fill in. Generate secrets with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
4. `npm run dev`, then log in at http://localhost:3000.

## Deploy
1. Push to GitHub, import in Vercel, add the 6 env vars, deploy.
2. Register the webhook (replace values):
   ```
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-app>.vercel.app/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```
3. Message the bot: `nasi goreng 25k`. Commands: `/today`, `/undo`.
4. Open the site on your phone → "Add to Home Screen".

Tests: `npm test`.
