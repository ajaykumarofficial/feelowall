# Setting Up the New Features

Everything works without these steps, except the features they name, which say they're unavailable until set up. Values go in `backend/.env`. See `backend/.env.example` for every option.

## Do this first

1. **Make yourself an admin.** Register normally, then run:
   ```bash
   cd backend
   npm run make-admin -- <your-username>
   ```
   Then turn on two-factor authentication under Account Settings. Staff tools stay locked until you do.
2. **Set your public addresses:** `FRONTEND_URL` and `API_PUBLIC_URL`. Emails, sign-in, payments, and share links all use them.
3. **Fill in image sizes for existing wallpapers,** so they appear in resolution and orientation filters:
   ```bash
   npm run backfill:images
   ```
4. **Behind a reverse proxy?** Set `TRUST_PROXY` to the number of proxies. Otherwise all visitors share one rate limit.
5. **Turn on database backups.** See [backup-restore.md](backup-restore.md).

## Optional services

| Feature | What to set | Where to get it |
|---|---|---|
| Google, GitHub, and Discord sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the same pair for each provider | Each provider's developer console. Register `<FRONTEND_URL>/oauth/callback/google` (or `github`, `discord`) as the redirect URL. |
| Email confirmation and password reset | `SMTP_URL`, `MAIL_FROM` | Any email provider. In development, without `SMTP_URL`, links print to the server log. |
| Tips and paid packs | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe, with Connect enabled. See below. |
| AI suggestions, moderation pre-check, and natural-language search | `ANTHROPIC_API_KEY` | The Claude Console. Costs are per use. See below. |
| Error alerts | `ERROR_WEBHOOK_URL` | Any webhook, such as Slack or Discord. |

### Stripe

1. Enable **Connect** on your Stripe account, and use test keys first.
2. Add a webhook pointing to `<API_PUBLIC_URL>/api/payments/webhook`, covering both your own account and connected accounts, with these events:
   - `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`
   - `charge.refunded`
   - `account.updated`
3. Decide on these before taking real money:
   - **Platform fee:** `PLATFORM_FEE_PERCENT` defaults to 0, so creators keep everything after Stripe's fees.
   - **Tax:** `STRIPE_AUTOMATIC_TAX=true` turns on Stripe Tax, which you must also enable and register for in Stripe. It's off by default, so no tax is collected.
   - **Refunds:** issue them from the Stripe dashboard. A full refund withdraws the buyer's access automatically. Partial refunds keep access. Disputes aren't handled automatically.

### AI features

These send images, or search text, to Anthropic's API. They use `claude-opus-5-5` by default. To reduce costs, set `AI_MODEL` to a cheaper model such as `claude-haiku-5-5`, and check the results still meet your standard.

- **Upload suggestions** run only when a creator clicks the button.
- **The moderation pre-check runs on every upload,** so it's the main ongoing cost. It only ever adds an item to the moderation queue.

Mention this data sharing in your privacy policy.

## Existing data

- **Old simulated-OAuth accounts** have fake provider IDs and random passwords, so nobody can sign in to them. If any matter, have the user set an email in the database and use password reset.
- **Existing users have no email address.** They see a dismissible reminder until they add one.
