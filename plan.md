# FeedApp - Living Project Plan

This document is the authoritative roadmap and task tracker for the project. It should be updated whenever a phase task starts, completes, becomes blocked, or changes scope.

## Status Legend

- `[x]` Done
- `[~]` In progress
- `[ ]` Not started
- `[!]` Blocked

## Project Overview

Build a centralized feedback and resolution hub where customer service records and manages customer reports, product systems submit customer complaints directly through an intake API, product managers coordinate and escalate cases, staff work only on products they can access, and customers receive approved updates by email or SMS.

The system is positioned as the company's case status source of truth and primary customer-report intake layer. External products should submit reports to the hub through secure per-product intake credentials, receive signed status callbacks as cases progress, and optionally embed product-scoped monitoring views using short-lived signed tokens. MCP should be added later as a controlled AI/tool access layer, not as the primary v1 integration protocol.

## Architecture Principles

- Use a modular monolith for v1 with clear domain boundaries.
- Deploy the v1 modular monolith inside the AWS ecosystem instead of splitting the backend prematurely.
- Keep Next.js pages, server actions, API routes, service modules, repositories, and Prisma in one deployable application for the first production release.
- Extract standalone AWS Lambda handlers later only for naturally event-driven work such as queue consumers, scheduled checks, webhook processing, notification delivery, and retry workers.
- Keep the first version internal only; no customer portal in v1.
- Use first-party email/password authentication for v1, while keeping the user model ready for future company SSO.
- Enforce authorization through roles, product scopes, product-group access, and case assignments.
- Store operational data in Postgres as the source of truth.
- Use background workers for ingestion, SLA checks, escalation, and notifications.
- Use provider adapters for email, SMS, analytics, and future AI/MCP integrations.
- Treat external products as integration sources with scoped credentials, callbacks, and product-specific visibility.
- Use product/source keys as stable data-scope identifiers; use secrets or short-lived signed tokens as proof of access to that scope.
- Treat product groups/domains as admin-managed umbrellas for granting access to multiple products without selecting each product individually.
- Do not place long-lived app keys in URLs; use server-side credentials or short-lived signed embed tokens.
- Preserve audit history for imports, assignments, status changes, approvals, escalations, access changes, and outbound messages.
- Treat staff UX as an architecture concern: server-side rendering and server actions are useful defaults, but operational workflows must avoid unnecessary page jumps, lost context, repeated scrolling, and full-page navigation when a client-side interaction gives users a smoother experience.

## AWS Deployment Strategy

The first production deployment should keep the current modular monolith intact and run it on AWS-managed serverless or serverless-adjacent infrastructure. The preferred deployment shape is:

- Next.js modular monolith deployed through AWS Amplify Hosting or SST/OpenNext.
- CloudFront-managed web delivery through the selected AWS hosting path.
- Managed Postgres through Amazon RDS or Aurora PostgreSQL.
- RDS Proxy or an equivalent pooler in front of Postgres for serverless database connection safety.
- AWS Secrets Manager or SSM Parameter Store for production secrets.
- CloudWatch logs, metrics, alarms, and dashboards for operational visibility.
- EventBridge, SQS, and standalone Lambda workers added after the core app deploys successfully.

The phased direction is:

- Phase A: deploy the existing Next.js modular monolith to AWS with managed Postgres, pooled connections, controlled migrations, environment secrets, and smoke tests.
- Phase B: move asynchronous operational work out of the request path using SQS/EventBridge and standalone Lambda workers.
- Phase C: consider splitting public backend APIs only if scale, ownership, integration volume, or security boundaries require it.

Do not split staff-facing case workflows, settings workflows, login/change-password flows, or server actions into standalone Lambdas unless there is a concrete operational need. These workflows are tightly coupled to staff UX and should remain in the monolith for v1.

## Phase Tracker

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Discovery, Product Definition, and Architecture | `[x]` Done |
| 1 | Project Foundation and Developer Setup | `[~]` In progress |
| 2 | Core Domain Model and Database Persistence | `[~]` In progress |
| 3 | Authentication and Authorization | `[~]` In progress |
| 4 | Case Management Workflow | `[~]` In progress |
| 5 | SLA, Priority, Due Dates, and Escalation | `[ ]` Not started |
| 6 | Customer Messaging and Approval Workflow | `[~]` In progress |
| 7 | Product Intake API and Integration Layer | `[~]` In progress |
| 8 | Customer Analytics and Recommendation Consumption | `[~]` In progress |
| 9 | Admin Console and Configuration | `[~]` In progress |
| 10 | Observability, Audit, and Operations | `[~]` In progress |
| 11 | Security Hardening and Compliance Readiness | `[ ]` Not started |
| 12 | AWS Production Deployment | `[ ]` Not started |
| 13 | MCP and AI Tooling Layer | `[ ]` Not started |

