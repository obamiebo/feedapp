# Agentic Feedback Bot Integration Plan

## Summary

Build a FeedApp-owned first-response bot that uses the existing `itc-agent-framework` for orchestration and the existing EC2-hosted `document-service` for product knowledge indexing/search. FeedApp remains the system of record for products, cases, permissions, approvals, messages, and audit logs.

Default v1 behavior: draft-only. The bot generates customer reply drafts and internal rationale, then FeedApp routes them through the existing approval flow. No automatic customer sending in v1.

## Phase 1: Foundation And Configuration

- Add FeedApp environment configuration:
  - `DOCUMENT_SERVICE_URL`, defaulting per environment.
  - `DOCUMENT_SERVICE_API_KEY` for FeedApp-to-document-service calls.
  - `CHAT_MANAGEMENT_API_URL`.
  - `CHAT_MANAGEMENT_APP_KEY`.
  - `FEEDBACK_AGENT_ENABLED=false` feature flag.
- Confirm EC2 network routing:
  - `document-service` host port is expected to be `8006`.
  - `chat-management` host port is expected to be `8008`.
  - Prefer private EC2/internal Docker network URLs where possible; do not hardcode EC2 URLs in source.
- Register FeedApp as an application in `chat-management`:
  - Use `X-App-Key` to identify FeedApp.
  - Use a FeedApp verification endpoint or service-issued JWT so chat-management can authenticate bot/user context.
- Add operational documentation for local, test-prod, and production env wiring.

## Phase 2: Product Knowledge Storage In FeedApp

- Add FeedApp metadata for product knowledge documents:
  - Store product source, document-service document ID, title, document type, processing status, upload actor, and timestamps.
  - Scope every document to an existing `IntegrationSource`.
- Add document types:
  - `faq`
  - `manual`
  - `troubleshooting`
  - `release_note`
  - `policy`
- Add admin/product-manager UI under product settings:
  - Upload file.
  - Paste text.
  - Select document type.
  - View processing status.
  - Delete/reindex document.
- Enforce existing product permissions:
  - Admin can manage all product knowledge.
  - Product Manager can manage directly assigned product sources.
  - Product User can view/search only through permitted bot flows, not manage documents.

## Phase 3: Adapt document-service For Product Knowledge

- Reuse the existing EC2-hosted `document-service`; do not copy it into FeedApp.
- Add/confirm document-service support for:
  - `project_id` as the product scope, using `IntegrationSource.key`.
  - `document_type` filtering.
  - file upload, text upload, processing status, delete, and search.
- Extend `/documents/search` to accept `project_id`.
- Add service-to-service auth:
  - Accept `X-Service-Key` or equivalent configured API key for FeedApp backend calls.
  - Keep JWT auth support for existing agent-framework users.
- Return search results with enough citation metadata:
  - document ID, title, document type, chunk text, chunk index, and score if available.
- Ensure delete/reindex removes old chunks from Elasticsearch before replacing a document.

## Phase 4: FeedApp Knowledge Service Wrapper

- Add a FeedApp service wrapper around document-service:
  - `uploadProductKnowledgeFile`
  - `uploadProductKnowledgeText`
  - `getProductKnowledgeProcessingStatus`
  - `searchProductKnowledge`
  - `deleteProductKnowledgeDocument`
- All calls must:
  - Resolve product source through FeedApp.
  - Enforce FeedApp permissions before calling document-service.
  - Pass `project_id = IntegrationSource.key`.
  - Store or update FeedApp metadata after document-service responses.
- Failure behavior:
  - If document-service is unavailable, keep FeedApp responsive and show retryable document status.
  - If indexing fails, mark the FeedApp document metadata as failed with a short error.
  - Bot reply generation should continue without product knowledge only when explicitly marked as low-confidence draft.

## Phase 5: FeedApp MCP Tool Layer

- Add a FeedApp-owned MCP endpoint or MCP server module that calls existing FeedApp services, not the database directly.
- Expose narrow tools for v1:
  - `get_case_context`: returns scoped case, customer, messages, status, priority, and product source.
  - `search_product_knowledge`: searches document-service using the case's product source.
  - `create_customer_reply_draft`: creates an approval draft, not an outbound message.
  - `add_internal_note`: records bot rationale or support context.
