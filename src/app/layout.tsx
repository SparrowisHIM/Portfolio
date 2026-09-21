import type { Metadata, Viewport } from "next";
import "@fontsource-variable/big-shoulders";
import "@fontsource-variable/archivo";
import "@fontsource-variable/roboto-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Build site",
  description:
    "Efe Ebomwonyi's portfolio, under construction. A design engineer who builds animated interfaces, presented as a procedural night-shift construction site.",
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
