import { Inbox, LogOut, Settings, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions/auth";
import type { AppUser } from "@/domain/types";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export type NavKey = "cases" | "settings";

const NAV_ITEMS: Array<{ key: NavKey; href: Route; label: string; icon: LucideIcon }> = [
  { key: "cases", href: "/", label: "Cases", icon: Inbox },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings }
];

function NavLinks({ active, orientation }: { active: NavKey; orientation: "vertical" | "horizontal" }) {
  return (
    <>
      {NAV_ITEMS.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          className={cn(
            "inline-flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
            orientation === "vertical" ? "px-3 py-2.5" : "flex-col gap-1 px-3 py-2 text-xs",
            key === active ? "bg-brand text-white shadow-sm" : "text-muted hover:bg-panel-muted hover:text-ink"
          )}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </>
  );
}

export function AppShell({
  active,
  children,
  currentUser
}: {
  active: NavKey;
  children: ReactNode;
  currentUser?: AppUser | null;
}) {
  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-panel p-4 lg:flex">
        <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-panel-subtle p-3">
          <div className="flex items-center gap-2">
            <Image
              src="/feedapp-icon.png"
              alt=""
              width={30}
              height={30}
              priority
              aria-hidden="true"
              className="h-[30px] w-[30px]"
            />
            <span className="text-base font-semibold text-ink">FeedApp</span>
          </div>
          <div className="flex items-center gap-1.5 border-t border-line pt-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Powered by</span>
            <Image src="/itc-logo.png" alt="IT Consortium" width={78} height={21} className="h-auto w-[78px]" />
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Primary navigation">
          <NavLinks active={active} orientation="vertical" />
        </nav>

        {currentUser ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex items-center gap-3">
              <Avatar name={currentUser.name} size={36} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{currentUser.name}</div>
                <div className="truncate text-xs text-muted">{currentUser.roles.join(", ") || "No role assigned"}</div>
              </div>
            </div>
            <form action={logoutAction}>
              <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-panel-muted hover:text-critical"
                type="submit"
              >
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </aside>

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-4 py-2 lg:hidden">
        <div className="flex items-center gap-2">
          <Image src="/feedapp-icon.png" alt="" width={26} height={26} aria-hidden="true" className="h-[26px] w-[26px]" />
          <span className="text-sm font-semibold text-ink">FeedApp</span>
        </div>
        <nav className="flex gap-1" aria-label="Primary navigation">
          <NavLinks active={active} orientation="horizontal" />
        </nav>
      </div>

      <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
