# FeedApp

Internal case operations platform for centralized feedback intake, SLA tracking, escalation, approved customer communication, and integration with product systems.

## Current Implementation

- Next.js app shell with an internal operations dashboard.
- Domain modules for access control, workflow transitions, SLA checks, integration signatures, messaging adapters, and analytics adapters.
- REST route foundations for health checks, cases, report ingestion, and customer recommendations.
- Prisma schema for the production data model.
- Email/password authentication with secure session cookies, role-based settings, and unit tests for workflow, access control, auth, and SLA rules.

## Local Setup

```bash
npm install
cp .env.example .env
npm run db:up
npm run prisma:migrate
npm run prisma:seed
npm run db:verify
npm run dev
```

To recreate the local database from scratch:

```bash
npm run db:reset
npm run prisma:generate
npm run dev
```

When checking a production build while `npm run dev` is still running, use:

```bash
npm run build:verify
```

This writes to `.next-verify` instead of the dev server's `.next` directory, avoiding stale compiled chunks in the running dev server.

The default local database runs in Docker at `postgresql://feedback:feedback@localhost:5432/feedback_hub?schema=public`.

## Internal Beta Docker Deployment

For EC2 internal beta hosting, use the production Docker files:

```bash
cp .env.production.example .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml --env-file .env.production exec app npm run prisma:seed:production
```

The app is exposed on host port `18081`; Postgres is private to the Docker network. The production seed creates the base roles, a Support department, and the configured platform admin. See `docs/deploy-ec2-docker.md` for EC2 setup, deploy, logs, and backup commands.
For direct HTTP beta testing, set `PUBLIC_APP_URL` to the browser-facing EC2 origin, for example `http://54.246.247.31:18081`, and set `SESSION_COOKIE_SECURE=false`; switch the URL to the HTTPS domain and `SESSION_COOKIE_SECURE=true` after HTTPS is configured.

Seeded demo users can sign in with the password `Password123!`. Local admin accounts include `admin@example.com` and `obamiebo@itconsortiumgh.com`.

Demo product intake credentials:

- Source key: `commerce-platform`
- Source secret: `commerce-secret-123`

Messaging delivery defaults to local stub mode:

```bash
EMAIL_PROVIDER="stub"
SMS_PROVIDER="stub"
```

To live-test email delivery through the ITC messaging service:

```bash
EMAIL_PROVIDER="itc"
EMAIL_ITC_ENDPOINT="https://apis.itcsrvc.com/messaging/send-message"
```

The ITC email adapter posts JSON with `traceId`, `sendingMethod`, `source`, `details.subject`, `details.msg`, and `control.recipients`.

To live-test SMS delivery through the TFSG gateway:

```bash
SMS_PROVIDER="tfsg"
SMS_TFSG_ENDPOINT="http://52.89.222.13/tfsg/public/api/send"
SMS_TFSG_API_KEY="replace-me"
SMS_TFSG_MERCHANT_ID="1"
```

The TFSG SMS adapter posts JSON with `api_key`, `merchant_id`, `message`, and `recipients`.

To send through a generic HTTP gateway, set `EMAIL_PROVIDER="http"` or `SMS_PROVIDER="http"` and provide the matching `*_HTTP_ENDPOINT`. The app posts JSON with `caseId`, `channel`, `recipient`, and `body`, and accepts a JSON response with optional `providerMessageId` or `id`, plus optional `status` of `queued`, `sent`, or `failed`.

Example product report submission:

```bash
curl -X POST http://localhost:3000/api/ingestion/reports \
  -H 'content-type: application/json' \
  -H 'x-feedback-source: commerce-platform' \
  -H 'x-feedback-secret: commerce-secret-123' \
  -d '{
    "caseID": "COM-DEMO-1001",
    "customerID": "cust-demo-1001",
    "title": "Checkout failed",
    "description": "Customer cannot complete checkout from the product form.",
    "priority": "High",
    "customerName": "Demo Customer",
    "customerEmail": "demo.customer@example.com"
  }'
```

Product teams can query their own submitted reports with the same source headers:

```bash
curl 'http://localhost:3000/api/ingestion/reports?status=IN_PROGRESS&customerID=cust-demo-1001&limit=50' \
  -H 'x-feedback-source: commerce-platform' \
  -H 'x-feedback-secret: commerce-secret-123'
```

Supported filters are `caseID`, `customerID`, `status`, `from`, `to`, `limit`, and `cursor`. Status values are `NEW`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, and `REOPENED`.

Product teams can append customer replies to the same case conversation by posting to the case message endpoint. `caseId` may be either the FeedApp case ID or the product's submitted `caseID`. Replies to `RESOLVED` or `CLOSED` cases reopen the case.

```bash
curl -X POST 'http://localhost:3000/api/ingestion/reports/COM-DEMO-1001/messages' \
  -H 'content-type: application/json' \
  -H 'x-feedback-source: commerce-platform' \
  -H 'x-feedback-secret: commerce-secret-123' \
  -d '{
    "channel": "Email",
    "body": "This is still happening on my account.",
    "externalMessageId": "email-thread-message-123",
    "customerEmail": "demo.customer@example.com"
  }'
```

Product-scoped case tags are managed in `Settings > Products > Case tags`. Tags belong to one product source and can be applied only to cases from that product. Product-authenticated systems can also manage their own tag catalog and assign tags:

