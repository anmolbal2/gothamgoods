import Link from "next/link";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

function priceLabel(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function ThankYouPage({
  searchParams,
}: {
  // In Next 16 searchParams is a Promise — it must be awaited.
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  let items: { name: string; quantity: number }[] = [];
  let totalCents: number | null = null;
  let email: string | undefined;
  let loadError = false;

  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["line_items"],
      });
      totalCents = session.amount_total ?? null;
      email = session.customer_details?.email ?? undefined;
      items = (session.line_items?.data ?? []).map((li) => ({
        name: li.description ?? "Item",
        quantity: li.quantity ?? 1,
      }));
    } catch (e) {
      console.error("thank-you: failed to retrieve session", e);
      loadError = true;
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-5 py-16">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        {!session_id ? (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight">
              No order reference
            </h1>
            <p className="mt-2 text-muted">
              We couldn&apos;t find an order to show.
            </p>
          </>
        ) : loadError ? (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Thanks for your order!
            </h1>
            <p className="mt-2 text-muted">
              Your payment went through. A receipt is on its way to your inbox.
            </p>
          </>
        ) : (
          <>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Order confirmed
            </p>
            <h1 className="mt-4 text-3xl font-black tracking-tight">Thanks! 🎉</h1>
            <p className="mt-2 text-muted">
              Your order is in. It ships from NJ in 2–3 days.
              {email ? ` A receipt is on its way to ${email}.` : ""}
            </p>

            {items.length > 0 && (
              <div className="mt-6 divide-y divide-border border-y border-border">
                {items.map((it, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3"
                  >
                    <span data-testid="order-item" className="font-medium">
                      {it.name}
                    </span>
                    <span className="text-muted">×{it.quantity}</span>
                  </div>
                ))}
              </div>
            )}

            {totalCents !== null && (
              <div className="mt-4 flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>{priceLabel(totalCents)}</span>
              </div>
            )}
          </>
        )}

        <Link
          href="/"
          className="mt-8 inline-block rounded-lg bg-brand-ink px-5 py-3 font-semibold text-white transition hover:opacity-90"
        >
          ← Back to the store
        </Link>
      </div>
    </section>
  );
}