## Phase 0: Discovery, Product Definition, and Architecture

Goal: define the product scope, operating model, architecture direction, roles, workflows, and integration strategy.

Tasks:

- `[x]` Define the product goal as an internal customer feedback and resolution hub.
- `[x]` Confirm customer service owns case opening, closing, and reopening.
- `[x]` Confirm product managers coordinate and escalate cases.
- `[x]` Confirm users only access cases for products or product groups they are granted.
- `[x]` Confirm customer replies require approval before sending.
- `[x]` Confirm automated acknowledgement and resolved/closed notifications are allowed.
- `[x]` Confirm v1 has no customer portal.
- `[x]` Confirm secure product-submitted intake API as the primary v1 integration approach.
- `[x]` Confirm manual case entry remains supported for direct customer-service calls.
- `[x]` Confirm source products should receive signed status callback webhooks as cases progress.
- `[x]` Confirm product dashboards can embed product-scoped monitoring views with short-lived signed tokens.
- `[x]` Confirm MCP is a later controlled tooling layer.
- `[x]` Confirm email/password plus app-level provisioning as the v1 access model, with optional future SSO.
- `[x]` Confirm medium-enterprise scale and cloud managed services as the production assumption.
- `[x]` Draft the initial product plan.
- `[x]` Draft the production architecture plan.

Acceptance criteria:

- `[x]` Product scope is clear.
- `[x]` Core roles and responsibilities are clear.
- `[x]` Integration strategy is clear.
- `[x]` Architecture direction is clear.

## Phase 1: Project Foundation and Developer Setup

Goal: create a runnable application foundation with project tooling, documentation, and baseline verification.

Tasks:

- `[x]` Create Next.js/React project scaffold.
- `[x]` Add TypeScript configuration.
- `[x]` Add ESLint configuration.
- `[x]` Add Vitest configuration.
- `[x]` Add package scripts for dev, build, lint, typecheck, test, and Prisma generation.
- `[x]` Add `.env.example`.
- `[x]` Add `.gitignore`.
- `[x]` Add README with setup and architecture direction.
- `[x]` Install project dependencies.
- `[x]` Generate Prisma client.
- `[x]` Build initial internal dashboard shell.
- `[x]` Add health-check route.
- `[x]` Verify unit tests pass.
- `[x]` Verify typecheck passes.
- `[x]` Verify lint passes.
- `[x]` Verify production build passes.
- `[~]` Maintain this living `plan.md`.
- `[x]` Create `summary.md` session log.

Remaining tasks:

- `[x]` Add local Docker Compose for Postgres.
- `[x]` Add seed script for local demo data.
- `[x]` Add project contribution notes for future development sessions.
- `[ ]` Add CI workflow for test, typecheck, lint, and build.

Acceptance criteria:

- `[x]` App can run locally.
- `[x]` Build pipeline commands exist.
- `[x]` Baseline tests pass.
- `[x]` Project documentation exists.
- `[x]` Local database setup is reproducible from documentation.
- `[ ]` CI verifies the core checks automatically.

## Phase 2: Core Domain Model and Database Persistence

Goal: move from demo data and stub logic to database-backed core entities and service/repository layers.

Tasks:

- `[x]` Define initial Prisma schema for users, roles, departments, customers, cases, messages, approvals, SLA policies, integration sources, integration events, and audit logs.
- `[x]` Refactor department-based case scope into product-based case scope, using integration sources/products as the tenant boundary.
- `[x]` Add product groups/domains so admins can group related products for access grants.
- `[x]` Add domain constants for case statuses, roles, priorities, and message channels.
- `[x]` Add TypeScript domain types.
- `[x]` Add initial workflow transition rules.
- `[x]` Add initial SLA utility functions.
- `[x]` Add initial access-control utility functions.
- `[x]` Create first database migration.
- `[x]` Add seed data for roles, departments, demo users, SLA policies, customers, and cases.
- `[~]` Update seed data to use products, product groups, product access grants, and product-based SLA policies.
- `[~]` Add repository layer for cases, customers, departments, users, roles, messages, approvals, integrations, and audit logs.
- `[~]` Add service layer for case creation, assignment, status transitions, approvals, messaging, ingestion, and SLA calculation.
- `[x]` Replace demo dashboard data with database-backed queries.
- `[~]` Replace stub API responses with database-backed services.
- `[~]` Add audit logging service and write audit events for all state-changing operations.
- `[x]` Add paginated case list reads with total counts.
- `[x]` Add customer identifier uniqueness and race-safe customer find-or-create.
- `[x]` Add database indexes needed for dashboard filters, status views, department views, and source-system deduplication.
- `[~]` Add database indexes needed for product-scoped case lists, product-group access checks, and product SLA lookups.
- `[x]` Add explicit referential actions for core relations.

