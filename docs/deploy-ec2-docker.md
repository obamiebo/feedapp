# EC2 Docker Deployment

This internal beta deployment runs the Next.js app and Postgres with Docker Compose on one EC2 instance.

The app is exposed on host port `18081` and Postgres is private to the Docker network.

## EC2 Prerequisites

Install Docker, the Docker Compose plugin, Git, and a reverse proxy such as Nginx or Caddy for HTTPS.

Allow inbound traffic for:

- `22` from your admin IP for SSH
- `80` and `443` if using a public domain and HTTPS reverse proxy
- `18081` only temporarily for direct smoke testing, or only from trusted IPs

Do not expose Postgres publicly.

## First Deployment

Clone the repo on the EC2 instance:

```bash
git clone <repo-url> feedback-system
cd feedback-system
```

Create the production env file:

```bash
cp .env.production.example .env.production
nano .env.production
```

Set a long random `POSTGRES_PASSWORD` and `SEED_ADMIN_TEMP_PASSWORD`. Keep messaging providers as `stub` unless live delivery is intentional.

For direct HTTP beta testing on `http://<ec2-host>:18081`, keep:

```bash
SESSION_COOKIE_SECURE=false
```

When HTTPS is configured through Nginx or Caddy, change it to:

```bash
SESSION_COOKIE_SECURE=true
```

Build and start:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Run migrations:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec app npx prisma migrate deploy
```

For the EC2 beta, seed the base roles, baseline Support department, and platform admin:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec app npm run prisma:seed:production
```

This creates `obamiebo@itconsortiumgh.com` as a provisioned platform Admin, plus the base role records and a Support department for product intake routing. It does not create products, product groups, customers, cases, SLA policies, or demo users.

Rerunning `prisma:seed:production` is safe after the admin account is activated; it preserves an existing admin password and activation state.

Check health:

```bash
curl http://localhost:18081/api/health
```

## Common Operations

View logs:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app
```

Restart:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production restart app
```

Deploy a new version:

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec app npx prisma migrate deploy
```

Stop:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production down
```

Do not remove volumes unless you intend to delete the database.

## Database Backup

Create a backup:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres pg_dump -U feedback feedback_hub > feedback_hub_$(date +%Y%m%d_%H%M%S).sql
```

If you changed `POSTGRES_USER` or `POSTGRES_DB`, use those values in the command.

Copy backups off the EC2 instance regularly.

## Reverse Proxy

Put Nginx or Caddy in front of `localhost:18081` for HTTPS. The app container should stay on port `3000` internally; the host publishes it as `18081`.
