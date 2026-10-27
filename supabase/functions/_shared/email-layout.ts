/**
 * Branded transactional email layout shared by send-notification (and mirrored,
 * as static HTML, by the auth templates in supabase/templates/).
 *
 * Constraints this is built around:
 *  - Table layout, inline CSS only. Gmail strips <style> in some contexts and
 *    Outlook desktop renders with Word's engine, so no flexbox / grid / classes.
 *  - Every table and the body carry an explicit background colour, and the logo
 *    is an opaque PNG on white, so dark-mode clients can't invert it into mush.
 *  - The logo is hosted (https://fabricport.com/email/logo@2x.png), never
 *    base64: inline images are stripped or flagged by Gmail and Outlook.
 *  - The button is a table cell with padding, not an image.
 *  - Real text body, a plain-text twin, a preheader, and a reason-for-email
 *    line in the footer: the usual anti-spam hygiene.
 */

export interface EmailRow {
  label: string
  value: string
}

export interface EmailCta {
  label: string
  url: string
}

export interface RenderEmailInput {
  /** Hidden preview text shown next to the subject in inbox lists. */
  preheader: string
  heading: string
  /** Paragraphs. A string is one paragraph. */
  intro: string | string[]
  rows?: EmailRow[]
  cta?: EmailCta
  outro?: string | string[]
  footerNote?: string
  /** Picks which settings page the "Notification preferences" link opens. */
  recipientRole?: 'buyer' | 'supplier' | 'admin' | null
}

export interface RenderedEmail {
  html: string
  text: string
}

export const SITE_URL = 'https://fabricport.com'
export const LOGO_URL = `${SITE_URL}/email/logo@2x.png`
export const SUPPORT_EMAIL = 'support@fabricport.com'