Acceptance criteria:

- `[x]` Database migrations run cleanly.
- `[x]` Seed data creates a usable local environment.
- `[~]` API routes read and write through service/repository layers.
- `[x]` Demo data is no longer hardcoded in the runtime dashboard.
- `[~]` Audit logs are recorded for core case operations.

## Phase 3: Authentication and Authorization

Goal: implement real staff authentication and app-level access control.

Tasks:

- `[x]` Add a local current-user selector for development and permission testing before real auth is wired.
- `[x]` Add first-party email/password login.
- `[x]` Add authentication session handling.
- `[x]` Store email, display name, optional SSO subject, password hash, temporary-password state, and provisioning state for users.
- `[x]` Enforce that successful login does not automatically grant app access unless the user is provisioned.
- `[~]` Add access-required page for authenticated but unprovisioned users.
- `[x]` Implement explicit user provisioning by admins.
- `[ ]` Implement optional SSO provider mapping later if company identity integration becomes available.
- `[x]` Implement role assignment.
- `[x]` Implement department membership assignment.
- `[x]` Replace department membership assignment with product and product-group access assignment.
- `[x]` Implement product-scoped assignment eligibility for reps with direct or product-group access.
- `[x]` Add product-manager roster administration for directly assigned products.
- `[~]` Apply authorization checks to all protected pages and APIs.
- `[~]` Add tests for unprovisioned users, role restrictions, product scoping, product-group scoping, product roster administration, case assignment visibility, customer recommendation scoping, and approval bypass prevention.

Acceptance criteria:

- `[~]` Only authenticated and provisioned users can access operational app surfaces.
- `[x]` Users cannot view cases for unrelated products.
- `[x]` Customer service reps only see cases for products or product groups granted to them.
- `[x]` Admins can manage access.
- `[~]` Authorization is enforced on both UI and API paths.

## Phase 4: Case Management Workflow

Goal: build the full operational case lifecycle for customer service, product managers, product-scoped access, and assigned reps.

Tasks:

- `[x]` Build case list page with filters for status, priority, department, assignee, source, SLA state, and search.
- `[x]` Replace case list department filter with product and product-group filters.
- `[x]` Add dashboard pagination controls for case lists.
- `[~]` Build case detail page with status, assignee, product/source, customer, source metadata, timeline, messages, approvals, and recommendations.
- `[x]` Build manual case creation flow.
- `[x]` Build assignment and reassignment flow.
- `[x]` Restrict case assignee options to reps who can access the case product.
- `[x]` Re-evaluate department handoff flow; v1 stays centered on product scope plus rep assignment unless internal team queues are reintroduced.
- `[~]` Build status transition actions for `New`, `Assigned`, `In Progress`, `Resolved`, `Closed`, and `Reopened`.
- `[x]` Enforce valid transition rules in the service layer.
- `[~]` Enforce that customer service can open, close, and reopen cases.
- `[~]` Enforce that product managers can coordinate and escalate within scope.
- `[x]` Add internal notes.
- `[x]` Add case timeline.
- `[~]` Add tests for case creation, assignment, transition rules, reopen behavior, role restrictions, dashboard filter correctness, product-scoped assignment eligibility, suggestion dismissal, and timeline audit coverage.

Acceptance criteria:

- `[~]` Staff can manage cases end to end inside their permissions.
- `[x]` Invalid status transitions are blocked.
- `[~]` Case timeline accurately reflects workflow history.
- `[ ]` Case operations produce audit events.

## Phase 5: SLA, Priority, Due Dates, and Escalation

Goal: implement operational accountability and escalation rules.

Tasks:

