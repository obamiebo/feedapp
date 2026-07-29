import { cn } from "@/lib/cn";

const PALETTE = [
  "bg-brand text-white",
  "bg-accent text-white",
  "bg-info text-white",
  "bg-ok text-white",
  "bg-warning text-white"
];

function hashName(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const colorClass = PALETTE[hashName(name) % PALETTE.length];

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", colorClass, className)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
