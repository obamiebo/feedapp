import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line bg-panel-subtle px-6 py-10 text-center text-sm text-muted">
      <Icon size={20} aria-hidden="true" className="text-muted" />
      <p>{message}</p>
    </div>
  );
}