- Tool authorization:
  - Validate the authenticated bot/user context.
  - Reuse FeedApp case visibility and product access rules.
  - Never accept arbitrary `sourceSystem` from the model when a `caseId` is available; derive product scope from the case.
- Register this FeedApp MCP server with chat-management and link it only to the FeedApp application.

## Phase 6: Bot Reply Workflow

- Add a FeedApp bot service that can be triggered from:
  - Case detail page: "Generate bot reply".
  - Optional later background job: first response after new eligible case.
- Bot request flow:
  - FeedApp sends case ID, latest customer message/context, and current actor/bot identity to chat-management.
  - chat-management orchestrates with FeedApp MCP tools.
  - FeedApp MCP tools retrieve case context and product knowledge.
  - Agent returns reply draft and rationale.
  - FeedApp stores the draft through the existing approval workflow.
- V1 reply policy:
  - Draft-only.
  - No direct customer send.
  - No status transition.
  - No assignment changes.
- Store audit events:
  - bot requested
  - knowledge searched
  - draft created
  - draft accepted/rejected later through existing approval flow

## Phase 7: UI, Observability, And Rollout

- Case detail UI:
  - Add bot reply generation action.
  - Show loading and failure states.
  - Show generated draft in the existing approval/reply area.
  - Show internal rationale only to permitted internal users.
- Product settings UI:
  - Add knowledge document list with processing status.
  - Add upload/text entry controls.
  - Add delete/reindex actions.
- Observability:
  - Log bot run ID, case ID, product source, tool calls, draft ID, and failure reason.
  - Track document-service latency and search failures.
  - Track chat-management latency and bot-generation failures.
- Rollout:
  - Ship behind `FEEDBACK_AGENT_ENABLED`.
  - Enable first in local/test-prod for one product source.
  - Expand after validating draft quality, latency, and permission boundaries.

## Public Interfaces And Types

- FeedApp env vars:
  - `FEEDBACK_AGENT_ENABLED`
  - `DOCUMENT_SERVICE_URL`
  - `DOCUMENT_SERVICE_API_KEY`
  - `CHAT_MANAGEMENT_API_URL`
  - `CHAT_MANAGEMENT_APP_KEY`
  - `FEEDBACK_MCP_API_KEY`
  - `FEEDBACK_AGENT_VERIFY_URL`
- document-service API addition:
  - `POST /documents/search` accepts optional `project_id`.
- FeedApp product knowledge concepts:
  - product-scoped knowledge document metadata
  - document type enum/string set
  - processing status mirrored from document-service
- FeedApp MCP tools:
  - `get_case_context`
  - `search_product_knowledge`
  - `create_customer_reply_draft`
  - `add_internal_note`
- FeedApp agent auth endpoint:
  - `GET /api/agent-auth/verify`
  - Requires `Authorization: Bearer <feedback_session_token>`.
  - Returns `user_id`, `email`, `name`, `roles`, `permissions`, and product-scope fields for chat-management `verify_url` auth.

## Test Plan

- Unit tests:
  - Product knowledge permission checks.
  - FeedApp document-service wrapper request construction.
  - `project_id` scoping uses `IntegrationSource.key`.
  - MCP tools reject unauthorized case/product access.
  - Bot draft creation uses approval flow and does not send messages.
- Integration tests:
  - Upload product document, poll status, search by product.
  - Same query across two products returns only scoped product knowledge.
  - Bot generates draft for a case with product knowledge.
  - Bot handles document-service outage with clear failed/low-confidence draft behavior.
- Regression tests:
  - Existing case visibility rules remain unchanged.
  - Existing message approval/send flow remains unchanged.
  - Existing product ingestion APIs remain unchanged.
- Manual acceptance:
  - Admin uploads FAQ for one product.
  - Product Manager generates a draft reply for a case in that product.
  - Product Manager cannot use bot against a product they do not manage.
  - Draft appears for approval and is not sent automatically.

## Assumptions And Defaults

- Use the existing EC2-hosted `document-service`; no code copying into FeedApp.
- Use FeedApp as the MCP owner for feedback tools; do not add FeedApp-specific tools directly inside chat-management.
- V1 is draft-only for customer replies.
- Product scope is always derived from `Case.sourceSystem` when a case exists.
- `project_id` in document-service maps to FeedApp `IntegrationSource.key`.
- All service URLs and credentials are environment-configured, never hardcoded.
