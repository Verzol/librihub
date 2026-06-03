import { AdminShell } from "@/components/admin-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell>
      <div className="animate-fade-in-up">{children}</div>
    </AdminShell>
  );
}
