# FabricPort Fix List: status

**Date:** 27 October 2026
**Against:** FabricPort Fix List dated 9 October 2026 (48 items)
**Code branch:** `fix-list-oct-2026`

**What the statuses mean**

- **Done**: built, and the database side is already live. The screen changes go live with the next frontend release.
- **Done with change**: built, but not exactly as described, because the cause or the best fix turned out to be different. The note says what you will see.
- **Partly done**: the bug part is fixed; the feature part is scoped out below.
- **Needs client**: the code is ready and waits on something only you can supply.
- **Not doing**: explained in the note; we recommend against it or it needs a separate decision.

Pages under /buyer, /private-portal and /supplier-portal still need the DKC buyer and Rantex supplier logins to see.

---

## Login and accounts

| # | Their request | Status | What was done |
|---|---|---|---|
| 1 | Add a password reset email flow | Done | "Forgot password?" on the login page, a reset page, and expired-link handling. Emails go out through Supabase's built-in mailer until Resend is set up (see "What we need from you"). |
| 2 | Add Terms and Privacy pages, link them in the footer, consent tick on sign-up | Partly done | /privacy shows your Privacy Policy word for word with an effective date. /terms is a holding page because no Terms text has been supplied. Both are linked in the footer. Sign-up requires the consent tick and records when it was accepted. The old site's pages were placeholders ("we are working on the contents of this page"), so nothing could be carried over. |
| 3 | Add Change password and show the email | Done | Both buyer and supplier settings show the account email and a Change password card that checks the current password first. |
| 4 | Pass a return URL after login | Done with change | The Inquire button already returned buyers to the fabric; the return was lost only from "Create account" and a few other sign-in links. All of them now carry it, including through sign-up. |
| 5 | Make company required, add phone/WhatsApp, add Google sign-in | Partly done | Company and phone are required, WhatsApp is optional, and numbers are validated. Google sign-in is item 47. |
| 15 | Show a proper 404 page | Done | Unknown addresses show a 404 page with links back to the home page and marketplace, including inside the portals. |

## Prices, quantity and cart

| # | Their request | Status | What was done |
|---|---|---|---|
| 6 | Convert per-yard prices | Done | Switching M to Y now converts the price as well as the stock, everywhere a price is shown. |
| 7 | Quantity limited to MOQ through stock, whole metres, checked on the server | Done | The fabric page, cart drawer and cart page clamp the quantity with a message. The server rejects anything outside 1 to 10,000,000 whole metres, and the database refuses to store a bad quantity. |
| 8 | Use the one Settings rate everywhere | Done | USD is always converted from PKR using the rate in Settings. Stored USD prices and the hidden fallback rate are no longer used. |
| 9 | Refresh the rate daily from the NBP sheet | Done with change | A daily job refreshes the rate at 08:00 PKT. The State Bank publishes no machine-readable rate, so the feed stays the same provider; Settings gains a manual override field and shows the rate source and last refresh. The job needs two secrets set on the project before it runs (our side). |
| 10 | Round PKR to whole rupees | Done | PKR shows whole rupees everywhere, including invoices and the PDF. USD keeps two decimals. |

## Marketplace and public pages

| # | Their request | Status | What was done |
|---|---|---|---|
| 11 | Stop the sideways scroll on phones | Done | The sort, currency and unit controls wrap onto their own row on narrow screens. |
| 12 | Trim the search and match more fields | Done | Search now trims and matches fabric name, mill, fibre, weave and colour. "azgard" and "twill" will return their fabrics. |
| 13 | Stop card values being cut off | Done | The price has its own row and the composition wraps to two lines. |
| 14 | Per-page titles, share previews, robots.txt, sitemap | Done with change | Each page has its own title and description, robots.txt and a sitemap are live, and WhatsApp, Facebook, Google and other crawlers receive the fabric or mill name, description and image for share previews. The site is not fully server-rendered; that would be a rebuild for little extra benefit. Submit the sitemap to Google Search Console once released. |
| 16 | Build filters from fixed values and hide junk | Partly done | The filters now drop values like "NA", "None" and "Pattern", hide options with no fabrics, and the group is labelled "Availability". Correcting entries such as "Jearsy" and "Greige Stock" is data clean-up on your side (see item 41 for the new dropdowns). |
| 17 | Hide suppliers with nothing to show | Done | Mills with no public fabrics no longer appear on /vendors, in the Supplier filter or in the "verified mills" count. |
| 18 | Count only live public fabrics on the home page | Done | The home page counts match the marketplace for everyone. |
| 19 | Fix "301 GSM GSM" and the oz figure | Done | Carousel labels use the same weight and width formatting as the marketplace. |
| 20 | Fix plurals and the VERIFIED badge | Done | "1 fabric" and "2 fabrics" read correctly, and VERIFIED shows on every verified mill. |

