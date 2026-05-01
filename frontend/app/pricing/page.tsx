import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { PricingSection } from "@/components/pricing/PricingSection";

export default function PricingPage() {
  return (
    <div className="reachiq-grid min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-7xl px-5 pb-20 pt-28 lg:px-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="secondary">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to home
            </Button>
          </Link>
        </div>
        <PricingSection />
      </main>
    </div>
  );
}
