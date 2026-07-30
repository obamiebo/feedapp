"use client";

import { useRef } from "react";
import { Building2, Plus, X } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { KeyFields } from "@/components/ui/key-fields";

type DepartmentDialogProps = {
  action: (formData: FormData) => void | Promise<void>;
};

const inputClass = "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";

export function DepartmentDialog({ action }: DepartmentDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        <Plus size={15} aria-hidden="true" />
        Create department
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(calc(100vw-2rem),460px)] rounded-lg border border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Create department</h2>
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
          <KeyFields inputClass={inputClass} nameId="department-name" keyId="department-key" />
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
              confirmMessage="Create this department?"
              pendingChildren="Creating..."
            >
              Create department
            </ConfirmSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
