# FeedApp - Session Summary

This document tracks what happened during each work session. Update it at the end of every meaningful session so the project history stays clear.

## Project Summary

The project is an internal customer feedback and resolution hub for centralizing customer reports, tracking ownership and status, enforcing SLA workflows, coordinating departments, managing approved customer communication, and integrating with product systems.

The current implementation is a database-backed Next.js/React internal operations app with product-scoped access, case workflows, product intake, signed product callbacks, customer messaging delivery tracking, admin settings, and operational retry foundations. It is not production-ready yet; the next major step is SLA/escalation automation, product embedded monitoring, or production deployment hardening depending on priority.

## Current Status

- Overall stage: database-backed internal workflow foundation with product-scoped authorization, customer messaging delivery tracking, admin operations foundations, and agentic product-knowledge/MCP foundations implemented pending only real-session assistant smoke validation.
- Current active phases: Phase 1, Phase 2, Phase 3, Phase 4, Phase 6, Phase 7, Phase 9, Phase 10, Phase 13, and Phase 14.
- Most important next work: run a browser-session assistant smoke test, then move to SLA/escalation automation, product embedded monitoring, or production deployment hardening.
- Current runtime data source: Postgres for the dashboard, case pages, settings/admin pages, cases API, product intake, message delivery status, product callback attempts, operations view, and product knowledge metadata; analytics recommendations still use stub/provider foundations.
- Current database setup state: Docker Compose, initial migration, seed script, and seed verification are working against local Postgres.
- Current authentication state: email/password sessions are implemented with provisioning and temporary-password enforcement; SSO remains deferred.
- Current integration state: product intake validation, credentials, persistence, idempotency, signed outbound source callbacks, callback delivery tracking, and failed-callback retry are implemented; embed tokens and queues are not implemented yet.
- Current messaging state: approved replies, automated acknowledgements, resolved/closed notifications, delivery status tracking, failed-delivery retry, and environment-backed stub/HTTP provider selection are implemented.
- Current UI/design state: the staff-facing app (dashboard, settings, case detail, manual intake, login, change-password, operations) runs on a single Tailwind CSS v4 design system with a shared component library; no page still depends on the old hand-rolled `globals.css` component styles.

## Latest Session

Date: 2026-08-18

### 2026-08-18 - Deployed Chat-Management Smoke Check

Summary:

- Confirmed FeedApp chat-management registration/linking should be treated as complete.
- Updated `plan.md` so FeedApp application registration and MCP linking are marked done.
- Smoke-checked the deployed chat-management backend at `http://54.246.247.31:8008`.
- Confirmed `CHAT_MANAGEMENT_API_URL` in local FeedApp config points at the reachable deployed backend.
- Verified chat-management `/health` returns healthy and `/` identifies the chat-management service.
- Verified `/chat-v2/legacy` with the configured FeedApp app key reaches token verification, while an invalid app key is rejected separately.
- Left only a real browser/session assistant smoke test as the remaining validation item.

Files changed:

- `plan.md`
- `summary.md`

Verification:

- `npx vitest run tests/api-agent-chat-route.test.ts tests/api-agent-auth-verify-route.test.ts tests/api-mcp-route.test.ts tests/mcp-tools.test.ts tests/agent-bot-service.test.ts tests/api-agent-actions-route.test.ts`: passed, 26 tests.
- `curl`/network smoke: `http://54.246.247.31:8008/health` returned `200`.
- `curl`/network smoke: `http://54.246.247.31:8008/` returned chat-management service metadata.
- `POST http://54.246.247.31:8008/chat-v2/legacy` with configured FeedApp app key and invalid session returned `401 Token verification failed`, confirming app-key routing reached session verification.
- `POST http://54.246.247.31:8008/chat-v2/legacy` with invalid app key returned `401 Invalid API key`.

### 2026-08-18 - Product Knowledge And Case UX Refinements

Summary:

- Improved Product knowledge row actions so Reindex, Refresh status, and Delete are compact aligned icon controls with accessible labels.
- Kept refresh as a per-document action because document-service processing status is tracked by each document's task ID.
- Added typed document-service request errors and made product knowledge delete treat remote 404 as successful local cleanup, so already-missing remote documents can still be removed from FeedApp.
- Renamed visible recommendation surfaces from customer recommendation wording to `ITC Product Recommendation` while keeping backend audit action keys stable.
- Gated ITC Product Recommendation display to `Resolved` and `Closed` cases.
- Added actor badges to the activity timeline so the person or system that performed each action is visible beside the event title.
- Made the dashboard case filters collapsible; the panel is collapsed by default and opens automatically when filters are active.

Files changed:

- `summary.md`
- `src/app/page.tsx`
- `src/app/cases/[caseId]/page.tsx`
- `src/app/settings/products/page.tsx`
- `src/components/product-knowledge-dialog.tsx`
- `src/lib/document-service.ts`
- `src/services/product-knowledge.ts`
- `src/services/case-timeline.ts`
- `tests/case-timeline.test.ts`
- `tests/document-service-client.test.ts`
- `tests/product-knowledge-service.test.ts`

Verification:

- `npx vitest run tests/product-knowledge-service.test.ts tests/document-service-client.test.ts tests/case-timeline.test.ts`: passed, 17 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 193 tests.
- `npm run build:verify`: passed.

### 2026-08-18 - Phase 14 Status Reconciliation And Product Knowledge Reindex

Summary:

- Reconciled `plan.md` so Phase 13 and Phase 14 reflect the implemented FeedApp MCP endpoint, permission-scoped MCP tools, dashboard assistant, draft-only bot workflow, confirmation cards, and audit coverage.
- Added product knowledge reindex/replacement UI from `Settings > Products`.
- Replacement uploads now pass the existing document-service document ID so document-service replaces old chunks while FeedApp preserves the same knowledge metadata identity.
- Changed product knowledge metadata persistence to upsert by document-service ID, allowing reindex operations to update the existing record instead of colliding with the unique document ID.
- Added focused tests for product knowledge replacement and repository upsert behavior.

Files changed:

- `plan.md`
- `summary.md`
- `src/app/settings/products/page.tsx`
- `src/components/product-knowledge-dialog.tsx`
- `src/repositories/product-knowledge.ts`
- `tests/product-knowledge-repository.test.ts`
- `tests/product-knowledge-service.test.ts`

Verification:

- `npx vitest run tests/product-knowledge-service.test.ts tests/product-knowledge-repository.test.ts tests/document-service-client.test.ts`: passed, 14 tests.
- `npm run typecheck`: passed.
- `npx vitest run tests/mcp-tools.test.ts tests/api-mcp-route.test.ts tests/agent-bot-service.test.ts tests/api-agent-chat-route.test.ts tests/api-agent-actions-route.test.ts tests/product-knowledge-service.test.ts tests/product-knowledge-repository.test.ts`: passed, 32 tests.
- `npm run lint`: passed.
- `npm test`: passed, 192 tests.
- `npm run build:verify`: passed.
- `npx prisma validate`: passed.

Date: 2026-08-10

### 2026-08-10 - Product-Scoped Case Tags

Summary:

- Added product-scoped `CaseTag` and `CaseTagAssignment` schema models and migration.
- Added case tag repository and service with product-scope permission checks.
- Added tag management under `Settings > Products` for Admins and directly assigned Product Managers, with centered add-tag modal that selects product, name, description, and color.
- Added case detail tag assignment/removal for users who can access the case.
- Moved case detail tags into the Case Summary grid in place of the redundant Product field, and removed the separate Case Tags panel.
- Updated Products settings copy so Product Managers can clearly find product tag management.
- Fixed Product Manager settings visibility so Products appears for any Product Manager with scoped product access, while roster controls remain limited to direct roster managers/admins.
- Refined Product tags table editing so rows are read-only by default, use icon-only edit/save controls, skip unchanged server submissions, and show `No description` for empty descriptions.
- Added dashboard tag filtering and tag badges on case list rows.
- Added tags to product report list responses.
- Added product-authenticated APIs for listing/creating tags and assigning/removing tags on source-owned cases.

Files changed:

- `README.md`
- `plan.md`
- `summary.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260810112000_product_case_tags/migration.sql`
- `src/app/api/ingestion/tags/route.ts`
- `src/app/api/ingestion/reports/[caseId]/tags/route.ts`
- `src/app/cases/[caseId]/page.tsx`
- `src/app/page.tsx`
- `src/app/settings/products/page.tsx`
- `src/components/product-tag-dialog.tsx`
- `src/repositories/case-tags.ts`
- `src/repositories/cases.ts`
- `src/services/case-tags.ts`
- `tests/case-tags-service.test.ts`
- `tests/case-repository.test.ts`

Verification:

- `npx prisma generate`: passed.
- `npx prisma validate`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 183 tests.
- `npm run build:verify`: passed.

### 2026-08-10 - Case Conversation History

Summary:

- Reused the existing case `Message` table as the case conversation stream.
- Added inbound customer feedback message creation when new cases are created.
- Added a data migration to backfill existing cases with an initial inbound conversation message from the case description.
- Added a collapsible `Conversation` section in case detail between `Customer details` and `Activity timeline`.
- Converted the case detail activity timeline into a collapsible section and kept customer-facing messages out of the operational timeline.

Files changed:

- `summary.md`
- `prisma/migrations/20260810134000_backfill_case_conversation_messages/migration.sql`
- `src/app/cases/[caseId]/page.tsx`
- `src/repositories/messages.ts`
- `src/services/case-timeline.ts`
- `src/services/cases.ts`
- `tests/case-service.test.ts`

Verification:

- `npm run typecheck`: passed.
- `npx vitest run tests/case-service.test.ts tests/case-timeline.test.ts tests/case-repository.test.ts`: passed, 43 tests.
- `npm run lint`: passed.
- `npm test`: passed, 185 tests.
- `npx prisma validate`: passed.
- `npm run build:verify`: passed.
- `npx prisma migrate deploy`: passed after allowing local DB access.
- Local DB sanity check: `{"inboundMessages":7}`.

### 2026-08-10 - Product Inbound Reply API

Summary:

