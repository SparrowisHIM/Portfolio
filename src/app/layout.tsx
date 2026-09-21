import type { Metadata, Viewport } from "next";
import "@fontsource-variable/big-shoulders";
import "@fontsource-variable/archivo";
import "@fontsource-variable/roboto-mono";
import "./globals.css";
import { owner } from "@/lib/projects";

const DESCRIPTION =
  "Efe Ebomwonyi's portfolio, under construction. A design engineer who builds animated interfaces, presented as a procedural night-shift construction site.";

/**
 * Where this is served from, so the OpenGraph image resolves to an
 * absolute URL.
 *
 * Nothing is hard-coded: Vercel injects the production domain at build
 * time, and NEXT_PUBLIC_SITE_URL overrides it once there is a custom one.
 * Without a base, `next build` warns and resolves social images against
 * localhost, which means a link to this site posts with no preview card -
 * and being seen is the entire point of it.
 */
const site =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/*
  The tab, the search result and the shared card all carry his name, not
  the conceit. "Build site" is the headline on the page and the shape of
  the thing; it is not what a portfolio is called when someone sends the
  link on. Taken from `owner` so there is one spelling of it in the
  codebase, the same one the wordmark reads.
*/
const TITLE = `${owner.name} — ${owner.role}`;

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: {
    default: TITLE,
    template: `%s — ${owner.name}`,
  },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: owner.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1b2e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
