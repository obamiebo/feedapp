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
For direct HTTP beta testing, set `SESSION_COOKIE_SECURE=false`; switch it to `true` after HTTPS is configured.

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

Example report submission:

```bash
curl -X POST http://localhost:3000/api/ingestion/reports \
  -H 'content-type: application/json' \
  -H 'x-feedback-source: commerce-platform' \
  -H 'x-feedback-secret: commerce-secret-123' \
  -d '{
    "sourceSystem": "commerce-platform",
    "externalId": "COM-DEMO-1001",
    "title": "Checkout failed",
    "description": "Customer cannot complete checkout from the product form.",
    "priority": "High",
    "customer": {
      "externalId": "cust-demo-1001",
      "name": "Demo Customer",
      "email": "demo.customer@example.com"
    }
  }'
```

## Architecture Direction

The first production version should remain a modular monolith with clear module boundaries. Use managed Postgres, a queue/worker runtime, object storage, first-party email/password authentication with app provisioning, provider adapters for email/SMS, and REST/webhook ingestion for external systems. Keep SSO optional for a later company identity-provider integration.

MCP should be added later as a permission-aware tool layer over the same backend services, not as the v1 integration foundation.
