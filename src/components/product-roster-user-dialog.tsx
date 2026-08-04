"use client";

import { useRef } from "react";
import { UserPlus, X } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import type { ProductRosterSource, AdminUser } from "@/services/admin";

type ProductRosterUserDialogProps = {
  action: (formData: FormData) => void | Promise<void>;
  selectedSource: ProductRosterSource | null;
  users?: AdminUser[];
};

const inputClass = "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";

export function ProductRosterUserDialog({ action, selectedSource, users = [] }: ProductRosterUserDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const userOptions = users.filter((user) => user.provisioned);

  return (
    <>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-muted"
        type="button"
        disabled={!selectedSource}
        onClick={() => dialogRef.current?.showModal()}
      >
        <UserPlus size={15} aria-hidden="true" />
        Add rep
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(calc(100vw-2rem),520px)] rounded-lg border border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Add product rep</h2>
          </div>
          <button
            className="inline-flex size-8 items-center justify-center rounded-md border border-line text-muted transition-colors hover:bg-panel-muted hover:text-ink"
            type="button"
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <form action={action} className="flex flex-col gap-3 p-5">
          <input name="sourceId" type="hidden" value={selectedSource?.id ?? ""} />
          <div className="rounded-md border border-line bg-panel-subtle px-3 py-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Product</div>
            <div className="mt-1 text-sm font-semibold text-ink">{selectedSource?.name ?? "No product selected"}</div>
          </div>
          {userOptions.length > 0 ? (
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="product-rep-email">
              Rep
              <select id="product-rep-email" name="email" required className={inputClass}>
                <option value="">Select a provisioned rep</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.email}>
                    {user.name} - {user.email}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="product-rep-email">
              Rep email
              <input id="product-rep-email" name="email" type="email" required className={inputClass} />
            </label>
          )}
          <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
            <button
              className="inline-flex items-center justify-center rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <ConfirmSubmitButton
              className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              confirmMessage={`Add this rep to ${selectedSource?.name ?? "the product"}?`}
              pendingChildren="Adding..."
            >
              Add rep
            </ConfirmSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
