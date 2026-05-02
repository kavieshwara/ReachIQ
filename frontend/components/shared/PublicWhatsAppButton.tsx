"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircleMore } from "lucide-react";
import { supportFallbackNumber } from "@/components/pricing/pricing-data";
import { buildApiUrl } from "@/lib/api-base-url";

export function PublicWhatsAppButton() {
  const [phoneNumber, setPhoneNumber] = useState(supportFallbackNumber);
  const pathname = usePathname();

  const shouldRender = pathname === "/" || pathname === "/pricing";

  useEffect(() => {
    fetch(buildApiUrl("/api/platform/settings"))
      .then((response) => response.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const settings = Object.fromEntries(data.map((item: any) => [item.key, item.value]));
        if (settings.support_whatsapp_number) {
          setPhoneNumber(String(settings.support_whatsapp_number).replace(/[^0-9]/g, ""));
        }
      })
      .catch(() => null);
  }, []);

  const href = useMemo(
    () => `https://wa.me/${phoneNumber}?text=${encodeURIComponent("Hi, I have a question about ReachIQ")}`,
    [phoneNumber]
  );

  if (!shouldRender) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex items-center gap-3 rounded-full border border-accent/25 bg-accent px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_22px_70px_rgba(0,217,166,0.35)] transition hover:-translate-y-0.5 hover:scale-[1.01] sm:right-5 sm:px-5"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/10">
        <MessageCircleMore className="h-5 w-5" />
      </span>
      <span>Chat with us</span>
    </a>
  );
}
