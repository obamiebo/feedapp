"use client";

import { useRef } from "react";
import { Plus, Tags, X } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import type { ProductRosterSource } from "@/services/admin";

type ProductTagDialogProps = {
  action: (formData: FormData) => void | Promise<void>;
  productSources: ProductRosterSource[];
  selectedSourceKey?: string;
  disabled?: boolean;
};

const inputClass = "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark";

export function ProductTagDialog({ action, productSources, selectedSourceKey, disabled }: ProductTagDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const manageableSources = productSources.filter((source) => source.canManageTags);
  const defaultSourceKey =
    manageableSources.find((source) => source.key === selectedSourceKey || source.id === selectedSourceKey)?.key ??
    manageableSources[0]?.key ??
    "";

  return (
    <>
      <button
        className={secondaryButtonClass}
        type="button"
        disabled={disabled || manageableSources.length === 0}
        onClick={() => dialogRef.current?.showModal()}
      >
        <Plus size={15} aria-hidden="true" />
        Add tag
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(calc(100vw-2rem),560px)] rounded-lg border border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Tags size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Add product tag</h2>
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
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="case-tag-product">
            Product
            <select id="case-tag-product" name="sourceKey" defaultValue={defaultSourceKey} required className={inputClass}>
              {manageableSources.map((source) => (
                <option key={source.id} value={source.key}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="case-tag-name">
            Name
            <input id="case-tag-name" name="name" minLength={2} required className={inputClass} placeholder="Billing issue" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="case-tag-color">
            Color
            <input id="case-tag-color" name="color" type="color" className={`${inputClass} h-10 p-1`} defaultValue="#244f89" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="case-tag-description">
            Description
            <textarea id="case-tag-description" name="description" rows={3} className={inputClass} placeholder="Optional" />
          </label>
          <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
            <button className={secondaryButtonClass} type="button" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <ConfirmSubmitButton className={primaryButtonClass} confirmMessage="Create this product tag?" pendingChildren="Creating...">
              Save tag
            </ConfirmSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