## Inquiries, samples and buyer portal

| # | Their request | Status | What was done |
|---|---|---|---|
| 21 | Auto-send an opening message with fabric, quantity and notes | Done | Every inquiry, from a fabric page or the cart, opens with a message listing the fabrics, quantities and notes. The cart drawer also has an optional note box. |
| 22 | Set Responded on the first supplier reply; one formula everywhere | Done | The first supplier reply marks the inquiry Responded (existing inquiries were updated). The dashboard, analytics and admin reports now share one definition, described under "Decisions we made". |
| 23 | Read specs from the same source as the fabric page | Done | Wishlist, supplier inventory and shared catalogues show GSM, width and composition the same way the fabric page does. |
| 24 | Enforce "Sample available" | Done | When samples are off, the button is replaced by a note and the database refuses the request. |
| 25 | Private portal shows prices awaiting approval | Done with change | Neither the marketplace nor the private portal was hiding them. Both now show "Price on request" until the admin approves the price. |
| 26 | Fix recently viewed fabrics | Done | Viewing a fabric is now recorded and the dashboard panel fills. |
| 27 | Breadcrumb for private fabrics | Done | Private fabrics link back to the private portal and that mill. |
| 28 | Richer inquiry lists | Done | Both lists show the fabrics, total quantity, the last message and unread counts. |
| 29 | Sample message overpromises | Done | The confirmation now reads "Sample requested, waiting for the mill to accept". |
| 38 | Buyer sometimes anonymous, sometimes named | Done with change | There was no anonymity rule; three supplier screens were reading a field they could not access and falling back to "Buyer". All supplier screens now show the buyer's company name. |
| 39 | Exclude staff and own visits from analytics | Done | Admin, demo accounts and the mill's own visits are no longer recorded or shown. |
| 40 | Mark Shipped fails silently | Done with change | The current build already showed an error toast, which is easy to miss. The button is now disabled until a tracking number is entered, with the hint shown next to the field. |

## Supplier portal

| # | Their request | Status | What was done |
|---|---|---|---|
| 30 | Only re-open approval when the price changes | Done with change | The database already handled this correctly; the supplier form was sending "needs approval" on every save. Saving now resets approval only when a price field changed. |
| 31 | Confirm Save Draft, open the saved invoice, manage drafts | Done | Save Draft blocks double clicks, confirms, and returns to the list with the draft highlighted. Drafts can be opened, edited and cancelled. |
| 32 | Confirm before sending; view, PDF, record payment, cancel | Partly done | Send asks for confirmation and shows the buyer and total. Sent invoices can be opened, downloaded as PDF and cancelled. Recording a payment stays an admin action, as designed; suppliers see the payment status read-only. |
| 33 | Block prices of 0 or less; add terms, tax and freight; editable lines | Done | Unit price must be above zero, quantities and due date are editable, lines can be added from the mill's own fabrics. Tax defaults from admin settings and can be changed per invoice, on the total or per line. Freight, payment terms and notes are included and appear on the PDF and the buyer's invoice page. |
| 34 | Validate supplier forms and confirm each save | Done with change | Stock, MOQ, prices and phone numbers are validated with inline messages and the database refuses bad values. Inventory already showed a "Product updated" toast; settings now shows one too. The list keeps its order after a save. |
| 35 | Let suppliers share private fabrics with chosen buyers | Not doing | Suppliers cannot currently see the buyer list, and deciding which buyers a mill may see is a privacy decision for FabricPort. Ready to build once you decide. |
| 36 | Let suppliers edit GSM, width, composition and weave | Done | All four fields are on the supplier edit form. |
| 37 | Make shared catalogue links useful | Done | Each fabric opens a detail view with specs, price (if approved), Inquire and Request a sample. Visitors are asked to sign in and brought back. The logo is visible on the cream header and the fabric count updates immediately. |