```bash
curl 'http://localhost:3000/api/ingestion/tags' \
  -H 'x-feedback-source: commerce-platform' \
  -H 'x-feedback-secret: commerce-secret-123'

curl -X POST 'http://localhost:3000/api/ingestion/tags' \
  -H 'content-type: application/json' \
  -H 'x-feedback-source: commerce-platform' \
  -H 'x-feedback-secret: commerce-secret-123' \
  -d '{"name":"Billing","color":"#244f89","description":"Payment and checkout issues"}'

curl -X POST 'http://localhost:3000/api/ingestion/reports/COM-DEMO-1001/tags' \
  -H 'content-type: application/json' \
  -H 'x-feedback-source: commerce-platform' \
  -H 'x-feedback-secret: commerce-secret-123' \
  -d '{"tagIds":["tag-id-from-list"]}'
```

Product report list responses include a `tags` array for each case.

Trusted product dashboards can also deep-link pre-provisioned FeedApp users without a FeedApp login screen:

```text
GET /external-entry?token=<signed-jwt>
```

Admins configure per-product external entry in `Settings > Products > Manage source > Embedded access`. The external dashboard backend signs an `HS256` JWT using the one-time entry signing secret generated for that product source. Required claims:

```json
{
  "iss": "fihankra-dashboard",
  "sub": "their-user-id",
  "email": "ama@fihankra.com",
  "name": "Ama Mensah",
  "sourceKeys": ["fihankra-feedback"],
  "iat": 1785492000,
  "exp": 1785492300
}
```

FeedApp verifies the signature, issuer, expiry, allowed source keys, and the pre-provisioned user's FeedApp product grants before creating a session.

For an embedded product dashboard tab, pass `mode=embed`:

```text
GET /external-entry?token=<signed-jwt>&mode=embed
```

Embed mode uses the same FeedApp session, RBAC, and product-scope checks, but renders the app with compact dashboard chrome instead of the standalone sidebar. The embed landing flow carries `entryMode=embed` and `sourceSystem` through dashboard links, profile/settings links, and case workflow saves so nested pages keep the embedded chrome after navigation or server-action redirects.

Set `PUBLIC_APP_URL` in production to the browser-facing FeedApp origin. Trusted external-entry redirects use this value when configured so Docker or proxy-internal runtime URLs such as `localhost:3000` are not exposed to users.

Admins can enable or disable signed external entry per product source, set the expected issuer, token TTL, allowed destinations, and allowed iframe origins. This configuration generates a separate one-time entry signing secret for the product dashboard backend. The entry secret is distinct from the product intake secret and the product callback signing secret.

Configure `EMBED_ALLOWED_ORIGINS` with a comma-separated deployment allow-list of product dashboard origins that may frame FeedApp. Per-product allowed origins are stored with the product settings for operational clarity, while the deployment CSP allow-list is enforced through `EMBED_ALLOWED_ORIGINS`.

## Agentic Bot Setup

The FeedApp bot workflow is disabled unless `FEEDBACK_AGENT_ENABLED="true"`.

Register FeedApp in chat-management as an application with:

- `auth_config.method`: `verify_url`
- `auth_config.verify_url`: the browser/network reachable FeedApp `FEEDBACK_AGENT_VERIFY_URL`, for example `http://localhost:3000/api/agent-auth/verify`
- the returned application API key stored in FeedApp as `CHAT_MANAGEMENT_APP_KEY`

Register the FeedApp MCP server in chat-management and link it only to the FeedApp application:

- URL: `${PUBLIC_APP_URL_OR_LOCAL_ORIGIN}/api/mcp`
- Auth type: `api_key`
- API key: the same value configured in FeedApp as `FEEDBACK_MCP_API_KEY`

FeedApp calls chat-management at `${CHAT_MANAGEMENT_API_URL}/chat-v2/legacy` with `X-App-Key: CHAT_MANAGEMENT_APP_KEY` and the current FeedApp session token as `Authorization: Bearer <session>`. Generated bot replies are draft-only: FeedApp either reuses a tool-created approval ID returned by chat-management or stores the returned draft through the existing customer reply approval flow.

When enabled, the staff dashboard shows a floating FeedApp assistant. The assistant posts to FeedApp-owned `/api/agent/chat`, which adds FeedApp operational instructions and forwards the request to chat-management. The registered FeedApp MCP server currently exposes read/recommend tools for feedback counts, filtered case lists, case context, product knowledge search, assignable-user lookup, and next-action recommendations, plus draft-only reply and internal-note tools.

For status transitions and assignments, chat-management can return a `proposedActions` array. FeedApp renders each proposed action as a confirmation card in the assistant. Confirmed actions post to `/api/agent/actions` and execute through the existing FeedApp case service with the current user's permissions; dismissed, confirmed, and failed actions are audited.

## Architecture Direction

The first production version should remain a modular monolith with clear module boundaries. Use managed Postgres, a queue/worker runtime, object storage, first-party email/password authentication with app provisioning, provider adapters for email/SMS, and REST/webhook ingestion for external systems. Keep SSO optional for a later company identity-provider integration.

MCP should be added later as a permission-aware tool layer over the same backend services, not as the v1 integration foundation.
