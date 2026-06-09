"use client";

/**
 * Client-only Meta Pixel event emitters, rendered from server components.
 *
 * - PixelPageView: fires PageView on client-side route changes (the *initial*
 *   PageView is fired by the loader snippet in app/layout.tsx, so we skip the
 *   first render here to avoid double-counting).
 * - ViewContent: fires once when a product is shown.
 * - PurchasePixel: fires the browser Purchase on the thank-you page. It shares
 *   its eventId (the Stripe session id) with the authoritative server CAPI
 *   Purchase from the webhook, so Meta dedups the two.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { genEventId, track } from "@/lib/meta-pixel";

export function PixelPageView() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false; // initial PageView already fired by the loader snippet
      return;
    }
    track("PageView", {}, genEventId());
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
    track(
      "ViewContent",
      {
        content_ids: [productId],
        content_type: "product",
        value: valueCents / 100,
        currency: "USD",
      },
      genEventId(),
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
  }, [eventId, valueCents, contentIds]);
  return null;
}
