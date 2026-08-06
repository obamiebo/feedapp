"use client";

import { useRef } from "react";
import { BookOpen, Plus, X } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

type ProductKnowledgeDialogProps = {
  action: (formData: FormData) => void | Promise<void>;
  productSourceKey?: string;
  disabled?: boolean;
};

const inputClass = "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark";

export function ProductKnowledgeDialog({ action, productSourceKey, disabled }: ProductKnowledgeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        className={secondaryButtonClass}
        type="button"
        disabled={disabled || !productSourceKey}
        onClick={() => dialogRef.current?.showModal()}
      >
        <Plus size={15} aria-hidden="true" />
        Add knowledge
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(calc(100vw-2rem),560px)] rounded-lg border border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Add product knowledge</h2>
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
          <input name="productSourceKey" type="hidden" value={productSourceKey ?? ""} />
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="knowledge-title">
            Title
            <input id="knowledge-title" name="title" minLength={2} required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="knowledge-type">
            Type
            <select id="knowledge-type" name="documentType" defaultValue="faq" className={inputClass}>
              <option value="faq">FAQ</option>
              <option value="manual">Manual</option>
              <option value="troubleshooting">Troubleshooting</option>
              <option value="release_note">Release note</option>
              <option value="policy">Policy</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="knowledge-description">
            Description
            <input id="knowledge-description" name="description" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="knowledge-file">
            File
            <input
              id="knowledge-file"
              name="file"
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-panel-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="knowledge-text">
            Text
            <textarea id="knowledge-text" name="text" rows={8} minLength={20} className={inputClass} />
          </label>
          <p className="text-xs text-muted">Upload a supported file or paste text. If both are provided, the file is used.</p>
          <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
            <button
              className={secondaryButtonClass}
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <ConfirmSubmitButton className={primaryButtonClass} confirmMessage="Upload this product knowledge?" pendingChildren="Uploading...">
              Upload
            </ConfirmSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
