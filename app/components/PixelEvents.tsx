"use client";

/**
 * Client-only Pixel event emitters (Meta + TikTok), rendered from server components.
 * Each event fires to both vendors with one shared event_id so each can dedup its
 * own browser/server pair.
 *
 * - PixelPageView: fires PageView on client-side route changes (the *initial*
 *   PageView is fired by the loader snippets in app/layout.tsx, so we skip the
 *   first render here to avoid double-counting).
 * - ViewContent: fires once when a product is shown.
 * - PurchasePixel: fires the browser purchase (Meta Purchase + TikTok
 *   CompletePayment) on the thank-you page. It shares its eventId (the Stripe
 *   session id) with the authoritative server-side purchase from the webhook, so
 *   both vendors dedup the two.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { genEventId, track } from "@/lib/meta-pixel";
import { track as ttTrack, page as ttPage, buildContents } from "@/lib/tiktok-pixel";

export function PixelPageView() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false; // initial PageView already fired by the loader snippets
      return;
    }
    track("PageView", {}, genEventId());
    ttPage();
  }, [pathname]);
  return null;
}

export function ViewContent({
  productId,
  valueCents,
}: {
  productId: string;
  valueCents: number;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const eventId = genEventId();
    track(
      "ViewContent",
      {
        content_ids: [productId],
        content_type: "product",
        value: valueCents / 100,
        currency: "USD",
      },
      eventId,
    );
    ttTrack(
      "ViewContent",
      { ...buildContents([productId]), value: valueCents / 100 },
      eventId,
    );
  }, [productId, valueCents]);
  return null;
}

export function PurchasePixel({
  eventId,
  valueCents,
  contentIds,
}: {
  eventId: string;
  valueCents: number;
  contentIds: string[];
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(
      "Purchase",
      {
        content_ids: contentIds,
        content_type: "product",
        value: valueCents / 100,
        currency: "USD",
      },
      eventId,
    );
    ttTrack(
      "CompletePayment",
      { ...buildContents(contentIds), value: valueCents / 100 },
      eventId,
    );
  }, [eventId, valueCents, contentIds]);
  return null;
}
