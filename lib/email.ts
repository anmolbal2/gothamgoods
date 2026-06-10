/**
 * Transactional email for Gotham Goods. Currently: the order-confirmation receipt
 * sent right after checkout (mirrors the on-site /thank-you screen).
 *
 * Email-client-safe HTML only: inline styles, a centered ~520px container, and
 * web-safe fonts (Anton/Geist don't load in email, so we use bold uppercase Arial
 * to evoke the display look). Brand colors: ink #0b1020, paper #fff, cream #f4efe2,
 * orange #f5821f.
 */
import { Resend } from "resend";

export interface ReceiptItem {
  name: string;
  quantity: number;
}

const SITE = "https://gotham-goods.com";

// Internal "you made a sale" notifications always go here, regardless of buyer.
const SALES_NOTIFY_TO = "anmolbal@berkeley.edu";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Branded HTML receipt mirroring the /thank-you confirmation card. */
export function orderConfirmationHtml({
  items,
  totalCents,
}: {
  items: ReceiptItem[];
  totalCents: number;
}): string {
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:12px 0;border-top:1px solid #e3dcc9;font-weight:bold;font-size:15px;color:#0b1020">${esc(it.name)}</td>
        <td style="padding:12px 0;border-top:1px solid #e3dcc9;text-align:right;font-family:'Courier New',monospace;font-size:13px;color:#0b102099">&times;${it.quantity}</td>
      </tr>`,
    )
    .join("");

  return `
  <div style="background:#f4efe2;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:2px solid #0b1020;padding:32px">
      <span style="display:inline-block;background:#f5821f;color:#0b1020;padding:5px 8px;font-family:'Courier New',monospace;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px">Order confirmed</span>
      <h1 style="margin:18px 0 0;font-size:30px;line-height:1.05;text-transform:uppercase;letter-spacing:-0.5px;color:#0b1020">You're in. &#127936;</h1>
      <p style="margin:10px 0 0;font-size:15px;color:#0b1020cc">Shipped from New Jersey — it lands in 2–3 days. Here's what you grabbed:</p>

      <table style="width:100%;border-collapse:collapse;margin:22px 0 0;border-bottom:2px solid #0b1020">
        <tbody>${rows}</tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;margin:14px 0 0">
        <tr>
          <td style="font-family:'Courier New',monospace;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#0b102099">Total</td>
          <td style="text-align:right;font-size:26px;font-weight:bold;color:#0b1020">${money(totalCents)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:4px;font-family:'Courier New',monospace;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#f5821f">Free shipping</td>
        </tr>
      </table>

      <a href="${SITE}" style="display:inline-block;margin:26px 0 0;background:#0b1020;color:#f4efe2;padding:13px 20px;text-decoration:none;font-family:'Courier New',monospace;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px">Back to the store →</a>

      <p style="margin:28px 0 0;font-size:12px;color:#0b102080;line-height:1.5">Gotham Goods — officially unofficial New York fan merch. Questions? Just reply to this email.</p>
      <p style="margin:8px 0 0;font-size:11px;color:#0b102066;line-height:1.5">Fan-made. Not affiliated with the NBA, any team, or any brand.</p>
    </div>
  </div>`;
}

/**
 * Send the order-confirmation receipt. No-op (logs) when Resend isn't configured
 * or there's no recipient. Throws on a Resend API error — callers should treat
 * sending as non-fatal (log, don't fail the request).
 */
export async function sendOrderConfirmationEmail({
  to,
  items,
  totalCents,
}: {
  to: string | undefined;
  items: ReceiptItem[];
  totalCents: number;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log("email: RESEND not configured; would send receipt", { to, totalCents });
    return;
  }
  if (!to) {
    console.warn("email: no recipient; skipping receipt");
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Gotham Goods <onboarding@resend.dev>",
    to,
    subject: "You're in 🏀 — your Gotham Goods order",
    html: orderConfirmationHtml({ items, totalCents }),
  });
}

export interface SaleInfo {
  items: ReceiptItem[];
  totalCents: number;
  buyerEmail?: string;
  shipName?: string;
  shipCity?: string;
  shipRegion?: string;
  printifyOrderId?: string;
}

/** Plain, scannable internal notification of a new sale (for the owner). */
export function saleNotificationHtml(s: SaleInfo): string {
  const rows = s.items
    .map(
      (it) =>
        `<tr><td style="padding:4px 0;color:#0b1020">${esc(it.name)}</td><td style="padding:4px 0;text-align:right;color:#0b102099">&times;${it.quantity}</td></tr>`,
    )
    .join("");
  const shipTo = [s.shipName, [s.shipCity, s.shipRegion].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" — ");
  const line = (label: string, val?: string) =>
    val ? `<p style="margin:4px 0;font-size:14px;color:#0b1020"><strong>${label}:</strong> ${esc(val)}</p>` : "";
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0b1020">
    <h1 style="font-size:22px;margin:0 0 4px">🛒 New sale — ${money(s.totalCents)}</h1>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;border-top:1px solid #e3dcc9;border-bottom:1px solid #e3dcc9">
      <tbody>${rows}</tbody>
    </table>
    ${line("Total", money(s.totalCents))}
    ${line("Buyer", s.buyerEmail)}
    ${line("Ship to", shipTo || undefined)}
    ${line("Printify order", s.printifyOrderId)}
    <p style="margin:16px 0 0;font-size:12px;color:#0b102080">Gotham Goods — automated sale alert.</p>
  </div>`;
}

/**
 * Internal sale alert to the owner (SALES_NOTIFY_TO) on every order. Best-effort:
 * no-op (logs) when Resend isn't configured; throws on a Resend API error so the
 * caller can log it non-fatally.
 */
export async function sendSaleNotification(s: SaleInfo): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log("email: RESEND not configured; would send sale alert", {
      totalCents: s.totalCents,
    });
    return;
  }
  const first = s.items[0]?.name ?? "order";
  const extra = s.items.length > 1 ? ` +${s.items.length - 1} more` : "";
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Gotham Goods <onboarding@resend.dev>",
    to: SALES_NOTIFY_TO,
    subject: `🛒 New sale — ${money(s.totalCents)} — ${first}${extra}`,
    html: saleNotificationHtml(s),
  });
}
