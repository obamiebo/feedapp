"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Pencil, Save, X } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { CaseTagRecord } from "@/repositories/case-tags";

type ProductTagRowActionsProps = {
  action: (formData: FormData) => void | Promise<void>;
  sourceKey: string;
  tag: CaseTagRecord;
};

const inputClass = "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const iconButtonClass =
  "inline-flex size-9 items-center justify-center rounded-md border border-line text-muted transition-colors hover:bg-panel-muted hover:text-ink";

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex size-9 items-center justify-center rounded-md bg-brand text-white transition-colors hover:bg-brand-dark disabled:cursor-wait disabled:opacity-70"
      type="submit"
      disabled={pending}
      title="Save tag"
      aria-label="Save tag"
    >
      <Save size={15} aria-hidden="true" />
    </button>
  );
}

export function ProductTagRowActions({ action, sourceKey, tag }: ProductTagRowActionsProps) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const initialDescription = tag.description?.trim() ?? "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const nextName = String(formData.get("name") ?? "").trim();
    const nextColor = String(formData.get("color") ?? "").trim();
    const nextDescription = String(formData.get("description") ?? "").trim();
    const nextActive = formData.get("active") === "on";

    if (
      nextName === tag.name.trim() &&
      nextColor.toLowerCase() === tag.color.toLowerCase() &&
      nextDescription === initialDescription &&
      nextActive === tag.active
    ) {
      event.preventDefault();
      setEditing(false);
      setMessage("No changes applied.");
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          className={iconButtonClass}
          type="button"
          title="Edit tag"
          aria-label={`Edit ${tag.name}`}
          onClick={() => {
            setMessage("");
            setEditing(true);
          }}
        >
          <Pencil size={15} aria-hidden="true" />
        </button>
        {message ? (
          <span className="text-xs text-muted" role="status" aria-live="polite">
            {message}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="grid min-w-[520px] gap-2 lg:grid-cols-[160px_90px_1fr_auto_auto_auto] lg:items-center">
      <input name="sourceKey" type="hidden" value={sourceKey} />
      <input name="tagId" type="hidden" value={tag.id} />
      <input name="name" className={inputClass} defaultValue={tag.name} aria-label="Tag name" />
      <input name="color" type="color" className={`${inputClass} h-10 p-1`} defaultValue={tag.color} aria-label="Tag color" />
      <input name="description" className={inputClass} defaultValue={tag.description ?? ""} aria-label="Tag description" />
      <label className="flex items-center gap-2 text-sm text-muted">
        <input name="active" type="checkbox" defaultChecked={tag.active} /> Active
      </label>
      <SaveButton />
      <button
        className={iconButtonClass}
        type="button"
        title="Cancel edit"
        aria-label="Cancel edit"
        onClick={() => {
          setEditing(false);
          setMessage("");
        }}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </form>
  );
}
