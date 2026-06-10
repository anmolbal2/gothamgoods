import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions — Gotham Goods",
  description:
    "The terms that govern your use of Gotham Goods and any purchase you make from our store.",
};

const UPDATED = "June 9, 2026";
const CONTACT = "anmolbal52@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl uppercase tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-ink/80">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-orange">
        Gotham Goods
      </p>
      <h1 className="mt-3 font-display text-4xl uppercase tracking-tight sm:text-5xl">
        Terms &amp; Conditions
      </h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-widest text-ink/50">
        Last updated: {UPDATED}
      </p>

      <p className="mt-8 text-ink/80">
        These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access to and use of{" "}
        <span className="whitespace-nowrap">gotham-goods.com</span> (the &ldquo;Site&rdquo;)
        and any purchase you make from Gotham Goods (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;). By using the Site or placing an order, you agree to these Terms.
        If you do not agree, please do not use the Site.
      </p>

      <Section title="All sales are final">
        <p>
          <strong>All sales are final.</strong> Any returns, exchanges, or refunds are
          provided solely at the discretion of Gotham Goods and are not guaranteed. We are
          under no obligation to accept a return or issue a refund or exchange for any
          reason, including buyer&rsquo;s remorse, incorrect size or color selection, or a
          change of mind.
        </p>
        <p>
          If your item arrives damaged, defective, or materially different from what you
          ordered, email us at{" "}
          <a href={`mailto:${CONTACT}`} className="text-blue underline">
            {CONTACT}
          </a>{" "}
          within 14 days of delivery with your order details and photos, and we will review
          your request. Any resolution we may offer is granted at our sole discretion and
          does not waive this all-sales-final policy.
        </p>
      </Section>

      <Section title="Eligibility">
        <p>
          You must be at least 18 years old, or the age of majority in your jurisdiction,
          and able to form a binding contract to purchase from the Site. By ordering, you
          represent that the information you provide is accurate and complete.
        </p>
      </Section>

      <Section title="Products, pricing & availability">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Products are made to order. Because each item is printed individually, slight
            variations in color, placement, and finish are normal and are not defects.
          </li>
          <li>
            Product images are mockups for illustration; the actual item may vary slightly.
          </li>
          <li>
            Prices are shown in U.S. dollars and may change at any time. Shipping is free
            within the United States unless stated otherwise.
          </li>
          <li>
            We may correct errors, limit quantities, or discontinue any product at any time.
            If a product is listed at an incorrect price, we may cancel any order placed at
            that price even after it is confirmed.
          </li>
        </ul>
      </Section>

      <Section title="Orders & acceptance">
        <p>
          Your order is an offer to buy. We may accept or decline any order, in whole or in
          part, and may cancel an order at any time — for example, due to suspected fraud,
          payment issues, stock or production problems, or pricing errors. If we cancel an
          order you already paid for, we will refund the amount charged for the cancelled
          items.
        </p>
      </Section>

      <Section title="Payment">
        <p>
          Payments are processed by Stripe. By submitting payment information, you authorize
          us and Stripe to charge your selected payment method for the total order amount,
          including any applicable taxes. We do not store your full card details.
        </p>
      </Section>

      <Section title="Shipping & delivery">
        <p>
          Items are produced and shipped on our behalf by our print provider, typically
          from New Jersey. Stated production and delivery times (such as 2&ndash;3 days) are
          estimates, not guarantees, and may be affected by carrier delays or other factors
          outside our control. Risk of loss passes to you on delivery to the carrier. You
          are responsible for providing an accurate shipping address; orders returned due to
          an incorrect or undeliverable address may be subject to the all-sales-final policy
          above.
        </p>
      </Section>

      <Section title="Fan-made content & intellectual property">
        <p>
          Gotham Goods sells independent, fan-made apparel. We are not affiliated with,
          endorsed by, or sponsored by the NBA, any team, any player, or any brand, and all
          third-party names and marks belong to their respective owners. Our designs are
          intended as commentary and fan expression.
        </p>
        <p>
          The Site and its content — including our logos, text, and original designs — are
          owned by Gotham Goods or our licensors and are protected by law. You may not copy,
          reproduce, or resell our content or products without our written permission.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          You agree not to misuse the Site, including by attempting to gain unauthorized
          access, interfering with its operation, scraping or harvesting data, or using it
          for any unlawful or fraudulent purpose.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          The Site and products are provided &ldquo;as is&rdquo; and &ldquo;as
          available,&rdquo; without warranties of any kind, whether express or implied,
          including implied warranties of merchantability, fitness for a particular purpose,
          and non-infringement, to the fullest extent permitted by law.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, Gotham Goods will not be liable for any
          indirect, incidental, special, consequential, or punitive damages, or for any loss
          of profits or revenues. Our total liability for any claim relating to an order or
          the Site will not exceed the amount you paid for the order giving rise to the
          claim.
        </p>
      </Section>

      <Section title="Indemnification">
        <p>
          You agree to indemnify and hold harmless Gotham Goods from any claims, damages, or
          expenses arising out of your misuse of the Site or your violation of these Terms.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These Terms are governed by the laws of the State of New Jersey, United States,
          without regard to its conflict-of-laws rules. You agree that any dispute will be
          resolved in the state or federal courts located in New Jersey, and you consent to
          their jurisdiction.
        </p>
      </Section>

      <Section title="Changes to these Terms">
        <p>
          We may update these Terms from time to time. When we do, we will revise the
          &ldquo;Last updated&rdquo; date above, and your continued use of the Site or
          placement of new orders means you accept the updated Terms.
        </p>
      </Section>

      <Section title="Contact us">
        <p>
          Questions about these Terms? Email{" "}
          <a href={`mailto:${CONTACT}`} className="text-blue underline">
            {CONTACT}
          </a>
          . See also our{" "}
          <Link href="/privacy" className="text-blue underline">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <p className="mt-12 border-t-2 border-ink pt-6">
        <Link
          href="/"
          className="font-mono text-xs font-bold uppercase tracking-widest text-blue underline"
        >
          ← Back to the store
        </Link>
      </p>
    </article>
  );
}
