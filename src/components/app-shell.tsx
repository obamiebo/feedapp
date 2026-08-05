import { ExternalLink, Inbox, LogOut, Settings, UserRound, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions/auth";
import type { AppUser } from "@/domain/types";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { getEntryContext, type EntryMode } from "@/lib/session-cookie";
import { visibleSettingsHrefs } from "@/lib/settings-access";

export type NavKey = "cases" | "settings";

const NAV_ITEMS: Array<{ key: NavKey; href: Route; label: string; icon: LucideIcon }> = [
  { key: "cases", href: "/", label: "Cases", icon: Inbox },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings }
];

function sourceHref(href: Route, sourceSystem?: string): Route {
  if (!sourceSystem) {
    return href;
  }

  const params = new URLSearchParams({ sourceSystem });
  return `${href}?${params.toString()}` as Route;
}

function readableSource(value?: string) {
  if (!value) {
    return "Product scope";
  }

  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function NavLinks({
  active,
  orientation,
  sourceSystem,
  currentUser
}: {
  active: NavKey;
  orientation: "vertical" | "horizontal";
  sourceSystem?: string;
  currentUser?: AppUser | null;
}) {
  const items =
    currentUser && visibleSettingsHrefs(currentUser, ["/settings"]).length === 0
      ? NAV_ITEMS.filter((item) => item.key !== "settings")
      : NAV_ITEMS;

  return (
    <>
      {items.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={sourceHref(href, sourceSystem)}
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

function UserMenu({
  currentUser,
  compact = false,
  showSignOut = true
}: {
  currentUser: AppUser;
  compact?: boolean;
  showSignOut?: boolean;
}) {
  return (
    <details className="group relative">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-md transition-colors marker:hidden hover:bg-panel-muted",
          compact ? "px-2 py-1.5" : "px-3 py-2"
        )}
      >
        <Avatar name={currentUser.name} size={compact ? 30 : 36} />
        {!compact ? (
          <div className="min-w-0 text-left">
            <div className="truncate text-sm font-medium text-ink">{currentUser.name}</div>
            <div className="truncate text-xs text-muted">{currentUser.roles.join(", ") || "No role assigned"}</div>
          </div>
        ) : (
          <span className="sr-only">User menu</span>
        )}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-line bg-panel p-3 shadow-lg">
        <div className="flex items-start gap-3 border-b border-line pb-3">
          <Avatar name={currentUser.name} size={36} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{currentUser.name}</div>
            <div className="truncate text-xs text-muted">{currentUser.email}</div>
            <div className="mt-1 text-xs text-muted">{currentUser.roles.join(", ") || "No role assigned"}</div>
          </div>
        </div>
        <div className="flex flex-col gap-1 pt-2">
          <Link
            className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted transition-colors hover:bg-panel-muted hover:text-ink"
            href="/settings"
          >
            <UserRound size={15} aria-hidden="true" />
            Profile and settings
          </Link>
          {showSignOut ? (
            <form action={logoutAction}>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted transition-colors hover:bg-panel-muted hover:text-critical"
                type="submit"
              >
                <LogOut size={15} aria-hidden="true" />
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function EmbeddedShell({
  children,
  currentUser,
  sourceSystem
}: {
  children: ReactNode;
  currentUser?: AppUser | null;
  sourceSystem?: string;
}) {
  const sourceLabel = readableSource(sourceSystem);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-line bg-panel/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Image
              src="/feedapp-icon.png"
              alt=""
              width={28}
              height={28}
              priority
              aria-hidden="true"
              className="h-7 w-7"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink">Feedback operations</div>
              <div className="truncate text-xs text-muted">{sourceLabel}</div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Link
              className="inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-panel-muted hover:text-ink"
              href={`/embed/exit${sourceSystem ? `?sourceSystem=${encodeURIComponent(sourceSystem)}` : ""}` as Route}
              target="_blank"
              rel="noreferrer"
              aria-label="Open full FeedApp"
              title="Open full FeedApp"
            >
              <ExternalLink size={17} aria-hidden="true" />
            </Link>
            {currentUser ? <UserMenu currentUser={currentUser} compact /> : null}
          </div>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-[1440px] p-4 sm:p-5 lg:p-6">{children}</main>
    </div>
  );
}

export async function AppShell({
  active,
  children,
  currentUser,
  entryMode,
  sourceSystem
}: {
  active: NavKey;
  children: ReactNode;
  currentUser?: AppUser | null;
  entryMode?: EntryMode;
  sourceSystem?: string;
}) {
  const entryContext = await getEntryContext();
  const effectiveMode = entryMode ?? entryContext.mode;
  const effectiveSourceSystem = sourceSystem ?? entryContext.sourceSystem;

  if (effectiveMode === "embed") {
    return (
      <EmbeddedShell currentUser={currentUser} sourceSystem={effectiveSourceSystem}>
        {children}
      </EmbeddedShell>
    );
  }

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
          <NavLinks active={active} orientation="vertical" currentUser={currentUser} />
        </nav>

        {currentUser ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <UserMenu currentUser={currentUser} showSignOut={false} />
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
          <NavLinks active={active} orientation="horizontal" currentUser={currentUser} />
        </nav>
      </div>

      <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