- `[ ]` Add configurable priority levels if defaults need admin control.
- `[ ]` Add SLA policy management by product and priority, with optional product-group defaults.
- `[ ]` Calculate response deadlines and resolution deadlines when cases are created or reassigned.
- `[ ]` Track due dates separately from SLA deadlines.
- `[ ]` Add SLA state: on track, at risk, breached, paused if needed later.
- `[ ]` Add background job for SLA risk detection.
- `[ ]` Add background job for SLA breach detection.
- `[ ]` Add escalation path configuration.
- `[ ]` Create escalation events and notify responsible users.
- `[ ]` Add dashboard widgets for at-risk and breached cases.
- `[ ]` Add tests for SLA calculations, product-priority rules, product-group default fallback, escalation thresholds, and resolved/closed exclusions.

Acceptance criteria:

- `[~]` SLA deadlines and filter states are calculated consistently.
- `[ ]` At-risk and breached cases are visible.
- `[ ]` Escalations are triggered and logged.
- `[ ]` Resolved and closed cases are excluded from active SLA breach checks.

## Phase 6: Customer Messaging and Approval Workflow

Goal: support safe customer communication with message history and approval controls.

Tasks:

- `[~]` Build message history on each case.
- `[x]` Build staff-authored reply drafts.
- `[x]` Build system-suggested reply drafts based on case status and details.
- `[x]` Build approval request flow for outbound customer replies.
- `[x]` Surface pending customer reply approvals in the dashboard Operations queue.
- `[x]` Build send/decline flow for case-team review of suggested replies.
- `[x]` Add reviewer routing rules for submitted approvals, routing first to product managers and then to admins.
- `[~]` Add approval notifications through in-app alerts, email, or queue-backed delivery.
- `[x]` Surface routed approvals as in-app dashboard and case-detail queue notifications for eligible reviewers.
- `[~]` Block unapproved outbound replies.
- `[x]` Suppress duplicate suggestions after a customer update has been sent for the current case stage.
- `[x]` Add configurable stale-stage follow-up timers by status and priority.
- `[x]` Add stale-stage customer update prompts for scoped case teams.
- `[x]` Implement automated new-report acknowledgement.
- `[x]` Implement automated resolved/closed notification.
- `[x]` Add email provider adapter implementation.
- `[x]` Add SMS provider adapter implementation.
- `[x]` Add case-specific email subjects and live-provider warnings for customer delivery testing.
- `[x]` Add delivery status tracking.
- `[x]` Add retry and failure handling for outbound messages.
- `[x]` Add environment-backed messaging provider status view.
- `[~]` Add tests for approvals, blocked sends, automated notifications, delivery state, provider configuration, retry behavior, and message history.

Acceptance criteria:

- `[x]` Every outbound customer message is tracked.
- `[~]` Manual replies cannot be sent without approval.
- `[~]` Submitted approvals are visible to eligible case users.
- `[x]` Allowed automated lifecycle messages are sent through adapters.
- `[x]` Delivery failures are visible and retryable.

## Phase 7: Product Intake API and Integration Layer

Goal: let product systems submit customer reports directly into the hub, receive case progress callbacks, and optionally embed product-scoped monitoring views.

Tasks:

- `[x]` Add initial ingestion validation schema.
- `[x]` Add initial webhook signature utility.
- `[x]` Add initial ingestion API route.
- `[x]` Position `POST /api/ingestion/reports` as the primary product report intake endpoint.
- `[x]` Use each integration source key as the product scope stored on created cases.
- `[x]` Add per-product integration source credentials instead of one shared webhook secret.
- `[x]` Store only hashed or encrypted integration secrets.
- `[x]` Reject disabled, unknown, or invalid integration sources.
- `[x]` Remove department-key requirement from product intake; authenticated product/source determines case scope.
- `[x]` Remove allowed department-key configuration from integration sources after product-scoped access is implemented.
- `[x]` Persist ingestion events.
- `[x]` Create or update customers from ingestion payloads.
- `[x]` Create or deduplicate cases using source system and external ID.
- `[x]` Return compact case references to source products with case ID, status, priority, source system, and external ID.
- `[ ]` Store raw payload references or normalized snapshots.
- `[x]` Add idempotency handling.
- `[x]` Add product/integration source configuration UI in Settings.
- `[x]` Add outbound status callback configuration per integration source.
- `[x]` Send signed status callback webhooks when cases progress.
- `[x]` Record outbound callback delivery attempts, success/failure, retry count, and last error.
- `[x]` Add retry handling for failed outbound callbacks.
- `[ ]` Add product-scoped embedded monitoring route for source dashboards.
- `[ ]` Add short-lived signed embed tokens for product dashboard access.
- `[ ]` Ensure embed tokens carry a source key, expiry, and read-only permissions.
- `[ ]` Ensure embedded monitoring views are read-only for v1.
- `[x]` Keep manual case entry as a first-class workflow tied to selected product/source scope.
- `[ ]` Add connector job queue for ingestion and outbound callback work.
- `[ ]` Add dead-letter queue handling.
- `[ ]` Add integration health page with last sync, last success, last error, failure count, and retry state.
- `[~]` Add tests for signed intake, invalid credentials, disabled sources, duplicate reports, malformed payloads, status callbacks, embed tokens, product scoping, and failure retry.

