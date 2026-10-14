import Image from "next/image";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/dal";
import { SignOutButton } from "@/components/admin/SignOutButton";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminPage();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/se-mark.png"
            alt="Styria Estate"
            width={544}
            height={726}
            className="h-10 w-auto"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-soft">
              Styria Estate
            </p>
            <h1 className="font-display text-xl italic text-ink">Admin Dashboard</h1>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <nav className="flex gap-4 text-xs font-semibold uppercase tracking-widest text-ink-soft">
            <Link href="/admin" className="hover:text-ink">
              Stays
            </Link>
            <Link href="/admin/schedule" className="hover:text-ink">
              Schedule
            </Link>
          </nav>
          <span className="hidden text-xs text-ink-soft sm:inline">
            {admin.displayName ?? admin.email}
          </span>
          <SignOutButton />
        </div>
      </header>
      {children}
    </main>
  );
}