// Site palette (src/index.css), chosen for contrast on email backgrounds.
const C = {
  page: '#F6F1E9', // --color-background
  card: '#FFFFFF',
  band: '#FFFFFF',
  border: '#DDD4C2', // --color-border
  ink: '#2C1A0E', // --color-ink
  text: '#3C2A1A', // --color-ink-soft
  muted: '#5C4A38', // --color-text-secondary
  faint: '#9C8870', // --color-text-muted
  accent: '#E8593C', // --color-accent
  accentText: '#FFFFFF',
  rowBg: '#F6F1E9',
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function paragraphs(input: string | string[] | undefined): string[] {
  if (!input) return []
  return (Array.isArray(input) ? input : [input]).map((p) => p.trim()).filter(Boolean)
}

export function preferencesUrl(role: RenderEmailInput['recipientRole']): string {
  if (role === 'supplier') return `${SITE_URL}/supplier-portal/settings`
  if (role === 'admin') return `${SITE_URL}/admin/settings`
  return `${SITE_URL}/buyer/settings`
}

function renderParagraph(text: string, color = C.text): string {
  return `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:24px;color:${color};">${escapeHtml(text)}</p>`
}

function renderRows(rows: EmailRow[]): string {
  if (rows.length === 0) return ''
  const cells = rows
    .map(
      (row, i) => `
        <tr>
          <td style="padding:10px 16px;border-top:${i === 0 ? '0' : `1px solid ${C.border}`};font-family:${FONT};font-size:13px;line-height:18px;color:${C.muted};text-transform:uppercase;letter-spacing:0.04em;width:38%;vertical-align:top;">${escapeHtml(row.label)}</td>
          <td style="padding:10px 16px;border-top:${i === 0 ? '0' : `1px solid ${C.border}`};font-family:${FONT};font-size:15px;line-height:20px;color:${C.ink};vertical-align:top;">${escapeHtml(row.value)}</td>
        </tr>`,
    )
    .join('')
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border:1px solid ${C.border};border-radius:6px;background-color:${C.rowBg};margin:4px 0 20px 0;">
      ${cells}
    </table>`
}

export function renderButton(cta: EmailCta): string {
  const url = escapeHtml(cta.url)
  const label = escapeHtml(cta.label)
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">
      <tr>
        <td align="center" bgcolor="${C.accent}" style="border-radius:6px;background-color:${C.accent};mso-padding-alt:14px 28px;">
          <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%;mso-text-raise:22pt;">&nbsp;</i><![endif]-->
          <a href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;line-height:18px;color:${C.accentText};text-decoration:none;border-radius:6px;background-color:${C.accent};mso-text-raise:11pt;">${label}</a>
          <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%;">&nbsp;</i><![endif]-->
        </td>
      </tr>
    </table>
    <p style="margin:-12px 0 20px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint};">If the button doesn't work, copy this link into your browser:<br><a href="${url}" style="color:${C.muted};text-decoration:underline;word-break:break-all;">${url}</a></p>`
}

export function renderEmail(input: RenderEmailInput): RenderedEmail {
  const intro = paragraphs(input.intro)
  const outro = paragraphs(input.outro)
  const rows = input.rows ?? []
  const prefs = preferencesUrl(input.recipientRole ?? null)
  const year = new Date().getFullYear()

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(input.heading)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>table,td{font-family:Arial,sans-serif!important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${C.page};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.page};opacity:0;">${escapeHtml(input.preheader)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${C.page}" style="background-color:${C.page};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"><tr><td><![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;">
          <!-- Header band -->
          <tr>
            <td bgcolor="${C.band}" style="background-color:${C.band};padding:22px 32px;border:1px solid ${C.border};border-bottom:0;border-radius:8px 8px 0 0;">
              <a href="${SITE_URL}" target="_blank" style="text-decoration:none;display:inline-block;">
                <img src="${LOGO_URL}" width="180" height="40" alt="FabricPort" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:40px;max-width:180px;">
              </a>
            </td>
          </tr>
          <!-- Body card -->
          <tr>
            <td bgcolor="${C.card}" style="background-color:${C.card};padding:32px 32px 16px 32px;border:1px solid ${C.border};border-top:1px solid ${C.border};">
              <h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:22px;line-height:30px;font-weight:600;color:${C.ink};">${escapeHtml(input.heading)}</h1>
              ${intro.map((p) => renderParagraph(p)).join('')}
              ${renderRows(rows)}
              ${input.cta ? renderButton(input.cta) : ''}
              ${outro.map((p) => renderParagraph(p, C.muted)).join('')}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td bgcolor="${C.page}" style="background-color:${C.page};padding:20px 32px 8px 32px;border:1px solid ${C.border};border-top:0;border-radius:0 0 8px 8px;">
              <p style="margin:0 0 10px 0;font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};">
                <a href="${SITE_URL}/marketplace" style="color:${C.ink};text-decoration:underline;">Marketplace</a>
                &nbsp;&middot;&nbsp;
                <a href="${SITE_URL}/sell" style="color:${C.ink};text-decoration:underline;">Sell fabrics</a>
                &nbsp;&middot;&nbsp;
                <a href="${prefs}" style="color:${C.ink};text-decoration:underline;">Notification preferences</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.ink};text-decoration:underline;">${SUPPORT_EMAIL}</a>
              </p>
              ${input.footerNote ? `<p style="margin:0 0 10px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint};">${escapeHtml(input.footerNote)}</p>` : ''}
              <p style="margin:0 0 6px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint};">You're receiving this because you have a FabricPort account.</p>
              <p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint};">FabricPort &middot; Pakistan &middot; &copy; ${year} FabricPort. All rights reserved.</p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`

  const textLines: string[] = []
  textLines.push(input.heading.toUpperCase(), '')
  for (const p of intro) textLines.push(p, '')
  if (rows.length) {
    for (const r of rows) textLines.push(`${r.label}: ${r.value}`)
    textLines.push('')
  }
  if (input.cta) textLines.push(`${input.cta.label}: ${input.cta.url}`, '')
  for (const p of outro) textLines.push(p, '')
  if (input.footerNote) textLines.push(input.footerNote, '')
  textLines.push(
    '--',
    `FabricPort · ${SITE_URL}`,
    `Marketplace: ${SITE_URL}/marketplace`,
    `Sell fabrics: ${SITE_URL}/sell`,
    `Notification preferences: ${prefs}`,
    `Support: ${SUPPORT_EMAIL}`,
    "You're receiving this because you have a FabricPort account.",
    `FabricPort · Pakistan · © ${year} FabricPort`,
  )

  return { html, text: textLines.join('\n') }
}