Acceptance criteria:

- `[x]` Product systems can submit reports securely through the hub intake API.
- `[x]` Valid external reports create cases immediately.
- `[x]` Duplicate source reports do not create duplicate cases.
- `[x]` Manual customer-service case entry still works independently of product integrations.
- `[x]` Source products receive signed case status callbacks.
- `[ ]` Product dashboards can show only their own source-system cases through short-lived embed access.
- `[x]` Product keys define query scope, but secrets or signed tokens are required to access that scope.
- `[~]` Integration failures are visible and recoverable.

## Phase 8: Customer Analytics and Recommendation Consumption

Goal: consume recommendations from the existing customer analytics system without replacing it.

Tasks:

- `[x]` Add initial analytics adapter interface.
- `[x]` Add stub recommendations API.
- `[~]` Define analytics system contract with customer identifiers and recommendation shape.
- `[ ]` Implement real analytics client adapter.
- `[x]` Map platform customers to analytics customer identifiers using external ID, email, phone, then FeedApp customer ID fallback.
- `[x]` Display recommendations on case detail page.
- `[x]` Ensure recommendations are internal-only and require staff review/editing before any customer-facing message is sent.
- `[~]` Track whether recommendations were viewed, dismissed, approved, or sent.
- `[~]` Add tests for recommendation retrieval, customer mapping, visibility, and approval gating.

Acceptance criteria:

- `[x]` Staff can see relevant customer recommendations.
- `[x]` Recommendations are never sent automatically.
- `[~]` Recommendation actions are auditable.

## Phase 9: Admin Console and Configuration

Goal: give admins control over the operational setup without code changes.

Tasks:

- `[~]` Build user management screen.
- `[~]` Build role assignment screen.
- `[~]` Build department management screen.
- `[~]` Build department membership screen.
- `[x]` Replace department management with product management and product-group/domain management.
- `[x]` Replace department membership with user product access and product-group access controls.
- `[~]` Build case scope/access grant screen for customer service reps.
- `[ ]` Build SLA policy management screen.
- `[x]` Build integration source management screen.
- `[x]` Build messaging provider configuration screen or environment-backed configuration view.
- `[x]` Build product-scoped roster management for Product Managers with direct product access.
- `[ ]` Build audit log viewer.
- `[~]` Add tests for admin-only access, scoped access views, and configuration changes.

Acceptance criteria:

- `[ ]` Admins can manage access, products, product groups/domains, SLA rules, and integrations.
- `[~]` Non-admin users cannot access admin configuration, while scoped product/team access remains visible read-only.
- `[ ]` Configuration changes are audited.

## Phase 10: Observability, Audit, and Operations

Goal: make the system operable in production.

Tasks:

- `[ ]` Add structured application logging.
- `[ ]` Add request IDs and correlation IDs.
- `[ ]` Add error reporting integration.
- `[ ]` Add metrics for case volume, SLA risk, breached SLAs, ingestion volume, connector failures, notification failures, and approval backlog.
- `[~]` Add metrics for outbound status callback success, failures, retries, and delivery latency.
- `[ ]` Add health checks for database, queue, messaging providers, intake API, embed-token validation, and outbound callback delivery.
- `[x]` Add admin-visible operational dashboard for failed customer message deliveries.
- `[x]` Add admin-visible operational dashboard for failed product status callbacks.
- `[ ]` Add audit event coverage for all sensitive actions.
- `[ ]` Add backup and restore documentation.
- `[~]` Add runbooks for failed intake, failed status callbacks, failed notifications, SLA job failures, and auth issues.

Acceptance criteria:

- `[~]` Operators can detect system health issues.
- `[x]` Failed customer notification deliveries are visible and retryable.
- `[~]` Failed jobs and integrations are visible.
- `[ ]` Sensitive actions are auditable.
- `[ ]` Operational runbooks exist.

## Phase 11: Security Hardening and Compliance Readiness

