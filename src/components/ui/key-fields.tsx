"use client";

import { useState } from "react";
import { normalizeKey } from "@/lib/keys";

type KeyFieldsProps = {
  inputClass: string;
  nameId: string;
  nameLabel?: string;
  nameMinLength?: number;
  nameName?: string;
  keyId: string;
  keyLabel?: string;
  keyName?: string;
};

export function KeyFields({
  inputClass,
  nameId,
  nameLabel = "Name",
  nameMinLength = 2,
  nameName = "name",
  keyId,
  keyLabel = "Key",
  keyName = "key"
}: KeyFieldsProps) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const generatedKey = normalizeKey(name);
  const visibleKey = keyEdited ? key : generatedKey;

  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-muted" htmlFor={nameId}>
        {nameLabel}
        <input
          id={nameId}
          name={nameName}
          minLength={nameMinLength}
          required
          value={name}
          className={inputClass}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted" htmlFor={keyId}>
        {keyLabel}
        <input
          id={keyId}
          name={keyName}
          value={visibleKey}
          placeholder="Generated from name"
          className={inputClass}
          onChange={(event) => {
            const nextKey = normalizeKey(event.target.value);
            setKey(nextKey);
            setKeyEdited(nextKey.length > 0);
          }}
        />
      </label>
    </>
  );
}
