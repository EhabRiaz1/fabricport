# Email setup (hosted Supabase project `wrbphdcgzcdesgslijuz`)

FabricPort sends two kinds of email:

| Kind | Sent by | Content lives in |
| --- | --- | --- |
| Auth (confirm sign-up, password reset, magic link, email change, invite) | Supabase Auth over SMTP | `supabase/templates/*.html` |
| Notifications (inquiries, messages, samples, invoices, payments, listing updates) | `send-notification` edge function via the Resend API | `supabase/functions/send-notification/templates.ts` + `supabase/functions/_shared/email-layout.ts` |

Both use the same layout and the hosted logo at `https://fabricport.com/email/logo@2x.png`
(regenerate with `npx tsx scripts/export-email-logo.ts`; the file must be deployed with the site
before emails go out, or the header shows a broken image).

`supabase/config.toml` only affects the local CLI stack. Everything below has to be done by hand
on the hosted project.

## 1. Resend domain and DNS

1. In Resend, add the domain `fabricport.com` and verify it.
2. Add the DNS records Resend shows (at the DNS host for fabricport.com):
   - **SPF**: the TXT record Resend gives for its sending subdomain (usually `send.fabricport.com`,
     `v=spf1 include:amazonses.com ~all`). If the root domain already has an SPF record, merge the
     `include:` into it; a domain must have only one SPF record.
   - **DKIM**: the `resend._domainkey` TXT record, copied exactly.
   - **MX** for the bounce subdomain, if Resend lists one.
   - **DMARC** (TXT on `_dmarc.fabricport.com`):
     `v=DMARC1; p=quarantine; rua=mailto:dmarc@fabricport.com`
     Make sure the `dmarc@fabricport.com` mailbox exists, or reports bounce.
3. Wait until Resend shows the domain as Verified.
4. Create an API key with "Sending access" for this domain.

## 2. Edge function secrets (notifications)

Dashboard → Edge Functions → Secrets (or `supabase secrets set ...`):

| Secret | Value |
| --- | --- |
| `RESEND_API_KEY` | the Resend API key from step 1 |
| `RESEND_FROM` | `FabricPort <notifications@fabricport.com>` (any address on the verified domain) |

Without `RESEND_API_KEY` the function still creates the in-app notification and reports
`email: "not_configured"` in its response. Replies go to `support@fabricport.com` (`reply_to`).
Each email carries `List-Unsubscribe` (the recipient's settings page plus a mailto) and
`X-Entity-Ref-ID` (the notification id).

Redeploy the function after changing the code: `supabase functions deploy send-notification`.

## 3. Custom SMTP for auth emails

Supabase's built-in mailer is rate-limited to a handful of emails per hour and sends from a
supabase.io address. Switch it to Resend:

Dashboard → Authentication → Emails → SMTP Settings → Enable custom SMTP:

| Field | Value |
| --- | --- |
| Sender email | `no-reply@fabricport.com` |
| Sender name | `FabricPort` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a Resend API key (can be the same one, or a separate key) |

Then Authentication → Rate Limits: raise "emails sent per hour" from the default to something
sensible (for example 100).

## 4. Auth email templates

Dashboard → Authentication → Emails → Templates. For each template, set the subject and paste the
whole HTML file:

| Template | Subject | File |
| --- | --- | --- |
| Confirm signup | Confirm your FabricPort email address | `supabase/templates/confirmation.html` |
| Reset password | Reset your FabricPort password | `supabase/templates/recovery.html` |
| Magic link | Your FabricPort sign-in link | `supabase/templates/magic_link.html` |
| Change email address | Confirm your new FabricPort email address | `supabase/templates/email_change.html` |
| Invite user | You've been invited to FabricPort | `supabase/templates/invite.html` |

The templates use the Supabase variables `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`
and `{{ .NewEmail }}`; leave them as they are. They were generated from `renderEmail()` in
`_shared/email-layout.ts`, so if the layout changes, update the HTML files to match.

## 5. URL configuration

Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://fabricport.com`
- **Redirect URLs** (allow-list), at least:
  - `https://fabricport.com/auth/reset-password`
  - `https://fabricport.com/**`
  - `https://www.fabricport.com/**` (if www is served)
  - your Vercel preview pattern if you test resets on previews, e.g. `https://*-<team>.vercel.app/**`
  - `http://localhost:5173/**` for local development

The forgot-password page calls `resetPasswordForEmail(email, { redirectTo: <origin>/auth/reset-password })`.
If that URL is not on the allow-list, Supabase silently falls back to the Site URL and the user
lands on the home page instead of the reset form.

## 6. Test checklist

Run these against production after the steps above, using a real inbox (Gmail) and, if possible,
Outlook:

- [ ] Register a new account: confirmation email arrives (if confirmations are on), from
      `no-reply@fabricport.com`, logo shows, button works.
- [ ] Forgot password: email arrives within a minute, button opens `/auth/reset-password`, new
      password can be set and used to sign in.
- [ ] Change email in settings (if offered): both addresses get the expected mail.
- [ ] Buyer sends an inquiry: supplier gets "New inquiry on FabricPort", button opens
      `/supplier-portal/inquiries/<id>`.
- [ ] Supplier replies in chat: buyer gets "New message from …", button opens the inquiry.
- [ ] Sample request, sample status change, invoice sent, payment recorded, listing update: each
      email arrives with the right subject and link (see the type table in
      `send-notification/templates.ts`).
- [ ] In Gmail, "Show original": SPF, DKIM and DMARC all `PASS`.
- [ ] Gmail dark mode and Outlook: header, button and text are readable.
- [ ] Plain-text part present ("Show original" shows `text/plain` alongside `text/html`).
- [ ] Unsubscribe link in Gmail's header goes to the recipient's settings page.
- [ ] Check https://www.mail-tester.com score with one notification (aim for 9+/10).