Goal: prepare the system for enterprise use and future compliance review.

Tasks:

- `[ ]` Enforce HTTPS-only production configuration.
- `[ ]` Validate and sanitize all external inputs.
- `[ ]` Add rate limiting for public ingestion endpoints.
- `[ ]` Add webhook signature rotation process.
- `[ ]` Add per-product integration credential rotation process.
- `[ ]` Add short-lived signed embed token validation and expiry enforcement.
- `[ ]` Store secrets in managed secret storage.
- `[ ]` Review least-privilege permissions for integration credentials.
- `[ ]` Add data retention policy hooks.
- `[ ]` Add customer contact data handling policy.
- `[ ]` Add access review reporting.
- `[ ]` Add security tests for unauthorized access, invalid signatures, product-scope bypass, product-group access bypass, and unapproved outbound messaging.

Acceptance criteria:

- `[ ]` Public ingestion endpoints are protected.
- `[ ]` Product embed views cannot expose cases from another source system.
- `[ ]` Secrets are not stored in source code.
- `[ ]` Cross-scope access is blocked.
- `[ ]` Security-sensitive behavior has test coverage.

## Phase 12: AWS Production Deployment

Goal: deploy a reliable production-ready version in the AWS ecosystem while keeping the current Next.js modular monolith intact for v1.

Tasks:

- `[x]` Choose AWS as the required production ecosystem.
- `[ ]` Choose the v1 AWS Next.js hosting path: AWS Amplify Hosting for managed simplicity or SST/OpenNext for explicit Lambda/CloudFront/IaC control.
- `[ ]` Document the selected hosting path and deployment tradeoffs.
- `[ ]` Keep the v1 app/backend as a modular monolith during deployment.
- `[ ]` Identify later standalone Lambda candidates: SLA checks, stale-case prompts, outbound message retry workers, product callback retry workers, webhook processors, and ingestion queue consumers.
- `[x]` Fix production build reliability by removing build-time dependency on remote Google Fonts.
- `[ ]` Configure Next.js production runtime settings for the selected AWS hosting path.
- `[ ]` Provision managed Postgres through Amazon RDS or Aurora PostgreSQL.
- `[ ]` Configure RDS Proxy or equivalent Postgres connection pooling for serverless runtime traffic.
- `[ ]` Define separate database URLs or credentials for runtime application traffic and migration jobs if required by the chosen database/pooler setup.
- `[ ]` Add `prisma migrate deploy` production migration script.
- `[ ]` Add Prisma client generation to the production build pipeline.
- `[ ]` Configure AWS Secrets Manager or SSM Parameter Store for database, session, integration, messaging, and callback secrets.
- `[ ]` Configure staging and production AWS environments.
- `[ ]` Add CI/CD deployment pipeline.
- `[ ]` Add database migration deployment step.
- `[ ]` Add environment-specific secrets.
- `[ ]` Add smoke tests after deployment for health, login, case list, case creation, ingestion, messaging provider status, and callback retry visibility.
- `[ ]` Add rollback procedure.
- `[ ]` Add backup and restore verification.
- `[ ]` Provision queue/worker infrastructure after the monolith deployment is stable.
- `[ ]` Add EventBridge schedules for SLA/stale-case checks when those jobs are implemented.
- `[ ]` Add SQS queues and dead-letter queues for asynchronous ingestion, message delivery, and product status callbacks when they are moved out of the request path.
- `[ ]` Add standalone Lambda workers only for async/event-driven workflows that have been proven ready to extract.
- `[ ]` Provision object storage for raw payloads, imports, exports, and attachments.
- `[ ]` Provision logging, metrics, traces, and alerting.

Acceptance criteria:

- `[ ]` Staging deploys successfully.
- `[ ]` Production deploys successfully.
- `[ ]` The current modular monolith runs in AWS without requiring Docker for the application runtime.
- `[ ]` Production database traffic uses pooled connections.
- `[ ]` Migrations are controlled and repeatable.
- `[ ]` Secrets are managed through AWS services, not committed files.
- `[ ]` Rollback and restore procedures are documented and tested.

## Phase 13: MCP and AI Tooling Layer

Goal: add controlled AI/tool access after the core workflow and APIs are stable.

Tasks:

