import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Gotham Goods",
  description:
    "How Gotham Goods collects, uses, and shares information when you visit our store or place an order.",
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

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-orange">
        Gotham Goods
      </p>
      <h1 className="mt-3 font-display text-4xl uppercase tracking-tight sm:text-5xl">
        Privacy Policy
      </h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-widest text-ink/50">
        Last updated: {UPDATED}
      </p>

      <p className="mt-8 text-ink/80">
        This Privacy Policy explains how Gotham Goods (&ldquo;we,&rdquo; &ldquo;us,&rdquo;
        or &ldquo;our&rdquo;) collects, uses, and shares information about you when you
        visit{" "}
        <span className="whitespace-nowrap">gotham-goods.com</span> (the &ldquo;Site&rdquo;),
        place an order, or interact with our ads. We sell fan-made apparel; we are not
        affiliated with the NBA, any team, or any brand.
      </p>

      <Section title="Information we collect">
        <p>We collect the following, depending on how you use the Site:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Order &amp; contact details</strong> — your name, email address, and
            shipping address, which you provide at checkout so we can fulfill and ship
            your order and email you about it.
          </li>
          <li>
            <strong>Payment information</strong> — card and billing details are entered
            directly with our payment processor (Stripe). We do not receive or store your
            full card number; we receive a confirmation and limited details (such as the
            last four digits and your email) needed to process the order.
          </li>
          <li>
            <strong>Usage &amp; device data</strong> — when you visit the Site we and our
            providers automatically collect information such as your IP address, browser
            and device type, pages viewed, referring page, and actions taken (for example,
            viewing a product or starting checkout), via cookies and similar technologies.
          </li>
        </ul>
      </Section>

      <Section title="How we use information">
        <ul className="list-disc space-y-2 pl-5">
          <li>To process, fulfill, and ship your orders, and to provide customer support.</li>
          <li>To send transactional emails such as order and shipping confirmations.</li>
          <li>
            To measure, operate, and improve the Site and our marketing — including
            measuring ad performance and showing you relevant ads on platforms like Meta
            (Facebook and Instagram).
          </li>
          <li>To detect, prevent, and address fraud, abuse, or security issues, and to comply with law.</li>
        </ul>
      </Section>

      <Section title="Cookies, the Meta Pixel & advertising">
        <p>
          We use cookies and similar tracking technologies, including the{" "}
          <strong>Meta Pixel</strong> and Meta&rsquo;s Conversions API, to understand how
          visitors use the Site and to measure and optimize our advertising. These tools
          may collect information such as your device and browser data, pages and products
          viewed, and purchase events, and may share certain information (including a
          hashed version of your email for purchases) with Meta to attribute and improve
          ad campaigns.
        </p>
        <p>You can control this tracking:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Adjust cookie controls in your browser settings.</li>
          <li>
            Manage ad preferences in your{" "}
            <a
              href="https://www.facebook.com/settings?tab=ads"
              className="text-blue underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Meta ad settings
            </a>
            .
          </li>
          <li>
            Opt out of interest-based advertising via the{" "}
            <a
              href="https://optout.aboutads.info/"
              className="text-blue underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Digital Advertising Alliance
            </a>
            .
          </li>
        </ul>
      </Section>

      <Section title="Service providers we share data with">
        <p>
          We share information with vendors who process it on our behalf to run the store.
          Each handles your data under its own privacy policy:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Stripe</strong> — payment processing.
          </li>
          <li>
            <strong>Printify</strong> — print-on-demand production and shipping of your order.
          </li>
          <li>
            <strong>Resend</strong> — sending order and shipping emails.
          </li>
          <li>
            <strong>Supabase</strong> — database and backend storage.
          </li>
          <li>
            <strong>Vercel</strong> — website hosting and delivery.
          </li>
          <li>
            <strong>Meta Platforms</strong> — advertising measurement and optimization.
          </li>
        </ul>
        <p>
          We do not sell your personal information for money. We may disclose information
          if required by law or to protect our rights, and we may transfer it as part of a
          business sale or reorganization.
        </p>
      </Section>

      <Section title="Data retention">
        <p>
          We keep order and contact information for as long as needed to fulfill your
          order, provide support, and meet legal, tax, and accounting obligations, after
          which we delete or anonymize it.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Depending on where you live (for example, under the GDPR in the EU/UK or the
          CCPA/CPRA in California), you may have the right to access, correct, delete, or
          receive a copy of your personal information, to opt out of certain advertising or
          &ldquo;sharing&rdquo; of your data, and to not be discriminated against for
          exercising these rights. To make a request, email us at{" "}
          <a href={`mailto:${CONTACT}`} className="text-blue underline">
            {CONTACT}
          </a>{" "}
          and we will respond as required by applicable law.
        </p>
      </Section>

      <Section title="Security">
        <p>
          We use reasonable technical and organizational measures to protect your
          information, and rely on established providers (such as Stripe for payments). No
          method of transmission or storage is completely secure, so we cannot guarantee
          absolute security.
        </p>
      </Section>

      <Section title="Children's privacy">
        <p>
          The Site is intended for adults and is not directed to children under 13, and we
          do not knowingly collect personal information from them.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will revise
          the &ldquo;Last updated&rdquo; date above. Material changes will be reflected on
          this page.
        </p>
      </Section>

      <Section title="Contact us">
        <p>
          Questions or requests about this policy or your data? Email{" "}
          <a href={`mailto:${CONTACT}`} className="text-blue underline">
            {CONTACT}
          </a>
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