- Added product-authenticated `POST /api/ingestion/reports/[caseId]/messages` for app/product systems to append customer replies to a case conversation.
- The endpoint accepts `Email` or `SMS` replies, body, optional external message ID, and optional customer metadata.
- The case can be resolved by FeedApp case ID or by the product's submitted case ID, scoped to the authenticated product source.
- Inbound replies are stored as inbound customer messages and audited as `case.customer_reply_received`.
- Replies to `Resolved` or `Closed` cases automatically transition the case to `Reopened`, create a status-change audit event, create a new case stage, and send the product callback when configured.
- Documented the endpoint in `README.md`.

Files changed:

- `README.md`
- `summary.md`
- `src/app/api/ingestion/reports/[caseId]/messages/route.ts`
- `src/lib/validation.ts`
- `src/repositories/messages.ts`
- `src/services/cases.ts`
- `tests/api-ingestion-report-messages-route.test.ts`
- `tests/case-service.test.ts`

Verification:

- `npm run typecheck`: passed.
- `npx vitest run tests/case-service.test.ts tests/api-ingestion-report-messages-route.test.ts`: passed, 40 tests.
- `npm run lint`: passed.
- `npm test`: passed, 191 tests.
- `npm run build:verify`: passed.

### 2026-08-10 - Assistant Action Confirmation Cards

Summary:

- Added a shared FeedApp agent action contract for proposed case transitions and assignments.
- Updated `/api/agent/chat` to extract `proposedActions` from chat-management metadata/content/message JSON and return them to the widget.
- Added `/api/agent/actions` for confirming or dismissing proposed assistant actions.
- Confirmed status transitions execute through `transitionCaseForUser`; confirmed assignments execute through `assignCaseForUser`.
- Added audit events for dismissed, confirmed, and failed proposed actions.
- Added confirmation cards to the floating assistant with `Confirm` and `Dismiss` controls.
- Added `list_assignable_users_for_case` MCP tool so chat-management can propose assignments with exact user IDs.

Files changed:

- `README.md`
- `plan.md`
- `summary.md`
- `src/app/api/agent/actions/route.ts`
- `src/app/api/agent/chat/route.ts`
- `src/components/agent-chat-widget.tsx`
- `src/lib/agent-actions.ts`
- `src/services/mcp-tools.ts`
- `tests/api-agent-actions-route.test.ts`
- `tests/api-agent-chat-route.test.ts`
- `tests/mcp-tools.test.ts`

Verification:

- `npx vitest run tests/api-agent-actions-route.test.ts tests/api-agent-chat-route.test.ts tests/mcp-tools.test.ts tests/api-mcp-route.test.ts`: passed, 18 tests.
- `npm run typecheck`: passed.

### 2026-08-10 - Connected Dashboard Assistant

Summary:

- Added FeedApp-owned `/api/agent/chat` as the stable dashboard chat endpoint.
- Added a floating FeedApp assistant widget mounted through `AppShell` when `FEEDBACK_AGENT_ENABLED=true`.
- Forwarded dashboard chat to registered chat-management using the current FeedApp session token and `CHAT_MANAGEMENT_APP_KEY`.
- Wrapped chat requests with FeedApp operational instructions so chat-management uses FeedApp MCP tools and does not execute sensitive actions without a FeedApp confirmation flow.
- Added MCP tools for permission-scoped feedback counts, filtered case lists, and next-action recommendations.
- Kept direct status transitions and assignment execution out of MCP pending explicit UI confirmation cards.

Files changed:

- `README.md`
- `plan.md`
- `summary.md`
- `src/app/api/agent/chat/route.ts`
- `src/components/agent-chat-widget.tsx`
- `src/components/app-shell.tsx`
- `src/services/mcp-tools.ts`
- `tests/api-agent-chat-route.test.ts`
- `tests/mcp-tools.test.ts`

Verification:

- `npx vitest run tests/api-agent-chat-route.test.ts tests/mcp-tools.test.ts tests/api-mcp-route.test.ts`: passed, 13 tests.
- `npm run typecheck`: passed.

### 2026-08-10 - Agentic Bot Draft Workflow

Summary:

- Added a FeedApp chat-management client for the application-scoped `/chat-v2/legacy` endpoint using `X-App-Key` and the current FeedApp session bearer token.
- Added the FeedApp agent bot service behind `FEEDBACK_AGENT_ENABLED`.
- Added draft-only bot reply generation that calls chat-management, reuses a tool-created approval ID when returned, or stores the returned text through the existing customer reply approval flow.
- Added case-detail `Generate draft` UI for eligible users when the feature flag is enabled and a product-manager approval route exists.
- Added audit/observability events for bot request, draft creation, failure, MCP product-knowledge search, MCP draft creation, and MCP internal-note additions.
- Documented chat-management application registration and FeedApp MCP server linking.

Files changed:

- `README.md`
- `plan.md`
- `summary.md`
- `src/app/cases/[caseId]/page.tsx`
- `src/lib/chat-management.ts`
- `src/services/agent-bot.ts`
- `src/services/mcp-tools.ts`
- `tests/agent-bot-service.test.ts`
- `tests/mcp-tools.test.ts`

Verification:

- `npx vitest run tests/agent-bot-service.test.ts tests/mcp-tools.test.ts tests/api-mcp-route.test.ts`: passed, 11 tests.
- `npm run typecheck`: passed.

Date: 2026-08-06

### 2026-08-06 - Agentic Feedback Bot Foundations

Date: 2026-08-06

Summary:

- Added `agentic_featurePlan.md` with the phased plan for the FeedApp first-response bot, product knowledge indexing, document-service integration, FeedApp MCP tools, and draft-only bot replies.
- Added FeedApp environment placeholders for `FEEDBACK_AGENT_ENABLED`, document-service URL/API key, and chat-management URL/app key.
- Extended document-service search to accept `project_id`, using FeedApp `IntegrationSource.key` as the product knowledge scope.
- Added document-service `X-Service-Key` support for trusted FeedApp backend calls while preserving JWT support for existing callers.
- Added a typed FeedApp document-service client wrapper for product knowledge search, text/file upload, processing status, and delete.
- Added FeedApp product knowledge metadata enums/model, migration, repository, and tests.
- Added product knowledge access-control helpers and a service layer for text upload, scoped search, status refresh, and delete.
- Added `Settings > Products` product knowledge management for selected products, including text/file upload, document list, status refresh, and delete actions.
- Fixed processing status refresh to call document-service with the stored processing task ID instead of the document-service document ID.
- Added FeedApp-owned `/api/mcp` JSON-RPC endpoint with service-token authorization for `initialize`, `tools/list`, and `tools/call`.
- Added v1 MCP tools for case context lookup, case-scoped product knowledge search, draft-only customer reply approval creation, and internal note creation.
- Added `GET /api/agent-auth/verify` so chat-management can validate FeedApp session bearer tokens through `verify_url` application auth.
- Updated the ERID agent admin frontend MCP server forms so `api_key` auth exposes an API key field and sends `auth_config.api_key` to chat-management.
- Fixed the ERID application API-key copy button so it falls back when `navigator.clipboard` is unavailable or blocked.
- Fixed ERID auth-service user creation so `email_sent` reflects the actual SMTP send result instead of only echoing the request flag.
- Added ERID auth-service `EMAIL_PROVIDER=itc` support so user-creation emails can be delivered through the same ITC messaging HTTP provider used by FeedApp, without SMTP username/password credentials.
- Updated `plan.md` with Phase 14 for the agentic feedback bot and marked the completed foundation tasks.

Files changed:

- `.env.example`
- `agentic_featurePlan.md`
- `plan.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260806113000_product_knowledge_documents/migration.sql`
- `src/lib/access-control.ts`
- `src/lib/document-service.ts`
- `src/repositories/product-knowledge.ts`
- `src/services/product-knowledge.ts`
- `src/services/mcp-tools.ts`
- `src/components/product-knowledge-dialog.tsx`
- `src/app/settings/products/page.tsx`
- `src/app/api/mcp/route.ts`
- `src/app/api/agent-auth/verify/route.ts`
- `tests/access-control.test.ts`
- `tests/document-service-client.test.ts`
- `tests/product-knowledge-repository.test.ts`
- `tests/product-knowledge-service.test.ts`
- `../itc-agent-framework/docker-compose.yml`
- `../itc-agent-framework/document-service/.env.example`
- `../itc-agent-framework/document-service/app/core/config.py`
- `../itc-agent-framework/document-service/app/core/security.py`
- `../itc-agent-framework/document-service/app/routers/documents.py`
- `../itc-agent-framework/document-service/app/schemas/document.py`
- `../itc-agent-framework/document-service/app/services/document_search_filters.py`
- `../itc-agent-framework/document-service/app/services/document_service.py`
- `../itc-agent-framework/document-service/app/services/elasticsearch_service.py`
- `../itc-agent-framework/document-service/tests/test_document_search_filters.py`
- `../itc-agent-framework/document-service/tests/test_service_key_auth.py`
- `../itc-agent-framework/itc-agent-frontend/src/app/admin/mcp-servers/page.tsx`
- `../itc-agent-framework/itc-agent-frontend/src/app/admin/applications/components/app-mcp-servers.tsx`
- `../itc-agent-framework/itc-agent-frontend/src/app/admin/applications/components/api-key-banner.tsx`
- `../itc-agent-framework/itc-agent-frontend/src/app/admin/users/create-user-modal.tsx`
- `../itc-agent-framework/.env.example`
- `../itc-agent-framework/erid-auth-service/.env.example`
- `../itc-agent-framework/erid-auth-service/app/core/config.py`
- `../itc-agent-framework/erid-auth-service/app/services/email_service.py`
- `../itc-agent-framework/erid-auth-service/app/services/admin_service.py`
- `../itc-agent-framework/erid-auth-service/app/routers/admin.py`

Verification:

- `npx vitest run tests/access-control.test.ts tests/document-service-client.test.ts tests/product-knowledge-repository.test.ts tests/product-knowledge-service.test.ts`: passed, 24 tests.
- `npx vitest run tests/api-mcp-route.test.ts tests/mcp-tools.test.ts`: passed, 7 tests.
- `npx vitest run tests/api-agent-auth-verify-route.test.ts tests/api-mcp-route.test.ts tests/mcp-tools.test.ts`: passed, 11 tests.
- `npx vitest run tests/document-service-client.test.ts tests/product-knowledge-repository.test.ts`: passed, 7 tests.
- `npx prisma validate`: passed.
- `npm run typecheck`: passed.
- `python3 -B -m py_compile ...` for changed document-service Python files: passed.
- `python3 -B -m py_compile app/core/config.py app/services/email_service.py app/services/admin_service.py app/routers/admin.py` for changed ERID auth-service Python files: passed.
- Document-service pytest was not run locally because the active Python environment is missing project dependencies such as `pytest` and `jwt`.

