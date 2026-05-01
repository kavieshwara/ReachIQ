import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { ProtectedShell } from "@/components/layout/ProtectedShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <AdminSidebar />
      <div className="min-h-screen flex-1">
        <ProtectedShell title="Admin" subtitle="ReachIQ operations console" adminOnly>
          {children}
        </ProtectedShell>
      </div>
    </div>
  );
}