- `[ ]` Define permission-aware MCP tool boundaries.
- `[ ]` Add MCP server that calls application services, not the database directly.
- `[ ]` Add case lookup tool.
- `[ ]` Add case summary tool.
- `[ ]` Add SLA risk check tool.
- `[ ]` Add reply draft tool.
- `[ ]` Add customer recommendation lookup tool.
- `[ ]` Revisit handoff summary tooling after product-scoped assignment is stable.
- `[ ]` Add escalation summary tool.
- `[ ]` Add audit logging for MCP tool usage.
- `[ ]` Add tests for MCP permission enforcement and tool outputs.

Acceptance criteria:

- `[ ]` MCP tools respect the same authorization model as the app.
- `[ ]` MCP tool actions are auditable.
- `[ ]` AI-generated suggestions never bypass approval controls.

## Phase 14: Agentic Feedback Bot And Product Knowledge

Goal: add a FeedApp-owned first-response bot that uses the ITC agent framework for orchestration and the existing document service for product-scoped knowledge retrieval.

Tasks:

- `[x]` Create the dedicated agentic feature implementation plan.
- `[x]` Add FeedApp environment placeholders for agent, document-service, and chat-management integration.
- `[x]` Reuse the existing EC2-hosted document service instead of copying document indexing into FeedApp.
- `[x]` Add `project_id` search scoping support to document-service search.
- `[x]` Add document-service service-key support for trusted FeedApp backend calls.
- `[x]` Add FeedApp document-service client wrapper.
- `[x]` Add FeedApp product knowledge metadata schema, migration, and repository.
- `[x]` Add FeedApp product knowledge access-control helpers.
- `[x]` Add FeedApp product knowledge service layer for text upload, search, status refresh, and delete.
- `[x]` Add product knowledge settings UI for text upload, list, status refresh, and delete.
- `[x]` Add product knowledge file-upload service flow.
- `[x]` Add product knowledge file-upload UI.
- `[x]` Refresh product knowledge processing status by stored task ID.
- `[ ]` Add product knowledge reindex action.
- `[x]` Add FeedApp-owned MCP tool endpoint that calls application services, not the database directly.
- `[x]` Add MCP tools for case context, product knowledge search, customer reply draft creation, and internal notes.
- `[x]` Add FeedApp `verify_url` endpoint so chat-management can validate FeedApp session bearer tokens.
- `[ ]` Register FeedApp as an application in chat-management and link only the FeedApp MCP server.
- `[ ]` Add bot reply generation service that calls chat-management and stores draft-only approval requests.
- `[ ]` Add case-detail UI action for generating a bot reply draft.
- `[ ]` Add audit events for bot request, knowledge search, draft creation, and later approval/rejection.
- `[ ]` Add observability for bot run ID, case ID, product source, tool calls, draft ID, and failure reason.
- `[ ]` Roll out behind `FEEDBACK_AGENT_ENABLED`.

Acceptance criteria:

- `[ ]` Product knowledge search is always scoped to the product source derived from FeedApp.
- `[ ]` Product Managers can manage only directly assigned product knowledge, while Admins can manage all product knowledge.
- `[ ]` Product Users can search only knowledge for granted product sources.
- `[ ]` The bot creates customer reply drafts only; it does not send messages, transition cases, or assign cases in v1.
- `[ ]` Bot and MCP actions reuse FeedApp authorization and are auditable.

## Testing Strategy

Core checks:

- `[x]` `npm test`
- `[x]` `npm run typecheck`
- `[x]` `npm run lint`
- `[x]` `npm run build`
- `[x]` `npm run prisma:generate`

Testing layers to maintain:

- `[x]` Unit tests for workflow, SLA, and access-control utilities.
- `[~]` Service-layer tests for database-backed case operations.
- `[ ]` API integration tests for cases, ingestion, approvals, and recommendations.
- `[ ]` UI tests for key staff workflows.
- `[~]` Security tests for app provisioning, product scoping, product-group scoping, invalid signatures, product-scope bypass, and approval bypass prevention.
- `[ ]` Background job tests for ingestion, SLA, escalation, and notifications.
- `[ ]` Load tests for ingestion, case search, dashboard queries, and SLA jobs.

## Current Known Gaps

- Runtime data still uses stub/provider foundations for analytics recommendations and some future integrations.
- Most core staff workflows now read/write through Postgres-backed service and repository layers.
- Email/password authentication and database-backed sessions are implemented; SSO is deferred.
- App provisioning is enforced after login.
- Background worker runtime is not implemented yet.
- AWS deployment configuration is not implemented yet.
- The v1 AWS hosting path still needs to be selected between Amplify Hosting and SST/OpenNext.
- Production Postgres connection pooling is not configured yet.
- Production migration workflow is not configured yet.
- Production secrets are not wired to AWS Secrets Manager or SSM Parameter Store yet.
- Email/SMS providers have stub and generic HTTP adapters; production provider-specific integrations still need real credentials and environment setup.
- Product status callbacks are implemented for assignment and status-change events, but still run synchronously in the request path until queue/worker infrastructure is added.
- Analytics integration is stubbed.
- Role-aware Settings and admin access management are implemented for v1 foundations; more configuration areas remain.
- CI/CD and production deployment are not configured yet.