## Admin panel

| # | Their request | Status | What was done |
|---|---|---|---|
| 41 | Rename Type to Availability, make attributes dropdowns, % on Elongation | Partly done | "Type" is now "Availability" with Stock / Running / Development. The Attributes page can give any attribute a list of options, and Elongation shows %. Re-tagging the 65 denim listings and other existing values is data clean-up on your side; the dropdowns stop new junk. |
| 42 | Show fabric and quantity on inquiries; add search and filter; full email on buyers | Done | Admin inquiry detail lists the fabrics and quantities, the list has search and a status filter, and the buyers list shows the full email. |
| 43 | Format the audit trail | Done | The Detail column reads as plain "email: x · role: buyer" text. |
| 44 | Add an admin "view as" mode | Not doing | Signing in as a user is a security risk we advise against. Reset password remains available for testing; a demo account (item 45) is the cleaner way to test. |
| 45 | Add a test-account flag excluded from counts | Done | Users can be marked "Demo account" from the admin Users page. Demo accounts are left out of reports, dashboard counts, supplier analytics and visitor stats. |

## Setup and requests

| # | Their request | Status | What was done |
|---|---|---|---|
| 46 | Set up WhatsApp alerts and confirm inquiry emails reach suppliers | Needs client | Code is ready and deployed. WhatsApp needs your Twilio account and approved sender; email needs your Resend key and domain records. Until then, nothing is sent. Emails had never been reaching anyone (see below). |
| 47 | Add Google sign-in | Needs client | Needs your Google Cloud OAuth client ID and secret. Code is a small change once we have them. |
| 48 | Set up a staging copy | Not doing | Replaced by the demo account flag (item 45): test buyers, suppliers and inquiries stay on the live site but no longer count anywhere. A second environment would double the setup and still miss real data. |

---

## Found and fixed beyond the list

While working through the list we found and fixed these, all live now:

- **Sign-up could create an admin.** The sign-up step accepted an "admin" role from the browser. It now only accepts buyer or supplier; admins are created only from the admin panel.
- **Emails were never sent.** The notification code read the recipient's email address from the wrong place, so every email was skipped even where email was configured. This is why no inquiry emails ever reached suppliers.
- **Invoices could be created already marked paid.** New invoices now always start as unpaid drafts.
- **Notification and rate-refresh functions had no caller check.** Both now require a signed-in session or an admin.
- **Shared catalogue links exposed draft fabrics and unapproved prices.** They now show only published fabrics, and prices only once approved.

## What we need from you

1. **Resend** (email): create an account, add fabricport.com as a domain, add the DNS records it shows, and send us an API key. Password reset, inquiry and invoice emails all depend on this.
2. **Twilio** (WhatsApp): account SID, auth token, and an approved WhatsApp Business sender number.
3. **Google sign-in**: an OAuth client ID and secret from a FabricPort Google Cloud project. We will send the exact redirect address to whitelist.
4. **Terms of Service text.** The old site never had any; /terms is a holding page until you supply it.
5. **Data clean-up** you said you would handle: the misspelt and misfiled attribute values behind items 16 and 41, now that each attribute can be a dropdown.
6. **Which accounts are demo accounts.** Tell us (or tick them yourself in Admin → Users) so they drop out of the numbers.

## Decisions we made

- **Demo flag instead of a staging site** (items 45 and 48). Testing stays on the live site, flagged accounts are excluded from every count.
- **One response-rate definition.** An inquiry counts as responded when the supplier has sent at least one message. The rate is measured over inquiries from the last 90 days, excluding demo accounts. The median reply time is the time to the supplier's first message. The supplier dashboard, analytics and admin reports all use this.
- **Buyers are named.** Suppliers see the buyer's company name on every screen, which was already the case on most of them.
- **Prices awaiting approval show "Price on request"** on both the marketplace and the private portal, rather than hiding the fabric.
- **Tax design.** A default rate (18%) and payment terms are set in admin settings. Each invoice can change the rate, choose tax on the total or per line, and add freight. Totals are calculated on the server so the PDF and the buyer's view always match.
- **Search engine previews without a rebuild.** Crawlers get page-specific titles and images from a small edge function; regular visitors keep the current app.
