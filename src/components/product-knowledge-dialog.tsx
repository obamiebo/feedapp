"use client";

import { useId, useRef } from "react";
import { BookOpen, FileUp, Plus, X } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import type { ProductKnowledgeDocumentType } from "@/repositories/product-knowledge";

type ProductKnowledgeDialogProps = {
  action: (formData: FormData) => void | Promise<void>;
  productSourceKey?: string;
  disabled?: boolean;
  documentServiceId?: string;
  defaultTitle?: string;
  defaultDocumentType?: ProductKnowledgeDocumentType;
  mode?: "create" | "replace";
  compact?: boolean;
};

const inputClass = "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark";

export function ProductKnowledgeDialog({
  action,
  productSourceKey,
  disabled,
  documentServiceId,
  defaultTitle,
  defaultDocumentType = "faq",
  mode = "create",
  compact = false
}: ProductKnowledgeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const isReplace = mode === "replace";
  const dialogTitle = isReplace ? "Reindex product knowledge" : "Add product knowledge";
  const buttonLabel = isReplace ? "Reindex" : "Add knowledge";
  const titleId = `${formId}-knowledge-title`;
  const typeId = `${formId}-knowledge-type`;
  const descriptionId = `${formId}-knowledge-description`;
  const fileId = `${formId}-knowledge-file`;
  const textId = `${formId}-knowledge-text`;

  return (
    <>
      <button
        className={
          compact
            ? "inline-flex size-8 items-center justify-center rounded-md border border-line bg-panel text-ink transition-colors hover:bg-panel-muted disabled:cursor-not-allowed disabled:opacity-50"
            : secondaryButtonClass
        }
        type="button"
        disabled={disabled || !productSourceKey}
        onClick={() => dialogRef.current?.showModal()}
        title={buttonLabel}
        aria-label={buttonLabel}
      >
        {isReplace ? <FileUp size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
        {compact ? null : buttonLabel}
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(calc(100vw-2rem),560px)] rounded-lg border border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">{dialogTitle}</h2>
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
          <input name="documentId" type="hidden" value={documentServiceId ?? ""} />
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor={titleId}>
            Title
            <input id={titleId} name="title" minLength={2} required defaultValue={defaultTitle} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor={typeId}>
            Type
            <select id={typeId} name="documentType" defaultValue={defaultDocumentType} className={inputClass}>
              <option value="faq">FAQ</option>
              <option value="manual">Manual</option>
              <option value="troubleshooting">Troubleshooting</option>
              <option value="release_note">Release note</option>
              <option value="policy">Policy</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor={descriptionId}>
            Description
            <input id={descriptionId} name="description" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor={fileId}>
            File
            <input
              id={fileId}
              name="file"
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-panel-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted" htmlFor={textId}>
            Text
            <textarea id={textId} name="text" rows={8} minLength={20} className={inputClass} />
          </label>
          <p className="text-xs text-muted">
            {isReplace
              ? "Upload replacement content. The existing document ID is reused and old indexed chunks are replaced."
              : "Upload a supported file or paste text. If both are provided, the file is used."}
          </p>
          <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
            <button
              className={secondaryButtonClass}
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <ConfirmSubmitButton
              className={primaryButtonClass}
              confirmMessage={isReplace ? "Reindex this product knowledge with the replacement content?" : "Upload this product knowledge?"}
              pendingChildren={isReplace ? "Reindexing..." : "Uploading..."}
            >
              {isReplace ? "Reindex" : "Upload"}
            </ConfirmSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