Date: 2026-08-05

### 2026-08-05 - Public URL for External Entry Redirects

Date: 2026-08-05

Summary:

- Added a shared public URL helper for absolute redirects that prefers `PUBLIC_APP_URL` when configured.
- Updated trusted external-entry redirects and the embed exit route so EC2/Docker runtime URLs like `localhost:3000` do not leak into user-facing redirects.
- Added URL-backed embed context via `entryMode=embed` so case detail pages keep embedded chrome even when cookie context is unavailable.
- Preserved embed context and product source through dashboard case links, operations queue links, pagination, filters, and case-detail workflow forms.
- Updated case-detail workflow redirects to use `PUBLIC_APP_URL` when configured, covering assignee/status/note/reply server actions that could otherwise expose runtime-local URLs after a save.
- Added `src/middleware.ts` to sync `entryMode=embed` URL state into entry-context cookies so layouts such as settings render embedded chrome when opened from the avatar menu.
- Updated customer reply UI so Product Managers can send updates directly, while users who require routing still see a disabled approval button plus a `No product manager reviewer configured` tag when no reviewer exists.
- Documented `PUBLIC_APP_URL` for direct EC2 beta testing on `:18081` and for later HTTPS/domain deployments.
- Added regression coverage for embed-mode external entry when the runtime request URL is internal but the public app URL is configured.

Files changed:

- `.env.production.example`
- `README.md`
- `docs/deploy-ec2-docker.md`
- `src/app/embed/exit/route.ts`
- `src/app/embed/page.tsx`
- `src/app/external-entry/route.ts`
- `src/app/cases/[caseId]/page.tsx`
- `src/app/page.tsx`
- `src/components/app-shell.tsx`
- `src/lib/public-url.ts`
- `src/middleware.ts`
- `tests/embed-middleware.test.ts`
- `tests/external-entry-route.test.ts`
- `summary.md`

Verification:

- `npx vitest run tests/embed-middleware.test.ts tests/access-control.test.ts tests/case-service.test.ts tests/external-entry-route.test.ts tests/external-entry-service.test.ts`: passed, 55 tests.
- `npx vitest run tests/embed-middleware.test.ts tests/external-entry-route.test.ts tests/external-entry-service.test.ts`: passed, 11 tests after moving middleware under `src/`.
- `npm run typecheck`: passed.
- `npm run build:verify`: passed, and `.next-verify/server/middleware-manifest.json` now registers `src/middleware`.

Date: 2026-08-04

### 2026-08-04 - Product Settings Dialog UX

Date: 2026-08-04

Summary:

- Reworked `Settings > Products` so product roster management, product source creation, and source administration are easier to scan from the main sections.
- Moved the `Add rep` action into the Product reps section header next to the selected product dropdown.
- Changed rep assignment into a centered dialog that lets admins select from provisioned users while preserving email-based entry for scoped non-admin roster managers.
- Moved `Add product source` and `Manage source` into the Product sources section header.
- Moved `Add product group` into the Product groups section header and changed product-group creation into a centered dialog.
- Replaced the product-group add-only dialog with a unified `Manage product groups` dialog.
- Added product-group dialog tabs for creating a new group and managing an existing group.
- Added product-group management support for renaming the group display name, updating its description, and assigning/removing product sources from the group while keeping group keys immutable.
- Consolidated source details, intake secret rotation, status callback configuration, and embedded access configuration into one centered `Manage source` dialog.
- Changed the source selector inside the `Manage source` dialog to use client-side state so switching products does not refresh the whole settings page.
- Removed the legacy environment-based external-entry fallback so trusted external entry is configured only through per-product admin settings.
- Renamed the embedded access enablement checkbox to `Enable signed external entry` and clarified entry modes as `Allowed destinations`.
- Used segmented tabs with separate forms and submit buttons so each source-management action can continue to map cleanly to its own server action.
- Kept callback and embedded-entry access management inside the source management dialog without duplicating existing source-management logic.

Files changed:

- `src/app/settings/products/page.tsx`
- `src/components/manage-product-source-dialog.tsx`
- `src/components/product-group-dialog.tsx`
- `src/components/product-roster-user-dialog.tsx`
- `src/services/admin.ts`
- `src/services/external-entry.ts`
- `.env.example`
- `README.md`
- `tests/admin-service.test.ts`
- `tests/external-entry-service.test.ts`
- `summary.md`

Verification:

- `npm run typecheck`: passed.
- `npx vitest run tests/admin-service.test.ts`: passed, 20 tests.
- `npx vitest run tests/external-entry-service.test.ts tests/external-entry-route.test.ts`: passed, 9 tests.
- `npm run lint`: passed.
- `npm test`: passed, 137 tests.
- `npm run build:verify`: passed.

### 2026-08-04 - Admin-Managed Embedded Entry Settings

Date: 2026-08-04

Summary:

- Added per-product embedded dashboard entry configuration under `Settings > Products`.
- Kept embedded entry secrets separate from product intake secrets and product callback signing secrets.
- Added admin controls to enable trusted entry, set issuer, token TTL, allowed iframe origins, allowed entry modes, and generate or rotate the one-time entry signing secret.
- Stored embedded entry settings in `IntegrationSource.config.externalEntry`, matching the existing product callback config pattern.
- Extended external-entry authentication to verify DB-backed per-product HS256 entry configs before falling back to the legacy/global `EXTERNAL_ENTRY_*` environment config.
- Enforced configured entry modes so a product can allow embed-only, portal-only, or both.
- Added product-source table visibility for embedded entry status.
- Updated README and `.env.example` to document per-product embedded entry settings and the deployment-level iframe allow-list.
- Added regression coverage for admin-managed embedded entry config and DB-backed external-entry verification.

Files changed:

- `.env.example`
- `README.md`
- `src/app/settings/products/page.tsx`
- `src/repositories/integrations.ts`
- `src/services/admin.ts`
- `src/services/external-entry.ts`
- `tests/admin-service.test.ts`
- `tests/case-service.test.ts`
- `tests/external-entry-route.test.ts`
- `tests/external-entry-service.test.ts`
- `tests/ingestion-service.test.ts`
- `summary.md`

Verification:

- `npm run typecheck`: passed.
- `npm test`: passed, 137 tests.

### 2026-08-04 - Embedded Product Dashboard Access

Date: 2026-08-04

Summary:

- Added explicit external-entry embed mode with `mode=embed`, keeping the existing portal mode as the default.
- Added entry-context cookies so FeedApp can render embedded chrome after trusted external entry without changing the existing RBAC or product-scope enforcement.
- Added `/embed` as a stable embedded landing route and `/embed/exit` as the "Open full FeedApp" escape hatch.
- Updated the shared `AppShell` to reuse existing dashboard, case, and settings pages while switching to compact embedded chrome when the session is in embed mode.
- Removed redundant embedded top-bar Cases/Settings navigation and standalone settings gear, leaving product scope, full-portal action, and the avatar menu.
- Kept full FeedApp sidebar sign-out available in portal mode and kept embed sign-out available from the avatar menu.
- Improved the external-entry error page with branded, reason-specific messaging for expired, invalid, unprovisioned, and unauthorized trusted-entry links.
- Added iframe allow-list support through `EMBED_ALLOWED_ORIGINS`, emitting a `frame-ancestors` CSP when configured.
- Updated external-entry route tests, README guidance, and `.env.example` for embedded access.

Files changed:

- `README.md`
- `.env.example`
- `next.config.mjs`
- `src/app/actions/auth.ts`
- `src/app/change-password/page.tsx`
- `src/app/embed/page.tsx`
- `src/app/embed/exit/route.ts`
- `src/app/external-entry/error/page.tsx`
- `src/app/external-entry/route.ts`
- `src/app/login/page.tsx`
- `src/components/app-shell.tsx`
- `src/lib/session-cookie.ts`
- `tests/external-entry-route.test.ts`
- `summary.md`

Verification:

- `npm run typecheck`: passed.
- `npm test`: passed, 135 tests.
- `npm run build:verify`: passed.

## Previous Sessions

Date: 2026-07-29

### 2026-07-29 - Product Onboarding Manager Requirement

Date: 2026-07-29

Summary:

- Made initial direct Product Manager assignment part of product source onboarding.
- Extended product source creation to require a provisioned user with the `Product Manager` role.
- Created the product source and initial direct product-manager access in one transaction.
- Updated the product source creation form to require selecting an initial Product Manager and to disable onboarding until one exists.
- Moved product source onboarding out of the right panel into an `Add product source` dialog launched from a top-right action above the product group form.
- Added regression coverage for product source creation assigning the initial direct Product Manager.

Files changed:

- `src/components/product-source-dialog.tsx`
- `src/services/admin.ts`
- `src/app/settings/products/page.tsx`
- `tests/admin-service.test.ts`
- `summary.md`

Verification:

- `npm test -- tests/admin-service.test.ts`: passed, 8 tests.
- `npm test`: passed, 105 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.

### 2026-07-29 - Role-Aware Settings Navigation

Date: 2026-07-29

Summary:

- Made the Settings segmented navigation role-aware so non-admin users no longer see tabs for sections they cannot use.
- Kept `Overview` and `Team & access` visible for all provisioned users.
- Kept `Products` visible only for Admins and Product Managers with direct roster-management access.
- Kept `Messaging` and `Operations` visible only for Admins.
- Updated Settings overview cards to match the same permissions and to use scoped descriptions for non-admin users.

Files changed:

- `src/app/settings/layout.tsx`
- `src/app/settings/page.tsx`
- `summary.md`

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 104 tests.
- `npm run build:verify`: passed.

### 2026-07-29 - Case Role Separation and Approval Routing

Date: 2026-07-29

Summary:

