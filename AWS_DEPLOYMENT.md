# DeployHub on AWS EC2

This guide deploys DeployHub to one Ubuntu EC2 instance using Docker Compose. It assumes you have a GitHub repository for this project, a domain you control, and permission to create DNS records for that domain.

## 1. Create the EC2 instance

Create an Ubuntu 24.04 LTS instance. Allocate an Elastic IP and associate it with the instance so its address remains stable.

Configure the EC2 security group with these inbound rules only:

| Port | Protocol | Source | Purpose |
| --- | --- | --- | --- |
| 22 | TCP | Your IP address | SSH administration |
| 80 | TCP | 0.0.0.0/0 and ::/0 | HTTP redirect to HTTPS |
| 443 | TCP | 0.0.0.0/0 and ::/0 | HTTPS application traffic |

Do not expose PostgreSQL `5432`, API `5000`, client `3000`/`8080`, or deployment ports `31000-65535`. The Compose stack only publishes `80` and `443`.

Connect to the instance using your EC2 key pair:

```sh
ssh -i YOUR_KEY.pem ubuntu@EC2_PUBLIC_IP
```

## 2. Install Docker and Git

```sh
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git certbot
sudo systemctl enable docker
sudo systemctl start docker
sudo docker version
sudo docker compose version
```

Use `sudo docker compose` for the commands below unless you have deliberately configured the `ubuntu` user for Docker access. Membership in the Docker group grants root-equivalent access to the instance.

## 3. Point the domain to EC2

At your DNS provider, create these records using the Elastic IP:

| Name | Type | Value |
| --- | --- | --- |
| `@` | A | `EC2_PUBLIC_IP` |
| `*` | A | `EC2_PUBLIC_IP` |

The wildcard record is required for per-project subdomains. Wait for DNS propagation before requesting the certificate. You can check with:

```sh
dig +short YOUR_DOMAIN
dig +short test.YOUR_DOMAIN
```

Both commands should return the Elastic IP.

## 4. Clone and configure DeployHub

```sh
git clone YOUR_GIT_REPOSITORY_URL deployhub
cd deployhub
cp .env.example .env
nano .env
```

Set these values in `.env`:

```dotenv
NODE_ENV=production
POSTGRES_USER=postgres
POSTGRES_PASSWORD=REPLACE_WITH_RANDOM_HEX
POSTGRES_DB=deployhub
DATABASE_URL=postgresql://postgres:REPLACE_WITH_RANDOM_HEX@postgres:5432/deployhub
PORT=5000
CLIENT_URL=https://YOUR_DOMAIN
GITHUB_CLIENT_ID=YOUR_GITHUB_OAUTH_CLIENT_ID
GITHUB_CLIENT_SECRET=YOUR_GITHUB_OAUTH_CLIENT_SECRET
GITHUB_CALLBACK_URL=https://YOUR_DOMAIN/api/auth/github/callback
SESSION_SECRET=REPLACE_WITH_RANDOM_HEX
DEPLOYMENT_DOMAIN=YOUR_DOMAIN
DEPLOYMENT_PROTOCOL=https
DEPLOYMENT_ENCRYPTION_KEY=REPLACE_WITH_64_HEX_CHARACTERS
TLS_CERT_DIR=./certs
```

Generate strong values on the EC2 instance and paste them into `.env`:

```sh
openssl rand -hex 24
openssl rand -hex 48
openssl rand -hex 32
```

Use the first output for `POSTGRES_PASSWORD` and the same value in `DATABASE_URL`; the second for `SESSION_SECRET`; and the third for `DEPLOYMENT_ENCRYPTION_KEY`. Keeping these values stable is important: changing the encryption key makes saved project environment variables unreadable. Use the generated hexadecimal PostgreSQL password as-is so it does not require URL encoding.

Do not commit or share `.env`. It contains the database password, session secret, OAuth secret, and encryption key.

## 5. Create the wildcard TLS certificate

The Nginx service expects these files inside the mounted `certs` directory:

```text
certs/live/YOUR_DOMAIN/fullchain.pem
certs/live/YOUR_DOMAIN/privkey.pem
```

Request a wildcard certificate using DNS-01 validation. Certbot will print a TXT record name and value; add that TXT record at your DNS provider and wait until it is visible before continuing in Certbot.

```sh
DOMAIN=YOUR_DOMAIN
mkdir -p certs
sudo certbot certonly --manual --preferred-challenges dns \
  --config-dir "$PWD/certs" \
  --work-dir "$PWD/certs/work" \
  --logs-dir "$PWD/certs/logs" \
  -d "$DOMAIN" -d "*.$DOMAIN"
```

If Certbot reports a permissions error, ensure the `certs` directory is writable by the Certbot process. The private key must remain readable by the Nginx container and must not be committed; `certs/` is ignored by Git.

This manual DNS certificate does not renew automatically. Before it expires, repeat the DNS-01 renewal process and restart Nginx:

```sh
sudo docker compose restart nginx
```

## 6. Configure GitHub OAuth

In GitHub, open **Settings > Developer settings > OAuth Apps > New OAuth App** and set:

- Application URL: `https://YOUR_DOMAIN`
- Authorization callback URL: `https://YOUR_DOMAIN/api/auth/github/callback`

Copy the generated client ID and client secret into `.env` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. DeployHub requests the `repo` scope so it can read private repositories that the authorizing account can access. The token stays server-side.

## 7. Validate and start the stack

From the repository root, validate Compose without printing resolved secrets, then build and start:

```sh
sudo docker compose config -q
sudo docker compose up -d --build
sudo docker compose ps
```

Follow startup logs if a service is unhealthy:

```sh
sudo docker compose logs --tail=100 server nginx postgres
```

Database migrations run automatically before the API starts. PostgreSQL data is stored in the named `postgres_data` volume. Back up this volume regularly; deleting it removes DeployHub users, projects, and deployment history.

Open `https://YOUR_DOMAIN`, sign in with GitHub, select a repository, choose Frontend or Backend, configure the branch and environment variables, and deploy. Project URLs use this form:

```text
https://project-name-PROJECT_ID.YOUR_DOMAIN
```

## 8. Network and deployment security

- Nginx is the only service publishing ports on the EC2 host.
- PostgreSQL, API, and client communicate on the private Compose network.
- Deployed projects use the separate `deployhub_deployments` Docker network shared with Nginx, not the PostgreSQL network.
- The API container mounts `/var/run/docker.sock` because it builds and runs project containers. Treat the API host and OAuth credentials as highly trusted.
- Deployed application containers do not mount the Docker socket. They run with memory/CPU/PID limits, dropped capabilities, and `no-new-privileges`.
- Environment variables are encrypted in PostgreSQL. Back up `DEPLOYMENT_ENCRYPTION_KEY` separately and preserve it during upgrades.

## Troubleshooting

Check service health and recent output:

```sh
sudo docker compose ps
sudo docker compose logs --tail=200 server nginx
```

If OAuth returns to login with an error, confirm the OAuth callback exactly matches `GITHUB_CALLBACK_URL`, and verify `CLIENT_URL`, the database connection, and all OAuth values in `.env`.

If a deployment fails, open its DeployHub deployment details page for persisted logs. Common causes include an invalid branch, missing `build` or `start` script, an unsupported repository layout, unavailable Docker daemon, incorrect wildcard DNS, or missing/expired TLS files.

If the main domain works but project subdomains do not, verify the wildcard A record, certificate includes `*.YOUR_DOMAIN`, the runner's deployment network is `deployhub_deployments`, and Nginx is healthy.

Compose configuration changes require recreating the affected services:

```sh
sudo docker compose up -d --force-recreate server nginx
```
