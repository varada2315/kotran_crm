# Kotran VPS Deployment

## What runs in production

- `Kotran` app name
- `Growitate` and `DeploidX CRM` as workspaces
- React frontend built to static files
- Express API serving `/api/*`
- PostgreSQL for persistent data

In production, the API serves the built frontend too, so you only need one public process on the VPS.

## Requirements

- Ubuntu/Debian VPS
- Node.js 24
- pnpm
- PostgreSQL 15+ recommended
- nginx recommended as reverse proxy
- pm2 or systemd for process management

## Environment

Create a `.env` file from `.env.example`.

Required values:

- `NODE_ENV=production`
- `PORT=5000`
- `BASE_PATH=/`
- `JWT_SECRET=<long-random-secret>`
- `DATABASE_URL=<postgres-connection-string>`

## PostgreSQL setup example

```bash
sudo -u postgres psql
CREATE DATABASE kotran_crm;
CREATE USER kotran_user WITH PASSWORD 'strong-password';
GRANT ALL PRIVILEGES ON DATABASE kotran_crm TO kotran_user;
\q
```

Example `DATABASE_URL`:

```bash
postgresql://kotran_user:strong-password@127.0.0.1:5432/kotran_crm
```

## Install and build

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
pnpm --filter @workspace/db run push
pnpm run build:prod
```

## Start app

```bash
set -a
source .env
set +a
pnpm start
```

The app will start on `http://127.0.0.1:5000`.

## PM2 example

```bash
pm2 start "pnpm start" --name kotran --cwd /var/www/Kotran_CRM
pm2 save
pm2 startup
```

## nginx reverse proxy example

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Important notes

- Production requires `DATABASE_URL`. The in-memory dev fallback will not run in production.
- Run `pnpm --filter @workspace/db run push` whenever schema changes are deployed.
- The frontend build is served by the API from `artifacts/growitate-crm/dist/public`.
- If you use HTTPS, terminate TLS at nginx or Caddy.