- Split platform administration from case operations: `Admin` alone no longer grants case visibility, case creation, close/reopen, escalation, or customer reply approval.
- Kept admin powers for platform management and product roster administration, while case access now requires operational roles plus product scope.
- Removed Admin fallback from customer reply approval routing; approvals now route only to provisioned Product Managers for the case product, excluding the requester.
- Added approval-route availability checks so reply approval requests are rejected when no eligible Product Manager is configured.
- Changed pending approval queues to show only approvals routed to the current reviewer.
- Changed case detail to separate actionable `Pending approvals` from read-only `Approval in progress` items.
- Changed case detail access handling so existing-but-inaccessible cases render a clear access-unavailable state instead of a 404.
- Removed direct `Send to customer` buttons from case-detail draft/recommendation prompts, keeping customer-facing replies on the approval path.
- Added tests for admin-only case invisibility, Product Manager-only approvals, no-reviewer routing failures, approval-route lookup, forbidden vs missing case detail access, and repository-level admin-only no-case visibility.

Files changed:

- `src/lib/access-control.ts`
- `src/repositories/cases.ts`
- `src/repositories/messages.ts`
- `src/services/cases.ts`
- `src/app/cases/[caseId]/page.tsx`
- `tests/access-control.test.ts`
- `tests/case-service.test.ts`
- `tests/case-repository.test.ts`
- `summary.md`

Verification:

- `npm test`: passed, 104 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.

### 2026-07-29 - Scoped Team Access View

Date: 2026-07-29

Summary:

- Reworked `Settings > Team & access` so admins keep the existing full user/access management screen, while non-admin users get a scoped read-only access map instead of an admin-only empty state.
- Added `AdminService.getScopedTeamDirectory(actor)` to return only the products, product groups, and provisioned teammates visible through the actor's product access.
- Showed each visible product with direct/group access badges, roster-admin status for directly assigned Product Managers, and teammate role/access levels.
- Changed the non-admin Product teams section to use an in-place product dropdown, so users select one product and see that product's team table without scrolling through every product roster.
- Kept management actions admin-only on the Team & access page; Product Manager roster actions remain on `Settings > Products` for directly assigned products.
- Added regression coverage for scoped team access maps.

Files changed:

- `src/components/scoped-access-map.tsx`
- `src/services/admin.ts`
- `src/app/settings/team/page.tsx`
- `tests/admin-service.test.ts`
- `plan.md`, `summary.md`

Verification:

- `npm test -- tests/admin-service.test.ts`: passed, 7 tests.
- `npm test`: passed, 100 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.

### 2026-07-29 - Case Workflow Completeness

Date: 2026-07-29

Summary:

- Kept v1 case assignment centered on product scope plus rep ownership by making user-facing reassignment preserve the case's current department, even if a crafted form submits another department ID.
- Tightened customer reply approval decisions so unprovisioned admins cannot approve or reject replies.
- Filtered routed approval reviewers to provisioned product managers.
- Added a case-detail action for declining/dismissing suggested customer replies without sending a customer message.
- Added readable timeline entries for dismissed customer reply suggestions and recommendation workflow audit events.
- Added regression coverage for rep-only assignment, customer reply suggestion dismissal audit events, unprovisioned approval denial, recommendation message action audit events, and timeline formatting.

Files changed:

- `src/services/cases.ts`
- `src/services/case-timeline.ts`
- `src/app/cases/[caseId]/page.tsx`
- `tests/case-service.test.ts`
- `tests/case-timeline.test.ts`
- `tests/customer-recommendation-service.test.ts`
- `plan.md`, `summary.md`

Verification:

- `npm test -- tests/case-service.test.ts tests/case-timeline.test.ts tests/customer-recommendation-service.test.ts`: passed, 42 tests.
- `npm test`: passed, 99 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.

### 2026-07-29 - Authorization Hardening

Date: 2026-07-29

Summary:

- Added user-aware case creation in the case service and routed `POST /api/cases` through it, preventing crafted requests from creating cases for products outside the actor's scope.
- Tightened manual case creation so customer-service users can only create cases for products they can access directly or through product-group access.
- Updated the manual intake UI to list only product sources the current actor can create cases for.
- Hardened dashboard, settings layout, and new-case page handling for authenticated but unprovisioned users so operational data is not loaded before the access-required state is shown.
- Hardened the customer recommendations API by requiring a visible `caseId` context and verifying that the requested customer belongs to that case.
- Added regression coverage for unprovisioned API access, product-scope bypass attempts, product-group case creation, recommendation scoping, temporary-password API denial, and routed approval bypass prevention.

Files changed:

- `src/services/cases.ts`
- `src/app/api/cases/route.ts`
- `src/app/api/customers/[customerId]/recommendations/route.ts`
- `src/app/page.tsx`
- `src/app/settings/layout.tsx`
- `src/app/cases/new/page.tsx`
- `tests/api-cases-route.test.ts`
- `tests/api-customer-recommendations-route.test.ts`
- `tests/case-service.test.ts`
- `plan.md`, `summary.md`

Verification:

- `npm test -- tests/api-cases-route.test.ts tests/api-customer-recommendations-route.test.ts tests/case-service.test.ts tests/ingestion-service.test.ts tests/access-control.test.ts`: passed, 54 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.

### 2026-07-10 - Product Status Callback Webhooks

Date: 2026-07-10

Summary:

- Added outbound status callback configuration per product/source in `Settings > Products`, including callback URL and signing secret.
- Added signed callback delivery using `x-feedback-source` and `x-feedback-signature`.
- Persisted outbound callback attempts with status, response status, retry count, last error, last attempt time, and payload.
- Triggered product callbacks from case assignment and status changes.
- Added retry support for failed product callbacks.
- Extended `Settings > Operations` to show failed product callbacks alongside failed customer message deliveries.
- Added tests for signed callback delivery and retry behavior.

