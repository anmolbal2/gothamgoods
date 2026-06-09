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
      <div className="border-2 border-ink bg-paper p-8">
        {!session_id ? (
          <>
            <h1 className="font-display text-3xl uppercase tracking-tight">
              No order reference
            </h1>
            <p className="mt-2 text-ink/60">We couldn&apos;t find an order to show.</p>
          </>
        ) : loadError ? (
          <>
            <h1 className="font-display text-3xl uppercase tracking-tight">
              Thanks for your order!
            </h1>
            <p className="mt-2 text-ink/60">
              Your payment went through. A receipt is on its way to your inbox.
            </p>
          </>
        ) : (
          <>
            <span className="inline-block bg-orange px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
              Order confirmed
            </span>
            <h1 className="mt-4 font-display text-4xl uppercase tracking-tight">
              You&apos;re in. 🏀
            </h1>
            <p className="mt-2 text-ink/70">
              Printed and shipped from New Jersey — it lands in 2–3 days.
              {email ? ` A receipt is on its way to ${email}.` : ""}
            </p>

            {items.length > 0 && (
              <div className="mt-6 divide-y divide-line border-y-2 border-ink">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between py-3">
                    <span data-testid="order-item" className="font-bold">
                      {it.name}
                    </span>
                    <span className="font-mono text-sm text-ink/50">×{it.quantity}</span>
                  </div>
                ))}
              </div>
            )}

            {totalCents !== null && (
              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-ink/60">
                  Total
                </span>
                <span className="font-display text-3xl">{priceLabel(totalCents)}</span>
              </div>
            )}
          </>
        )}

        <Link
          href="/"
          className="mt-8 inline-block bg-ink px-5 py-3 font-mono text-sm font-bold uppercase tracking-widest text-cream transition hover:bg-blue"
        >
          ← Back to the store
        </Link>
      </div>
    </section>
  );
}
