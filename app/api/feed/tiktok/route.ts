/**
 * TikTok product feed (RSS 2.0 with the g: namespace) for TikTok Catalog Manager /
 * Dynamic Showcase Ads. TikTok ingests the same Google Shopping format as Meta, so
 * this mirrors app/api/feed/meta/route.ts — point a scheduled catalog feed at this URL.
 *
 * One <item> per product (single price across colors/sizes). `g:id` is the catalog
 * slug, which MUST equal the `content_id` the Pixel + Events API send so catalog
 * attribution lines up.
 */

import { listProducts } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(): Promise<Response> {
  const site = (process.env.SITE_URL || "https://gothamgoods.vercel.app").replace(
    /\/$/,
    "",
  );

  const items = listProducts()
    .map((p) => {
      const image = p.colors[0]?.image ?? "";
      const price = (p.priceCents / 100).toFixed(2);
      const description = p.blurb ?? p.name;
      return `    <item>
      <g:id>${esc(p.id)}</g:id>
      <g:title>${esc(p.name)}</g:title>
      <g:description>${esc(description)}</g:description>
      <g:link>${esc(site)}/</g:link>
      <g:image_link>${esc(image)}</g:image_link>
      <g:availability>in stock</g:availability>
      <g:condition>new</g:condition>
      <g:price>${price} USD</g:price>
      <g:brand>Gotham Goods</g:brand>
      <g:google_product_category>1604</g:google_product_category>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Gotham Goods</title>
    <link>${esc(site)}</link>
    <description>Gotham Goods — Knicks finals fan tees</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