Files changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260710143000_integration_status_callbacks/migration.sql`
- `src/lib/integrations.ts`
- `src/repositories/integrations.ts`
- `src/services/admin.ts`, `src/services/cases.ts`
- `src/app/settings/products/page.tsx`, `src/app/settings/operations/page.tsx`
- `tests/case-service.test.ts`, `tests/ingestion-service.test.ts`

Verification:

- `npm run prisma:generate`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 75 tests.
- `npm run lint`: passed.
- `npm run prisma:migrate`: passed against local Postgres with elevated local database access.
- `npm run build`: passed.

### 2026-07-10 - Product Rosters, Messaging Delivery, and Operations

Date: 2026-07-10

Summary:

- Implemented product-scoped roster administration: Product Managers with direct access to a product can manage that product's reps, while product-group access grants visibility and assignment eligibility but not roster administration.
- Tightened case assignment so assignee options are filtered to reps who can access the case product, and the service rejects crafted assignments to users outside the product roster.
- Improved roster UX with direct vs product-group access badges, add-by-email error feedback, and a case-detail `Manage reps` link for product admins.
- Added message delivery persistence with delivery status, attempts, provider message ID, delivery error, and last attempt timestamp.
- Routed approved customer replies, automated new-case acknowledgements, and resolved/closed notifications through the messaging provider abstraction.
- Added failed customer delivery retry support and a new admin `Settings > Operations` screen to view failed deliveries and retry them.
- Added environment-backed messaging provider selection with local stub mode and generic HTTP email/SMS adapters, plus provider status cards in `Settings > Messaging`.
- Updated `.env.example` and README with messaging provider configuration.

Files changed:

- `plan.md`, `summary.md`, `README.md`, `.env.example`
- `prisma/schema.prisma`
- `prisma/migrations/20260710110000_message_delivery_status/migration.sql`
- `src/domain/types.ts`
- `src/lib/access-control.ts`, `src/lib/messaging.ts`
- `src/repositories/users.ts`, `src/repositories/messages.ts`, `src/repositories/cases.ts`
- `src/services/admin.ts`, `src/services/cases.ts`, `src/services/case-timeline.ts`
- `src/app/cases/[caseId]/page.tsx`, `src/app/cases/new/page.tsx`
- `src/app/settings/layout.tsx`, `src/app/settings/page.tsx`, `src/app/settings/products/page.tsx`, `src/app/settings/messaging/page.tsx`
- `src/app/settings/operations/page.tsx`
- `tests/access-control.test.ts`, `tests/admin-service.test.ts`, `tests/case-service.test.ts`, `tests/case-repository.test.ts`, `tests/case-timeline.test.ts`, `tests/api-cases-route.test.ts`, `tests/messaging-provider.test.ts`

Verification:

- `npm run prisma:generate`: passed.
- `npm run prisma:migrate`: passed against local Postgres with elevated local database access.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 73 tests.
- `npm run build`: passed.

Environment notes:

- Local Postgres container already existed but needed to be started directly with Docker before applying the delivery-status migration.
- Messaging defaults remain `EMAIL_PROVIDER=stub` and `SMS_PROVIDER=stub`; HTTP provider mode is available through `*_HTTP_ENDPOINT` and optional `*_HTTP_BEARER_TOKEN`.

### 2026-07-09 - UI/UX Redesign: Auth Pages, Manual Intake, and Brand Identity

Date: 2026-07-09

Summary:

- Extended the Tailwind redesign to the three remaining pages (`/login`, `/change-password`, `/cases/new`), bringing the whole app onto one consistent design system.
- Verified the redesigned manual case intake form end-to-end by submitting a real case through it and confirming it rendered correctly on the redesigned case detail page.
- Removed the last of the legacy hand-rolled CSS now that no page depends on it; `globals.css` is down to ~68 lines (Tailwind import, brand theme tokens, and a few true global resets).
- Extracted brand assets from the supplied `feedApp-logo (1).png` artwork into `public/feedapp-icon.png` (icon mark) and `public/feedapp-logo.png` (full icon+wordmark lockup), and generated `src/app/icon.png` as the app favicon (Next.js auto-detects this filename).
- Replaced the sidebar's plain "FeedApp" text wordmark and the login/change-password icon chips with the FeedApp brand mark; repositioned the IT Consortium logo as a "Powered by" attribution in the sidebar and both auth pages.

Files changed:

- `plan.md`
- `summary.md`
- `src/app/login/page.tsx`
- `src/app/change-password/page.tsx`
- `src/app/cases/new/page.tsx`
- `src/app/globals.css`
- `src/components/app-shell.tsx`
- `src/app/icon.png`
- `public/feedapp-icon.png`
- `public/feedapp-logo.png`

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 63 tests.
- `npm run build`: passed.
- Live verification against local Postgres: logged in as the seeded admin, swept every route in the app (200 OK, no errors) both authenticated and anonymous, submitted the manual case intake form live and confirmed the created case rendered correctly, and confirmed the new logo/favicon assets resolve both as static files and through `next/image` optimization.

Environment notes:

- No screenshot/browser tool is available in this environment; visual correctness was verified via rendered HTML/CSS inspection and live route smoke tests (curl against an authenticated session) rather than an actual browser screenshot.

### 2026-07-09 - UI/UX Redesign: Tailwind Migration, Dashboard, Settings, and Case Detail

Date: 2026-07-09

Summary:

- Migrated the staff-facing UI from hand-rolled CSS to Tailwind CSS v4 (the plan assumed v3; adapted to v4's CSS-first `@theme` block instead of `tailwind.config.ts`), mapping the existing IT Consortium brand tokens (navy/cyan palette, radius/shadow scale) into Tailwind's theme so the visual identity carried over.
- Added a shared UI component library at `src/components/ui/`: `PageHeader`, `StatTile` (with trend chips), pure-SVG `Donut`/`BarChart`, `Tabs`, `SegmentedNav`, `DataTable`, `Avatar`, and a zero-JS `Disclosure` (native `<details>`); rewrote `StatCard`, `StatusBadge`, `EmptyState`, and `MessagingCadenceTabs` in place.
- Redesigned the dashboard with real chart data backed by a new `CaseRepository.getCaseStats`/`CaseService.getCaseStatsForUser` aggregate query (case counts by status/priority, week-over-week new-case and resolved trends). This also fixed a real bug: the old stat tiles computed "Open/At risk/Breached" from only the current page of 10 results instead of the full scoped total.
- Rewrote `AppShell` (sidebar + mobile nav) in Tailwind with an active-pill nav style.
- Split the 661-line `/settings` page into four focused routes (`/settings` overview, `/settings/team`, `/settings/products`, `/settings/messaging`) under a shared layout with a segmented sub-nav; decomposed `AdminService.getDirectory()` into `getProductsDirectory()`/`getTeamDirectory()`/`getMessagingDirectory()` so each route only queries what it needs. Removed the dead, unreferenced `createDepartmentAction`.
- Restructured the case detail page with a clear visual hierarchy (primary case/approval/timeline content above the fold, secondary content like the internal-note composer and customer info panel behind collapsible disclosures) and wired in the customer-reply approval workflow (approve-with-edit, decline, request-review) that already existed in the service layer but was never rendered anywhere in the UI. Verified the full request → approve/decline loop end-to-end, including the resulting audit log entries.
- Reduced `globals.css` from ~1250 toward ~467 lines in this pass, and fixed a real CSS cascade bug: the custom CSS wasn't wrapped in a Tailwind `@layer`, so per CSS cascade-layer rules it was silently outranking every Tailwind utility class site-wide (e.g. heading font sizes, link colors); fixed by wrapping it in `@layer base`.

Files changed:

- `package.json`, `package-lock.json` (added `tailwindcss`, `@tailwindcss/postcss`, `tailwind-merge`)
- `postcss.config.mjs`
- `src/app/globals.css`
- `src/lib/cn.ts`, `src/lib/greeting.ts`
- `src/components/ui/page-header.tsx`, `donut-chart.tsx`, `bar-chart.tsx`, `tabs.tsx`, `segmented-nav.tsx`, `data-table.tsx`, `avatar.tsx`, `disclosure.tsx`
- `src/components/stat-card.tsx`, `status-badge.tsx`, `empty-state.tsx`, `messaging-cadence-tabs.tsx`, `app-shell.tsx`
- `src/app/page.tsx`
- `src/repositories/cases.ts`, `src/services/cases.ts`
- `src/services/admin.ts`
- `src/app/settings/layout.tsx`, `src/app/settings/page.tsx`, `src/app/settings/team/page.tsx`, `src/app/settings/products/page.tsx`, `src/app/settings/messaging/page.tsx`
- `src/app/cases/[caseId]/page.tsx`
- `tests/case-service.test.ts`

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 63 tests.
- `npm run build`: passed.
- Live verification against local Postgres: logged in as the seeded admin, exercised every touched route (dashboard, all 4 settings routes, case detail) as both admin and non-admin users, and ran the full approval loop live (request review → approve with an edited body → confirm the `case.customer_reply_sent` audit event; separately verified decline).

Environment notes:

- `npm install` resolved Tailwind CSS v4, not the v3 assumed while planning; adapted the setup to v4's `@theme`/`@import "tailwindcss"` approach rather than a `tailwind.config.ts`.
- Running `next build` while the dev server is active stales the dev server's `.next` chunks (same issue noted in earlier sessions); worked around it by stopping the dev server before production builds and restarting it clean afterward.

### 2026-07-09 - Product Intake API Case Creation

Date: 2026-07-09

Summary:

- Implemented the primary product report intake API foundation.
- `POST /api/ingestion/reports` now authenticates per-product source credentials with `x-feedback-source` and `x-feedback-secret`.
- Integration source keys now act as the product scope stored on created cases.
- Added hashed integration source secrets to the Prisma schema.
- Valid reports now match/create customers, create cases, persist integration events, and return compact case references.
- Duplicate reports using the same `sourceSystem + externalId` return the existing case instead of creating duplicates.
- Unknown or disallowed department keys are rejected.
- Seeded the demo `commerce-platform` source with `commerce-secret-123`.
- Added README sample curl request for product report submission.
- Updated `plan.md` Phase 7 progress to reflect the implemented intake foundation.

Files changed:

- `README.md`
- `plan.md`
- `summary.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260709152000_integration_source_credentials/migration.sql`
- `prisma/seed.mjs`
- `src/app/api/ingestion/reports/route.ts`
- `src/lib/integrations.ts`
- `src/repositories/cases.ts`
- `src/repositories/integrations.ts`
- `src/services/cases.ts`
- `src/services/ingestion.ts`
- `tests/api-ingestion-route.test.ts`
- `tests/case-service.test.ts`
- `tests/ingestion-service.test.ts`

Verification:

- `npm run prisma:generate`: passed.
- `npm run typecheck`: passed.
- `npx vitest run tests/ingestion-service.test.ts tests/api-ingestion-route.test.ts`: passed, 9 tests.
- `npm run lint`: passed.
- `npm run prisma:migrate`: passed with elevated local database access.
- `npm run prisma:seed`: passed.
- `npm run db:verify`: passed.

### 2026-07-09 - First Login Password Activation UX

Date: 2026-07-09

Summary:

- Tightened temporary-password enforcement for newly added reps.
- Protected case APIs now return `403 Password change required` when a logged-in user still has `passwordMustChange`.
- Prevented users from reusing their temporary password as the new password.
- Polished the change-password page into a first-sign-in account activation flow when a temporary password is active.
- Added a Settings hint that new reps must replace temporary passwords on first sign-in.

Files changed:

- `summary.md`
- `src/app/api/cases/route.ts`
- `src/app/change-password/page.tsx`
- `src/app/globals.css`
- `src/app/settings/page.tsx`
- `src/services/auth.ts`
- `tests/api-cases-route.test.ts`
- `tests/auth-service.test.ts`

Verification:

- `npm run typecheck`: passed.
- `npx vitest run tests/auth-service.test.ts tests/api-cases-route.test.ts`: passed, 10 tests.

### 2026-07-09 - Email Password Auth and Role-Aware Settings

Date: 2026-07-09

Summary:

- Replaced the `?userId=` development user selector with first-party email/password authentication.
- Added secure database-backed sessions using the `feedback_session` HTTP-only cookie.
- Added login, logout, and change-password flows.
- Added password hashing with Argon2 and temporary-password enforcement for admin-created users.
- Made SSO subject optional so the app remains SSO-ready later without depending on company IT for v1.
- Added `UserSession`, password fields, and last-login tracking to the Prisma schema and migration.
- Converted the visible Admin tab into role-aware Settings.
- Moved Settings to the bottom of the sidebar with the settings icon.
- Settings is visible to all logged-in users; all users can view profile/password controls, while admin sections are shown only to Admin users.
- Updated `/api/cases` to use the logged-in session user instead of `userId` query parameters.
- Kept webhook ingestion signature-based for machine-to-machine access.

Files changed:

- `README.md`
- `package.json`
- `package-lock.json`
- `plan.md`
- `summary.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260709143000_email_password_auth/migration.sql`
- `prisma/seed.mjs`
- `src/app/actions/auth.ts`
- `src/app/admin/page.tsx`
- `src/app/api/cases/route.ts`
- `src/app/cases/[caseId]/page.tsx`
- `src/app/cases/new/page.tsx`
- `src/app/change-password/page.tsx`
- `src/app/globals.css`
- `src/app/login/page.tsx`
- `src/app/page.tsx`
- `src/app/settings/page.tsx`
- `src/components/app-shell.tsx`
- `src/components/messaging-cadence-tabs.tsx`
- `src/domain/types.ts`
- `src/lib/current-user.ts`
- `src/lib/session-cookie.ts`
- `src/repositories/users.ts`
- `src/services/admin.ts`
- `src/services/auth.ts`
- `tests/admin-service.test.ts`
- `tests/api-cases-route.test.ts`
- `tests/auth-service.test.ts`

Verification:

- `npm install argon2`: passed with elevated network access.
- `npm run prisma:generate`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 52 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run prisma:migrate`: passed with elevated local database access.
- `npm run prisma:seed`: passed.
- `npm run db:verify`: passed.
- `curl -I 'http://localhost:3001/'`: returned `307` to `/login` without a session.
- `curl -I 'http://localhost:3001/login'`: returned `200 OK`.
- Authenticated cookie checks for `/`, `/settings`, and `/api/cases`: returned `200 OK`.
- Unauthenticated `curl -I 'http://localhost:3001/api/cases'`: returned `401 Unauthorized`.

Environment notes:

- Demo users now sign in with password `Password123!`; local admin email is `admin@example.com`.
- Fresh dev server is running on `http://localhost:3001` because port 3000 was already occupied.

### 2026-07-09 - Agent UX Guidance

Date: 2026-07-09

Summary:

- Added project agent guidance for future development sessions.
- Documented that staff UX is part of the platform's architecture quality bar.
- Added SSR/client-interaction tradeoff guidance so future UI work preserves context, scroll position, filters, tabs, and in-progress workflow state.
- Added customer-centric workflow guidance for timeline semantics and suggested customer messaging.
- Added the same UX principle to the living architecture principles in `plan.md`.

Files changed:

- `AGENTS.md`
- `plan.md`
- `summary.md`

Verification:

- Documentation-only change; no test run required.

