import { ProtectedShell } from "@/components/layout/ProtectedShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedShell title="ReachIQ" subtitle="Your outbound command center">
      {children}
    </ProtectedShell>
  );
}