## Next Focus

Immediate AWS deployment readiness:

- `[ ]` Decide between AWS Amplify Hosting and SST/OpenNext for the v1 Next.js modular monolith deployment.
- `[x]` Fix production build reliability by replacing remote Google Font loading with a system font approach.
- `[ ]` Add production scripts for `prisma generate`, `prisma migrate deploy`, build, and smoke checks.
- `[ ]` Choose the production Postgres option: RDS PostgreSQL or Aurora PostgreSQL.
- `[ ]` Choose the connection pooling option: RDS Proxy first unless the selected database setup provides an approved equivalent.
- `[ ]` Define required AWS secrets and environment variables.
- `[ ]` Add CI checks for typecheck, lint, test, build, and Prisma generation.

Core product readiness before first production pilot:

- `[~]` Finish protected-page/API authorization coverage.
- `[~]` Finish case detail workflow coverage and audit events for state-changing operations.
- `[ ]` Finish admin configuration for access grants, SLA policy management, and audit viewing.
- `[ ]` Add structured logging, request IDs, and health checks for database and provider configuration.
- `[ ]` Add rate limiting and credential rotation process for public ingestion endpoints.

Later AWS Lambda extraction candidates:

- `[ ]` Move product status callback delivery and retries to SQS plus Lambda workers.
- `[ ]` Move customer message delivery and retries to SQS plus Lambda workers.
- `[ ]` Add EventBridge-triggered Lambda workers for SLA risk, breach detection, and stale-case prompts.
- `[ ]` Add dead-letter queues and operations views for failed async jobs.

## Decision Log

- Use a modern web stack with Next.js/React.
- Use Postgres as the system of record.
- Use a modular monolith for v1.
- Use AWS as the required production ecosystem.
- Keep the current Next.js app/backend as the v1 AWS modular monolith deployment target.
- Do not split the backend into standalone Lambda handlers for the first production release.
- Extract standalone AWS Lambda handlers later for event-driven workflows after the monolith is deployed and stable.
- Prefer managed Postgres with serverless-safe connection pooling for production runtime traffic.
- Use secure product-submitted intake APIs as the primary external integration path.
- Use signed outbound webhooks to notify source products as case status progresses.
- Use product/source keys for logical multi-tenancy and case scoping.
- Use product groups/domains as admin-managed access bundles for granting users access to multiple products.
- Use short-lived signed embed tokens, not long-lived app keys in URLs, for product-scoped monitoring dashboards.
- Add MCP later as a controlled tool layer.
- Use email/password authentication for v1 to avoid IT/SSO bottlenecks.
- Keep optional SSO identity fields for a future company identity-provider integration.
- Require explicit app provisioning for app access.
- Keep v1 internal only, with no customer portal.
- Show product recommendations to staff only and require approval before customer communication.
- Configure SLA rules by product and priority, with product-group/domain defaults to reduce repetition.
- Use provider adapters for email/SMS and analytics integrations.
- 2026-07-09: Adopt Tailwind CSS (v4) with a shared component library (`src/components/ui/`) as the app's design system, replacing the hand-rolled `globals.css` component styles, while keeping the existing IT Consortium brand tokens (navy/cyan palette, radius/shadow scale) as the Tailwind theme.
- 2026-07-09: Split the Settings page into focused sub-routes (`/settings`, `/settings/team`, `/settings/products`, `/settings/messaging`) instead of one long single-page admin console, so each screen only loads and shows what's relevant to it.
- 2026-07-10: Product status callbacks are signed with per-source callback secrets stored in integration source config, persisted as delivery attempts, and retryable from `Settings > Operations`.
- 2026-07-10: Callback delivery runs inline from assignment and status-change workflows until queue/worker infrastructure is added.
- 2026-07-10: Product Managers with direct product access act as product roster admins for that product; product-group access grants visibility and assignment eligibility but not roster administration.
- 2026-07-10: Customer message delivery uses provider adapters with persisted delivery status, retry attempts, and admin-visible failed-delivery operations.