Summary:

- Cleaned up the admin customer update cadence UI.
- Replaced the full repeated status/priority cadence table with priority badge filters.
- The admin page now defaults to `Low` cadence and shows only the status rows for the selected priority.
- Added badge-style filters for `Low`, `Medium`, `High`, and `Critical`.
- Preserved the selected priority after saving a cadence row.

Files changed:

- `summary.md`
- `src/app/admin/page.tsx`
- `src/app/globals.css`

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 48 tests.
- `npm run build`: passed.
- `curl -I 'http://localhost:3000/admin?userId=user-admin&cadencePriority=Low'`: returned `200 OK` after restarting the dev server.

Environment notes:

- Running `next build` while the dev server is active can stale the dev server's `.next` chunks. Restarting `npm run dev` fixed the local route check.
- Fresh dev server is running on `http://localhost:3000`.

### 2026-07-09 - Stage-Aware Messaging Cadence

Date: 2026-07-09

Summary:

- Implemented stage-aware customer messaging cadence.
- Added `CaseStage` tracking so each case status entry has its own customer-update state.
- Added `MessagingCadencePolicy` configuration by status and priority, with seeded defaults.
- Backfilled active stages for existing cases in the migration.
- Updated case creation and status transitions to create/advance stages.
- Updated customer reply sending to mark the active stage as updated and suppress duplicate suggestions.
- Added stale follow-up eligibility after the configured interval and follow-up copy for long-running stages.
- Added admin cadence controls on the admin page.
- Added dashboard operations queue prompts for stale customer updates in the current user's scoped cases.
- Kept pending suggestions out of the activity timeline; sent customer messages remain the timeline event.

Files changed:

- `plan.md`
- `summary.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260709130000_case_stage_messaging_cadence/migration.sql`
- `prisma/seed.mjs`
- `prisma/verify-seed.mjs`
- `src/app/admin/page.tsx`
- `src/app/cases/[caseId]/page.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/lib/messaging-cadence.ts`
- `src/repositories/case-stages.ts`
- `src/repositories/messaging-cadence.ts`
- `src/services/admin.ts`
- `src/services/cases.ts`
- `src/services/customer-reply-suggestions.ts`
- `tests/admin-service.test.ts`
- `tests/case-service.test.ts`

Verification:

- `npm run prisma:generate`: passed.
- `npx vitest run tests/case-service.test.ts tests/admin-service.test.ts tests/case-timeline.test.ts`: passed, 27 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 48 tests.
- `npm run prisma:migrate`: passed with elevated local database access.
- `npm run db:verify`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `curl -I http://localhost:3001/`: returned `200 OK`.
- `curl -I 'http://localhost:3001/cases/case-1001?userId=user-cs-1'`: returned `200 OK`.
- `curl -I 'http://localhost:3001/admin?userId=user-admin'`: returned `200 OK`.

Environment notes:

- The local database is in sync with the case-stage and messaging-cadence migration.
- A prior dev server still had port 3000; the fresh dev server is running on `http://localhost:3001`.

### 2026-07-09 - Direct Suggested Reply Sending

Date: 2026-07-09

Summary:

- Simplified the suggested customer reply flow.
- Removed the separate customer reply review panel from the case detail page.
- Changed the suggested reply action from "Save for review" to "Send to customer".
- Added a direct service path that sends the edited suggestion, records the approved outbound message, and writes a `case.customer_reply_sent` audit event with the rep as actor.
- Removed unused review-panel validation and CSS.
- Added service test coverage for direct suggested reply sending.

Files changed:

- `summary.md`
- `src/app/cases/[caseId]/page.tsx`
- `src/app/globals.css`
- `src/lib/validation.ts`
- `src/services/cases.ts`
- `tests/case-service.test.ts`

Verification:

- `npm run typecheck`: passed.
- `npx vitest run tests/case-service.test.ts tests/case-timeline.test.ts`: passed, 21 tests.
- `npm test`: passed, 45 tests.
- `npm run lint`: passed.
- `npm run build`: passed.

### 2026-07-09 - Activity Timeline Reply Events

Date: 2026-07-09

Summary:

- Corrected the activity timeline semantics for customer reply suggestions.
- Removed pending suggested Email/SMS reply records from the activity timeline.
- Kept pending suggestions in the customer reply review panel only.
- Changed sent customer reply timeline events to show the reviewed message body and the staff member who sent it.
- Suppressed duplicate outbound message timeline entries when a sent-reply audit event already represents the same message.
- Kept automated outbound messages without a staff audit visible as system-sent messages.

Files changed:

- `summary.md`
- `src/services/case-timeline.ts`
- `src/services/cases.ts`
- `tests/case-timeline.test.ts`

Verification:

- `npx vitest run tests/case-timeline.test.ts tests/case-service.test.ts`: passed, 20 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 44 tests.
- `npm run lint`: passed.
- `npm run build`: passed.

### 2026-07-09 - Customer Reply Review Semantics

Date: 2026-07-09

Summary:

- Corrected the customer reply review workflow semantics.
- Changed customer reply review permissions so any provisioned user with access to the case can review, edit, send, or decline a suggested reply.
- Added deterministic system-suggested customer reply text based on case title, status, department, and customer name.
- Updated the case detail page copy from admin-style approval language to case-team review language.
- Added an edit-before-send textarea for pending suggested replies.
- Improved activity timeline wording so suggested replies, reviewed sends, declined suggestions, and outbound customer messages are easier to distinguish.
- Updated dashboard queue copy and tests to match the corrected workflow.

Files changed:

- `plan.md`
- `summary.md`
- `src/app/cases/[caseId]/page.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/lib/access-control.ts`
- `src/lib/validation.ts`
- `src/repositories/messages.ts`
- `src/services/case-timeline.ts`
- `src/services/cases.ts`
- `src/services/customer-reply-suggestions.ts`
- `tests/access-control.test.ts`
- `tests/case-service.test.ts`
- `tests/case-timeline.test.ts`

Verification:

- `npm run typecheck`: passed.
- `npx vitest run tests/access-control.test.ts tests/case-service.test.ts tests/case-timeline.test.ts`: passed, 26 tests.
- `npm test`: passed, 44 tests.
- `npm run lint`: passed.
- `npm run build`: passed.

### 2026-07-09 - Customer Messaging Approval Foundation

Date: 2026-07-09

Summary:

- Started the customer messaging and approval workflow.
- Added a persisted `channel` field to approval requests so customer reply approvals can distinguish Email and SMS.
- Added repository/service methods for customer reply approval requests, approval decisions, rejection decisions, and approved outbound message recording.
- Added authorization for customer reply drafts and approval decisions.
- Added case detail UI for drafting customer replies and requesting approval.
- Added inline approve/reject actions for pending approval requests.
- Extended the case activity timeline with reply approval requested/approved/rejected events.
- Added service tests for approval requests, permission denial, approval decisions, and approved outbound message creation.

Files changed:

- `plan.md`
- `summary.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260709120000_approval_channels/migration.sql`
- `src/app/cases/[caseId]/page.tsx`
- `src/app/globals.css`
- `src/lib/access-control.ts`
- `src/lib/validation.ts`
- `src/repositories/cases.ts`
- `src/repositories/messages.ts`
- `src/services/case-timeline.ts`
- `src/services/cases.ts`
- `tests/case-service.test.ts`
- `tests/case-timeline.test.ts`

Verification:

- `npm run prisma:generate`: passed.
- `npx vitest run tests/case-service.test.ts tests/case-timeline.test.ts`: passed, 19 tests.
- `npm run prisma:migrate`: passed after starting/using the local Docker Postgres container with elevated Docker access.
- `npm test`: passed, 42 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run db:verify`: passed.
- `npm run build`: passed.

Environment notes:

- The local database is in sync with the approval-channel migration.
- Docker had an existing `feedback-hub-postgres` container; it was healthy and used for migration/verification.

### 2026-07-07 - Schema Hardening

Summary:

- Added missing database indexes for common case filters, joins, and related records.
- Made referential actions explicit in Prisma for role assignments, department memberships, cases, messages, approvals, SLA policies, integration events, and audit logs.
- Added cascade cleanup for join tables and case-owned records where appropriate.
- Kept case ownership relations protected or history-preserving: customer/department deletes remain restricted, while nullable user/case history links are set null.
- Added and applied the schema hardening migration.

Files changed:

- `plan.md`
- `summary.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260707170500_schema_hardening_indexes_referential_actions/migration.sql`

Verification:

- `npx prisma validate`: passed.
- `npm run prisma:migrate -- --name schema_hardening_indexes_referential_actions`: passed.
- `npm run db:verify`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 38 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run typecheck`: passed again after build.

Environment notes:

- The local database is in sync with the schema hardening migration.

### 2026-07-07 - Customer Uniqueness and Race Safety

Summary:

- Added unique customer identifiers for `externalId`, `email`, and `phone`.
- Added a Prisma migration for the customer uniqueness constraints.
- Made `findOrCreateCustomer` normalize identifiers before lookup/create.
- Made `findOrCreateCustomer` race-safe by catching Prisma `P2002` unique conflicts, re-querying, and returning the customer created by the competing request.
- Added repository tests for identifier reuse, normalization, normal creation, and unique-conflict retry behavior.

Files changed:

- `plan.md`
- `summary.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260707165000_customer_unique_identifiers/migration.sql`
- `src/repositories/customers.ts`
- `tests/customer-repository.test.ts`

Verification:

- `npm run prisma:migrate -- --name customer_unique_identifiers`: passed.
- `npm run db:verify`: passed.
- `npm run typecheck`: passed.
- `npx vitest run tests/customer-repository.test.ts tests/case-service.test.ts`: passed, 16 tests.
- `npm test`: passed, 38 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run typecheck`: passed again after build.

Environment notes:

- The local database is in sync with the new migration.

### 2026-07-07 - Paginated Case Lists

Summary:

- Added paginated case listing through the repository, service, dashboard, and `/api/cases`.
- Added database-level visibility scoping for paginated case reads so role, department, and assignment constraints are applied in Prisma queries instead of after fetching.
- Added dashboard previous/next pagination controls that preserve filters and the selected current user.
- Updated `/api/cases` to accept `page` and `pageSize` query params and return pagination metadata.
- Added tests for repository `skip`/`take`, user visibility scoping, service forwarding, and API pagination output.

Files changed:

- `plan.md`
- `summary.md`
- `src/app/api/cases/route.ts`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/repositories/cases.ts`
- `src/services/cases.ts`
- `tests/api-cases-route.test.ts`
- `tests/case-repository.test.ts`
- `tests/case-service.test.ts`

