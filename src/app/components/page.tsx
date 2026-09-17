import type { Metadata } from "next";
import { SiteSign } from "@/components/overlay/SiteSign";
import { ComponentYard } from "@/components/yard/ComponentYard";

export const metadata: Metadata = {
  title: "Component yard, Build site",
  description:
    "The parts Efe Ebomwonyi builds interfaces from: magnetic buttons, scrambled headlines, spring card stacks, rolling counters and a toast delivered by crane.",
};

export default function ComponentsPage() {
  return (
    <main className="relative min-h-screen">
      <SiteSign />
      <ComponentYard />
    </main>
  );
}
