import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] p-6 text-center">
      <Logo variant="full" size="md" theme="dark" className="mb-12" href="/" />
      <div className="mb-4 text-[120px] font-bold leading-none text-[#2A2A3D]">404</div>
      <h1 className="mb-3 text-2xl font-semibold text-white">Page not found</h1>
      <p className="mb-8 text-[#9898B8]">This page doesn&apos;t exist or was moved.</p>
      <Link href="/dashboard">
        <Button>Back to Dashboard</Button>
      </Link>
    </main>
  );
}