Verification:

- `npm run typecheck`: passed.
- `npx vitest run tests/case-repository.test.ts tests/case-service.test.ts tests/api-cases-route.test.ts`: passed, 18 tests.
- `npm test`: passed, 34 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run typecheck`: passed again after build.

Environment notes:

- Dashboard stats still summarize the currently loaded page; a later dashboard metrics query can make them global totals if needed.

### 2026-07-07 - API Authorization and Case Filter Fix

Summary:

- Fixed the case repository query bug where combining free-text search with the `on-track` SLA filter could over-match by OR-ing the search group with SLA state.
- Changed case filtering composition so search and SLA state filters are separate `AND` groups.
- Added strict API current-user resolution for `/api/cases`; API requests no longer fall back to the default admin user when `userId` is missing or invalid.
- Guarded `GET /api/cases` with provisioned-user access and scoped case visibility.
- Guarded `POST /api/cases` so only users with case creation permission can create cases, and writes use the resolved user as the audit actor.
- Added regression tests for the repository filter composition and `/api/cases` authorization behavior.

Files changed:

- `plan.md`
- `summary.md`
- `src/app/api/cases/route.ts`
- `src/lib/current-user.ts`
- `src/repositories/cases.ts`
- `tests/api-cases-route.test.ts`
- `tests/case-repository.test.ts`

Verification:

- `npx vitest run tests/case-repository.test.ts tests/api-cases-route.test.ts`: passed, 5 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 31 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run typecheck`: passed again after build.

Environment notes:

- Broader API hardening still remains for non-case endpoints.

### 2026-07-07 - Local Authorization Slice

Summary:

- Added a local current-user authorization model driven by `?userId=...`.
- Added role and provisioning checks for dashboard visibility, manual case intake, case detail actions, and admin management.
- Added service-level authorization methods for listing cases, loading case details, creating manual cases, assigning cases, adding notes, and status transitions.
- Added a topbar user switcher for testing Admin, Customer Service, Product Manager, and Department User permissions.
- Tightened user role mapping from Prisma data into the domain role union.
- Added access-control and case-service tests for denied creation, allowed creation, and unauthorized transitions.

Files changed:

- `plan.md`
- `summary.md`
- `src/app/admin/page.tsx`
- `src/app/cases/[caseId]/page.tsx`
- `src/app/cases/new/page.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/lib/access-control.ts`
- `src/lib/current-user.ts`
- `src/repositories/users.ts`
- `src/services/cases.ts`
- `tests/access-control.test.ts`
- `tests/case-service.test.ts`

Verification:

- `npm run typecheck`: passed.
- `npm test`: passed, 26 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run typecheck`: passed again after build.

Environment notes:

- Real SSO is still pending; the current selector is a development substitute for exercising role and provisioning behavior.

### 2026-07-07 - Unified Case Timeline

Summary:

- Added a unified case activity timeline builder.
- Combined audit events, internal notes/messages, and approvals into one newest-first activity feed.
- Replaced separate main message/audit sections on case detail with a single activity timeline.
- Kept internal note entry as a separate focused composer.
- Added tests for timeline ordering and readable audit formatting.

Files changed:

- `plan.md`
- `summary.md`
- `src/app/cases/[caseId]/page.tsx`
- `src/app/globals.css`
- `src/services/case-timeline.ts`
- `tests/case-timeline.test.ts`

Verification:

- `npm test`: passed, 21 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `curl -I http://localhost:3000/cases/case-1001`: returned `200 OK`.
- `curl -I http://localhost:3000/`: returned `200 OK`.

Environment notes:

- The dev server is running at `http://localhost:3000`.

### 2026-07-07 - Dashboard Case Filters

Summary:

- Added database-backed dashboard filters for status, priority, department, assignee, source system, SLA state, and text search.
- Stored dashboard filters in URL query parameters so filtered views are shareable and refresh-safe.
- Added a compact filter panel with apply and reset actions.
- Updated the case repository/service to filter in Postgres.
- Added service test coverage for forwarding case list filters.

Files changed:

- `plan.md`
- `summary.md`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/repositories/cases.ts`
- `src/services/cases.ts`
- `tests/case-service.test.ts`

Verification:

- `npm test`: passed, 19 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `curl -I http://localhost:3000/`: returned `200 OK`.
- `curl -I 'http://localhost:3000/?status=Assigned&priority=Medium'`: returned `200 OK`.
- `curl -I 'http://localhost:3000/?search=checkout&slaState=at-risk'`: returned `200 OK`.

Environment notes:

- The dev server is running at `http://localhost:3000`.

### 2026-07-07 - Admin Management Slice

Summary:

- Added an initial admin management page at `/admin`.
- Added department listing and department creation.
- Added rep/user listing and provisioned user creation.
- Added role and department assignment controls for new reps.
- Added access update controls for changing an existing user's provisioned state, roles, and departments.
- Added admin audit events for department creation, user creation, and user access updates.
- Linked the dashboard sidebar to the admin page.
- Added admin service tests.

Files changed:

- `plan.md`
- `summary.md`
- `src/app/admin/page.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/services/admin.ts`
- `tests/admin-service.test.ts`

Verification:

- `npm test`: passed, 18 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run typecheck`: passed.
- `curl -I http://localhost:3000/admin`: returned `200 OK`.
- `curl -I http://localhost:3000`: returned `200 OK`.

Environment notes:

- The dev server is running at `http://localhost:3000`.

### 2026-07-07 - Manual Intake and Internal Notes

Summary:

- Added manual case intake at `/cases/new`.
- Wired the dashboard `New case` action to the manual intake page.
- Added customer find-or-create repository support for manual intake.
- Added internal note storage using `Message` records with the `INTERNAL_NOTE` channel.
- Added an internal note composer to the case detail page.
- Extended case service tests for manual case creation and internal note audit logging.

Files changed:

- `plan.md`
- `summary.md`
- `src/app/cases/[caseId]/page.tsx`
- `src/app/cases/new/page.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/lib/validation.ts`
- `src/repositories/customers.ts`
- `src/repositories/messages.ts`
- `src/services/cases.ts`
- `tests/case-service.test.ts`

Verification:

- `npm test`: passed, 15 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `curl -I http://localhost:3000`: returned `200 OK`.
- `curl -I http://localhost:3000/cases/new`: returned `200 OK`.
- `curl -I http://localhost:3000/cases/case-1001`: returned `200 OK`.

Environment notes:

- The dev server is running at `http://localhost:3000`.
- `npm run typecheck` was rerun after `npm run build` because running both in parallel caused `.next/types` to be regenerated mid-check.

### 2026-07-07 - Case Detail Workflow Slice

Summary:

- Added a database-backed case detail page at `/cases/[caseId]`.
- Linked dashboard case IDs to their detail pages.
- Extended the case repository and service with full case detail loading.
- Added provisioned-user lookup for assignment controls.
- Added server-backed workflow forms for valid status transitions and assignment changes.
- Added customer, messages, approvals, and audit timeline sections on the case detail page.
- Added tests for valid transitions and case detail loading.
- Updated `plan.md` to mark Phase 4 case workflow work in progress.

Files changed:

- `plan.md`
- `summary.md`
- `src/app/cases/[caseId]/page.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/repositories/cases.ts`
- `src/repositories/users.ts`
- `src/services/cases.ts`
- `tests/case-service.test.ts`

Verification:

- `npm test`: passed, 13 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `curl -I http://localhost:3000`: returned `200 OK`.
- `curl -I http://localhost:3000/cases/case-1001`: returned `200 OK`.

Environment notes:

- The dev server had to be restarted after `next build` because the prior dev process was holding a mixed `.next` state on port `3000`.
- The dev server is running at `http://localhost:3000`.

### 2026-07-07 - Persistence Slice and Brand Styling

Summary:

- Added Prisma-backed repository modules for cases, departments, SLA policies, and audit logs.
- Added a case service for listing cases, creating cases with SLA deadlines, status transitions, assignment, and audit events.
- Replaced the `/api/cases` stub implementation with the case service.
- Replaced dashboard mock data usage with database-backed case and department queries.
- Updated the dashboard visual design to use IT Consortium-style blue, white, and bright-blue accent colors.
- Added service-layer tests for case creation, invalid transitions, assignment, and audit logging.
- Updated `plan.md` to reflect partial Phase 2 persistence progress.

Files changed:

- `plan.md`
- `summary.md`
- `src/app/api/cases/route.ts`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/lib/domain-mappers.ts`
- `src/repositories/audit-logs.ts`
- `src/repositories/cases.ts`
- `src/repositories/departments.ts`
- `src/repositories/sla-policies.ts`
- `src/services/cases.ts`
- `tests/case-service.test.ts`

Verification:

- `npm test`: passed, 11 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run prisma:migrate`: passed, schema already in sync.
- `npm run prisma:seed`: passed.
- `npm run db:verify`: passed.

Environment notes:

- Docker access required elevated permissions from the sandbox.
- The first sandboxed database verification could not reach `localhost:5432`; elevated execution verified the local Postgres container and seeded data successfully.

### 2026-07-07 - Local Postgres Migration and Seed Setup

Work completed:

- Started local Postgres through Docker Compose.
- Applied the initial Prisma migration to local Postgres.
- Ran the seed script successfully.
- Added and ran `db:verify` to confirm baseline seed counts.
- Updated README setup instructions.
- Updated `plan.md` to mark live database setup acceptance criteria complete.
- Updated `summary.md` with this session.

Files changed:

- `.env`
- `README.md`
- `docker-compose.yml`
- `package.json`
- `plan.md`
- `prisma/verify-seed.mjs`
- `prisma/migrations/20260707112000_init/migration.sql`
- `prisma/migrations/migration_lock.toml`
- `prisma/schema.prisma`
- `prisma/seed.mjs`
- `summary.md`

Verification:

- `npm run db:up`: passed.
- `npm run prisma:migrate`: passed.
- `npm run prisma:seed`: passed.
- `npm run db:verify`: passed.
- `npm test`: passed, 8 tests.
- `npm run typecheck`: passed.
- `node --check prisma/verify-seed.mjs`: passed.

