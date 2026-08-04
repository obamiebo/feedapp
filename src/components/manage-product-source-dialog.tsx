"use client";

import { useRef, useState } from "react";
import { Power, RefreshCw, Settings2, X } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { PasswordInput } from "@/components/ui/password-input";
import { Tabs } from "@/components/ui/tabs";
import type { AdminProductGroup, AdminProductSource } from "@/services/admin";

type ManageProductSourceDialogProps = {
  selectedSource: AdminProductSource | null;
  productSources: AdminProductSource[];
  productGroups: AdminProductGroup[];
  updateSourceAction: (formData: FormData) => void | Promise<void>;
  rotateSecretAction: (formData: FormData) => void | Promise<void>;
  updateCallbackAction: (formData: FormData) => void | Promise<void>;
  updateExternalEntryAction: (formData: FormData) => void | Promise<void>;
  entryErrorMessage?: string | null;
  newEntryKey?: string;
  newEntrySecret?: string;
};

const inputClass = "rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel-muted";
const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark";

export function ManageProductSourceDialog({
  selectedSource,
  productSources,
  productGroups,
  updateSourceAction,
  rotateSecretAction,
  updateCallbackAction,
  updateExternalEntryAction,
  entryErrorMessage,
  newEntryKey,
  newEntrySecret
}: ManageProductSourceDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [selectedSourceId, setSelectedSourceId] = useState(selectedSource?.id ?? "");
  const activeSource =
    productSources.find((source) => source.id === selectedSourceId) ?? selectedSource ?? productSources[0] ?? null;
  const showEntrySecret = newEntryKey && newEntrySecret && activeSource?.key === newEntryKey;

  return (
    <>
      <button
        className={secondaryButtonClass}
        type="button"
        disabled={!activeSource}
        onClick={() => dialogRef.current?.showModal()}
      >
        <Settings2 size={15} aria-hidden="true" />
        Manage source
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(calc(100vw-2rem),720px)] rounded-lg border border-line bg-panel p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Power size={18} className="text-muted" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-ink">Manage product source</h2>
              <p className="mt-0.5 text-xs text-muted">{activeSource?.name ?? "No product selected"}</p>
            </div>
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
        <div className="max-h-[min(780px,calc(100vh-8rem))] overflow-y-auto p-5">
          <div className="mb-4 max-w-sm">
            <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="manage-source-dialog-select">
              Product
              <select
                id="manage-source-dialog-select"
                value={activeSource?.id ?? ""}
                className={inputClass}
                onChange={(event) => setSelectedSourceId(event.target.value)}
              >
                {productSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {entryErrorMessage ? (
            <div className="mb-4 rounded-md border border-critical/30 bg-critical-bg px-3 py-2 text-sm text-critical">
              {entryErrorMessage}
            </div>
          ) : null}
          {showEntrySecret ? (
            <div className="mb-4 flex flex-col gap-1 rounded-md border border-warning-bg bg-warning-bg p-4 text-sm">
              <strong className="text-warning">Embedded entry secret generated for {newEntryKey}</strong>
              <span className="text-muted">Store this now. It will not be shown again.</span>
              <code className="mt-1 break-all rounded bg-panel px-2 py-1 text-xs text-ink">{newEntrySecret}</code>
            </div>
          ) : null}
          <div key={activeSource?.id ?? "no-source"}>
            <Tabs
              active={activeTab}
              onChange={setActiveTab}
              items={[
                { key: "details", label: "Details" },
                { key: "secret", label: "Intake secret" },
                { key: "callback", label: "Status callback" },
                { key: "embedded", label: "Embedded access" }
              ]}
            >
              {(tab) => (
                <>
                {tab === "details" ? (
                  <form action={updateSourceAction} className="flex flex-col gap-3">
                    <input name="sourceId" type="hidden" value={activeSource?.id ?? ""} />
                    <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="manage-source-name">
                      Name
                      <input
                        id="manage-source-name"
                        name="name"
                        minLength={2}
                        required
                        defaultValue={activeSource?.name ?? ""}
                        className={inputClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="manage-source-type">
                      Type
                      <select id="manage-source-type" name="type" defaultValue={activeSource?.type ?? "api"} className={inputClass}>
                        <option value="api">API</option>
                        <option value="webhook">Webhook</option>
                        <option value="manual">Manual</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="manage-source-group">
                      Product group
                      <select
                        id="manage-source-group"
                        name="groupId"
                        defaultValue={activeSource?.groupId ?? ""}
                        className={inputClass}
                      >
                        <option value="">Ungrouped</option>
                        {productGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-muted">
                      <input
                        name="enabled"
                        type="checkbox"
                        defaultChecked={activeSource?.enabled ?? true}
                        className="size-4 rounded border-line accent-brand"
                      />
                      Enabled
                    </label>
                    <ConfirmSubmitButton className={primaryButtonClass} confirmMessage="Save changes to this product source?" pendingChildren="Saving...">
                      Save source
                    </ConfirmSubmitButton>
                  </form>
                ) : null}

                {tab === "secret" ? (
                  <form action={rotateSecretAction} className="flex flex-col gap-3">
                    <input name="sourceId" type="hidden" value={activeSource?.id ?? ""} />
                    <p className="rounded-md border border-warning-bg bg-warning-bg px-3 py-2 text-sm text-warning">
                      Rotating this secret will stop existing product intake integrations until they use the new secret.
                    </p>
                    <ConfirmSubmitButton
                      className={secondaryButtonClass}
                      confirmMessage="Rotate this source secret? Existing integrations using the old secret will stop working."
                      pendingChildren="Rotating..."
                    >
                      <RefreshCw size={15} />
                      Rotate intake secret
                    </ConfirmSubmitButton>
                  </form>
                ) : null}

                {tab === "callback" ? (
                  <form action={updateCallbackAction} className="flex flex-col gap-3">
                    <input name="sourceId" type="hidden" value={activeSource?.id ?? ""} />
                    <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="callback-url">
                      Callback URL
                      <input
                        id="callback-url"
                        name="callbackUrl"
                        placeholder="https://product.example.com/feedapp/callback"
                        className={inputClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="callback-secret">
                      Signing secret
                      <PasswordInput
                        id="callback-secret"
                        name="callbackSecret"
                        placeholder="Shared callback signing secret"
                        className={inputClass}
                      />
                    </label>
                    <p className="text-xs text-muted">Leave URL and secret blank to disable callbacks for the selected source.</p>
                    <ConfirmSubmitButton className={secondaryButtonClass} confirmMessage="Save callback settings for this product source?" pendingChildren="Saving...">
                      Save callback
                    </ConfirmSubmitButton>
                  </form>
                ) : null}

                {tab === "embedded" ? (
                  <form action={updateExternalEntryAction} className="flex flex-col gap-3">
                    <input name="sourceId" type="hidden" value={activeSource?.id ?? ""} />
                    <label className="flex items-center gap-1.5 text-sm text-muted">
                      <input
                        name="enabled"
                        type="checkbox"
                        defaultChecked={activeSource?.externalEntryConfigured ?? false}
                        className="size-4 rounded border-line accent-brand"
                      />
                      Enable signed external entry
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="entry-issuer">
                      Issuer
                      <input
                        id="entry-issuer"
                        name="issuer"
                        defaultValue={activeSource?.externalEntryIssuer ?? ""}
                        placeholder="commerce-dashboard"
                        className={inputClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="entry-ttl">
                      Token TTL seconds
                      <input
                        id="entry-ttl"
                        name="tokenTtlSeconds"
                        type="number"
                        min={60}
                        max={3600}
                        defaultValue={activeSource?.externalEntryTokenTtlSeconds ?? 300}
                        className={inputClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-muted" htmlFor="entry-origins">
                      Allowed iframe origins
                      <textarea
                        id="entry-origins"
                        name="allowedOrigins"
                        rows={3}
                        defaultValue={activeSource?.externalEntryAllowedOrigins.join("\n") ?? ""}
                        placeholder="https://analytics.example.com"
                        className={inputClass}
                      />
                    </label>
                    <fieldset className="flex flex-col gap-2 rounded-md border border-line p-3">
                      <legend className="px-1 text-sm font-medium text-muted">Allowed destinations</legend>
                      <label className="flex items-center gap-2 text-sm text-muted">
                        <input
                          name="allowedModes"
                          type="checkbox"
                          value="embed"
                          defaultChecked={activeSource?.externalEntryAllowedModes.includes("embed") ?? true}
                          className="size-4 rounded border-line accent-brand"
                        />
                        Embedded dashboard
                      </label>
                      <label className="flex items-center gap-2 text-sm text-muted">
                        <input
                          name="allowedModes"
                          type="checkbox"
                          value="portal"
                          defaultChecked={activeSource?.externalEntryAllowedModes.includes("portal") ?? false}
                          className="size-4 rounded border-line accent-brand"
                        />
                        Full FeedApp portal
                      </label>
                    </fieldset>
                    <label className="flex items-center gap-1.5 text-sm text-muted">
                      <input name="rotateSecret" type="checkbox" className="size-4 rounded border-line accent-brand" />
                      Generate or rotate entry signing secret
                    </label>
                    <p className="text-xs text-muted">
                      Product dashboard backends sign HS256 JWTs with this secret and open `/external-entry?token=...&mode=embed`.
                    </p>
                    <ConfirmSubmitButton className={secondaryButtonClass} confirmMessage="Save embedded access settings for this product source?" pendingChildren="Saving...">
                      Save embedded access
                    </ConfirmSubmitButton>
                  </form>
                ) : null}
                </>
              )}
            </Tabs>
          </div>
        </div>
      </dialog>
    </>
  );
}
