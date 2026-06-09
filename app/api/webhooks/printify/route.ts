import { Resend } from "resend";
import { attachTracking, getEmailForOrder } from "@/lib/orders-store";

export const runtime = "nodejs";

// Printify's exact payload for the shipment event is not firmly documented, so we
// read defensively from several plausible locations.
interface ShipmentLike {
  number?: string;
  tracking_number?: string;
  url?: string;
  tracking_url?: string;
  carrier?: { tracking_url?: string };
}
interface ShipmentData {
  order_id?: string | number;
  id?: string | number;
  email?: string;
  tracking_number?: string;
  tracking_url?: string;
  shipments?: ShipmentLike[];
}
interface ShipmentEvent {
  type?: string;
  event?: string;
  email?: string;
  data?: ShipmentData;
  resource?: { id?: string | number; data?: ShipmentData };
}

function shippedEmailHtml(trackingNumber?: string, trackingUrl?: string): string {
  const tracking = trackingNumber
    ? `<p style="margin:16px 0;font-size:16px">Tracking number: <strong>${trackingNumber}</strong></p>`
    : "";
  const button = trackingUrl
    ? `<p style="margin:24px 0"><a href="${trackingUrl}" style="background:#ff5a1f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Track your package</a></p>`
    : "";
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#171717">
      <h1 style="font-size:22px">Your Gotham Goods order shipped 📦</h1>
      <p style="font-size:16px">It's on the way — printed and shipped from NJ, arriving in 2–3 days.</p>
      ${tracking}
      ${button}
      <p style="color:#777;font-size:13px;margin-top:32px">Gotham Goods — officially unofficial NY fan merch.</p>
    </div>`;
}

export async function POST(request: Request) {
  let payload: ShipmentEvent;
  try {
    payload = (await request.json()) as ShipmentEvent;
  } catch {
    return new Response("bad json", { status: 200 });
  }

  const type = payload.type ?? payload.event;
  if (type !== "order:shipment:created") {
    return new Response("ignored", { status: 200 });
  }

  const data: ShipmentData = payload.resource?.data ?? payload.data ?? {};
  const orderId = String(data.order_id ?? data.id ?? payload.resource?.id ?? "");
  const shipment = data.shipments?.[0];
  const trackingNumber =
    shipment?.tracking_number ?? shipment?.number ?? data.tracking_number;
  const trackingUrl =
    shipment?.tracking_url ??
    shipment?.url ??
    shipment?.carrier?.tracking_url ??
    data.tracking_url;

  try {
    await attachTracking(orderId, trackingNumber, trackingUrl);

    const to =
      data.email ??
      payload.email ??
      (orderId ? await getEmailForOrder(orderId) : undefined);

    if (process.env.RESEND_API_KEY) {
      if (to) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "Gotham Goods <onboarding@resend.dev>",
          to,
          subject: "Your Gotham Goods order has shipped 📦",
          html: shippedEmailHtml(trackingNumber, trackingUrl),
        });
      } else {
        console.warn("printify webhook: no buyer email found; skipping email", {
          orderId,
        });
      }
    } else {
      console.log("printify webhook: RESEND not configured; would email tracking", {
        orderId,
        to,
        trackingNumber,
        trackingUrl,
      });
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    // Transient send error -> 500 so the sender retries.
    console.error("printify webhook: failed", err);
    return new Response("send error", { status: 500 });
  }
}