## Session Log

### 2026-07-07 - Product Planning

Work completed:

- Defined the system as a centralized internal feedback and resolution platform.
- Confirmed customer service receives reports and owns opening, closing, and reopening cases.
- Confirmed product managers coordinate and escalate cases.
- Confirmed departments should only see their assigned cases.
- Confirmed replies to customers require approval before sending.
- Confirmed automated acknowledgement and resolved/closed notifications are allowed.
- Confirmed customer communication can use email or SMS depending on available customer information.
- Confirmed the platform should consume recommendations from the existing customer analytics system.
- Confirmed recommendations should be staff-visible and approval-gated before customer communication.
- Confirmed v1 should not include a customer portal.
- Confirmed external systems should integrate through push APIs/webhooks and scheduled pull connectors.
- Confirmed MCP should be positioned as a later controlled tool layer, not the v1 integration backbone.

Decisions made:

- Use company SSO for authentication.
- Do not allow all company employees into the app by default.
- Require explicit app provisioning or approved identity-provider group membership.
- Use department and case scoping for access control.
- Use department-plus-priority SLA rules.
- Use provider adapters for email/SMS.

### 2026-07-07 - Architecture Planning

Work completed:

- Drafted a production-grade architecture direction.
- Chose cloud managed services as the production assumption.
- Chose medium-enterprise scale as the initial production target.
- Chose single-company tenancy with departments and scoped access.
- Chose modular monolith architecture for v1.

Decisions made:

- Use managed Postgres as the system of record.
- Use background workers for imports, SLA checks, escalations, and notifications.
- Use object storage for raw payloads, attachments, imports, exports, and files.
- Use centralized logs, metrics, traces, and error reporting.
- Add MCP later on top of application services and authorization checks.

### 2026-07-07 - Initial Implementation Foundation

Work completed:

- Scaffolded a Next.js/React application.
- Added TypeScript configuration.
- Added ESLint configuration.
- Added Vitest configuration.
- Added package scripts for dev, build, lint, typecheck, test, and Prisma generation.
- Added `.env.example`.
- Added `.gitignore`.
- Added README.
- Added internal dashboard UI.
- Added domain constants and types.
- Added access-control utility functions.
- Added workflow transition utility functions.
- Added SLA utility functions.
- Added validation schemas.
- Added integration signature and idempotency helpers.
- Added messaging provider interface and stub provider.
- Added analytics client interface and stub client.
- Added health-check API route.
- Added cases API route foundation.
- Added ingestion API route foundation.
- Added customer recommendations API route foundation.
- Added Prisma schema for the planned production data model.
- Added unit tests for access control, SLA, and workflow rules.
- Installed project dependencies.
- Generated Prisma client.
- Started the dev server.

Files created or changed:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `next-env.d.ts`
- `next.config.mjs`
- `.eslintrc.json`
- `.env.example`
- `.gitignore`
- `README.md`
- `vitest.config.ts`
- `prisma/schema.prisma`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/app/api/health/route.ts`
- `src/app/api/cases/route.ts`
- `src/app/api/ingestion/reports/route.ts`
- `src/app/api/customers/[customerId]/recommendations/route.ts`
- `src/domain/constants.ts`
- `src/domain/types.ts`
- `src/lib/access-control.ts`
- `src/lib/workflow.ts`
- `src/lib/sla.ts`
- `src/lib/validation.ts`
- `src/lib/mock-data.ts`
- `src/lib/db.ts`
- `src/lib/integrations.ts`
- `src/lib/messaging.ts`
- `src/lib/analytics.ts`
- `tests/access-control.test.ts`
- `tests/sla.test.ts`
- `tests/workflow.test.ts`

Verification:

- `npm test`: passed, 8 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run prisma:generate`: passed after network escalation.

Environment notes:

- Node version was `v22.11.0`.
- One dependency warned that it prefers Node `22.13.0+`.
- The warning did not block dependency installation, tests, lint, typecheck, Prisma generation, or build.
- The first dev server attempt was blocked from binding to port `3000` by sandbox restrictions.
- The dev server started successfully after escalation at `http://localhost:3000`.

### 2026-07-07 - Documentation Tracker Setup

Work completed:

- Replaced the high-level `plan.md` with a detailed phase-based roadmap.
- Added status legend and phase tracker.
- Added task lists for phases 0 through 13.
- Added acceptance criteria under each phase.
- Added testing strategy, current known gaps, and decision log.
- Created this `summary.md` file as the project session log.

Files changed:

- `plan.md`
- `summary.md`

Verification:

- Documentation was reviewed after writing.
- No code behavior changed.

### 2026-07-07 - Local Postgres Migration and Seed Setup

Work completed:

- Added `docker-compose.yml` for local Postgres.
- Added local `.env` values for `DATABASE_URL` and existing stub providers.
- Added package scripts for database startup, migration, reset, setup, and seeding.
- Added Prisma seed metadata so `prisma migrate reset` can run the seed script.
- Created the first migration from the current Prisma schema.
- Added `migration_lock.toml` for the Prisma migrations directory.
- Added `prisma/seed.mjs` with demo roles, departments, users, department memberships, SLA policies, customers, cases, an integration source, a message, an approval, and an audit log entry.
- Updated README local setup instructions.
- Updated `plan.md` task statuses for local database setup.

Files changed:

- `.env`
- `README.md`
- `docker-compose.yml`
- `package.json`
- `plan.md`
- `prisma/migrations/20260707112000_init/migration.sql`
- `prisma/migrations/migration_lock.toml`
- `prisma/schema.prisma`
- `prisma/seed.mjs`
- `summary.md`

Verification:

- `npx prisma validate`: passed.
- `node --check prisma/seed.mjs`: passed.
- `npm test`: passed, 8 tests.
- `npm run typecheck`: passed.
- `npm run db:up`: initially blocked because the Docker daemon was not running; resolved in the later live verification session.

Environment notes:

- Docker CLI is installed.
- Docker Desktop is now running.
- Local Postgres is running in the `feedback-hub-postgres` container.
- Seed verification confirmed the baseline records exist.

### 2026-07-07 - Live Database Migration and Seed Verification

Work completed:

- Started the local Postgres container with Docker Compose.
- Applied the initial Prisma migration to `feedback_hub`.
- Ran the seed script against local Postgres.
- Added `prisma/verify-seed.mjs`.
- Added the `npm run db:verify` script.
- Verified seeded record counts for roles, departments, users, customers, cases, SLA policies, integration sources, messages, approvals, and audit logs.
- Updated README setup steps.
- Updated `plan.md` and `summary.md` to remove the Docker-daemon blocker.

Files changed:

- `README.md`
- `package.json`
- `plan.md`
- `prisma/verify-seed.mjs`
- `summary.md`

Verification:

- `npm run db:up`: passed.
- `npm run prisma:migrate`: passed.
- `npm run prisma:seed`: passed.
- `npm run db:verify`: passed.
- `node --check prisma/verify-seed.mjs`: passed.
- `npm test`: passed, 8 tests.
- `npm run typecheck`: passed.

## Decisions Made

- 2026-07-09: Product/integration sources are now the primary tenant/data scope.
- 2026-07-09: Product groups/domains are admin-managed bundles for granting users access to multiple product sources.
- 2026-07-09: Departments remain only as a legacy internal routing field until a later cleanup removes the dependency.
- The system is an internal case operations hub, not a customer portal in v1.
- Customer service owns case opening, closing, and reopening.
- Product managers coordinate and escalate cases.
- Departments only see assigned department cases.
- Company SSO authenticates users, but app access requires explicit provisioning or approved groups.
- The platform uses roles, department scopes, and case assignments for authorization.
- REST APIs, webhooks, and scheduled pull connectors are the v1 integration model.
- MCP is deferred until the core workflow and APIs are stable.
- Customer analytics remains external; this platform consumes recommendations from it.
- Product recommendations are staff-visible and approval-gated.
- SLA rules are configured by department and priority.
- The first architecture is a modular monolith backed by Postgres.

## Verification History

Latest FeedApp product-scope cleanup:

- Date: 2026-07-09
- Renamed the visible platform and package metadata to `FeedApp`.
- Replaced dashboard department filtering/table labels with product and product-group filters.
- Updated manual case intake to select a product source instead of a department.
- Hid the legacy department routing field from case assignment UI.
- Renamed the visible `Department User` role to `Product User`.
- Reseeded the local database so role/product data reflects the new naming.

Latest full verification:

- Date: 2026-07-09
- `npm run prisma:generate`: passed.
- `npx prisma migrate status`: passed.
- `npm run prisma:seed`: passed.
- `npm run db:verify`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 63 tests.
- `npm run build`: passed.
- Live `POST /api/ingestion/reports` without `departmentKey`: passed.

Latest full verification:

- Date: 2026-07-07
- `npm test`: passed, 8 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run prisma:generate`: passed.

Latest database setup verification:

- Date: 2026-07-07
- `npm run db:up`: passed.
- `npm run prisma:migrate`: passed.
- `npm run prisma:seed`: passed.
- `npm run db:verify`: passed.
- `node --check prisma/verify-seed.mjs`: passed.
- `npm test`: passed, 8 tests.
- `npm run typecheck`: passed.

Documentation-only verification:

- Date: 2026-07-07
- `plan.md` updated with phase tracker and tasks.
- `summary.md` created with session log.
- No application code changed.

## Open Questions

- Which company SSO provider and protocol will be used: OIDC, SAML, Azure AD, Google Workspace, Okta, or another provider?
- Which cloud platform will host production: AWS, Azure, GCP, or another managed platform?
- Which email/SMS providers should be used first?
- What exact API contract does the existing customer analytics system expose?
- Which product system should be the first real ingestion integration?
- Should SLA timers count calendar hours or business hours?
- Which users should be initial admins and pilot users?

## Next Recommended Work

1. Implement SLA/escalation automation: product/priority SLA policy management, response/resolution deadlines, at-risk/breached detection, escalation events, and dashboard visibility.
2. Move asynchronous work out of the request path: add a queue/worker foundation for customer messaging, product callbacks, retries, and dead-letter handling.
3. Build product-scoped embedded monitoring: read-only dashboard route, short-lived signed embed tokens, and source-scoped authorization.
4. Harden production operations: CI checks, structured logging, request IDs, provider-specific email/SMS setup, secure secret storage, and deployment configuration.
