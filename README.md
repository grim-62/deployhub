# DeployHub

DeployHub is a learning-focused GitHub-to-container deployment platform. It uses React/Vite, Express, PostgreSQL, Docker, and Nginx. GitHub tokens stay on the server; application containers do not receive the Docker socket.

For EC2 provisioning, environment configuration, wildcard TLS, and Compose deployment, see [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md). For the end-to-end feature flow and production deployment expectations, see [FLOW_AND_DEPLOYMENT_GUIDE.md](FLOW_AND_DEPLOYMENT_GUIDE.md).

## Local Development

Requirements: Node.js 20.19+ or 22.12+, npm, and PostgreSQL.

Install dependencies and start the API and client:

```sh
npm install
npm --prefix client install
npm --prefix server install
cp .env.example .env
npm run dev
```

Use the repository-root `.env` as the only environment file for the API, Vite, and Docker Compose. Vite reads only the public `VITE_` settings from it; never put secrets in `VITE_` variables. `VITE_API_URL=/api` works locally through the Vite proxy and in production through Nginx. For local development, leave `NODE_ENV` unset, use a local PostgreSQL URL such as `postgresql://postgres:YOUR_PASSWORD@localhost:5432/deployhub`, set `CLIENT_URL=http://localhost:5173`, and use `GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback`. Fill in your GitHub OAuth credentials and a `SESSION_SECRET` of at least 32 characters. Docker Compose sets `NODE_ENV=production` for the server container. For EC2, use the production values described in [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md). The Vite app runs at `http://localhost:5173`; the API runs at `http://localhost:5000`.

## EC2 Deployment

Use one Ubuntu EC2 instance. In its security group, allow inbound `22` (SSH), `80` (HTTP), and `443` (HTTPS). Do not open `5432`, `5000`, `3000`, or the project container port range to the internet.

Install Docker, Compose, Git, and Certbot:

```sh
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git certbot
sudo systemctl enable docker
sudo systemctl start docker
```

Clone the repository and create the deployment environment:

```sh
git clone YOUR_REPOSITORY
cd deployhub
cp .env.example .env
nano .env
```

Set a strong `POSTGRES_PASSWORD` and use the same value in `DATABASE_URL`. Use an alphanumeric password to avoid URL-encoding characters. Set `DEPLOYMENT_DOMAIN`, `CLIENT_URL`, and `GITHUB_CALLBACK_URL` to your domain. Generate `SESSION_SECRET` with `openssl rand -hex 48` and `DEPLOYMENT_ENCRYPTION_KEY` with `openssl rand -hex 32`. Keep `.env` private; the encryption key must remain stable or saved project variables cannot be decrypted.

Create DNS records pointing to the EC2 public IP:

```text
example.com      A   EC2_PUBLIC_IP
*.example.com    A   EC2_PUBLIC_IP
```

Create a wildcard TLS certificate with a DNS-01 challenge. Replace the example domain with the value of `DEPLOYMENT_DOMAIN`; Certbot will prompt for DNS TXT records. The Compose Nginx service expects the certificate at `certs/live/DOMAIN/fullchain.pem` and `certs/live/DOMAIN/privkey.pem`.

```sh
mkdir -p certs
sudo certbot certonly --manual --preferred-challenges dns \
	--config-dir "$PWD/certs" --work-dir "$PWD/certs/work" --logs-dir "$PWD/certs/logs" \
	-d example.com -d '*.example.com'
```

Manual DNS certificates do not renew automatically. Repeat the DNS-01 renewal before the certificate expires, then restart Nginx:

```sh
docker compose restart nginx
```

Create a GitHub OAuth App in **Settings > Developer settings > OAuth Apps > New OAuth App**. Set the application URL to `https://YOUR_DOMAIN` and callback URL to `https://YOUR_DOMAIN/api/auth/github/callback`. Copy the OAuth client ID and secret into `.env`.

Start the application:

```sh
docker compose up -d --build
docker compose ps
docker compose logs -f server
```

Database migrations run automatically before the API starts. PostgreSQL data persists in the `postgres_data` volume. Nginx is the only service publishing host ports; client, API, and database traffic stays on the private application network. Project containers join a separate deployments network shared only with Nginx, so they cannot reach PostgreSQL. The server mounts the Docker socket to build and run deployments, but deployed project containers do not receive that socket and run with dropped capabilities, resource limits, and `no-new-privileges`.

The runner creates project URLs in the form `https://project-name-ID.YOUR_DOMAIN`. Frontend projects are served by an unprivileged Nginx container; backend projects run as the unprivileged Node user. Project containers bind only to the private Docker network. The runner currently expects Node projects with a `package.json` build script for frontends and a `start` script for backends; backend applications must listen on `0.0.0.0` and honor `PORT`.

## GitHub and Project Flow

Sign-in requests GitHub's `repo` scope. The API stores the access token in PostgreSQL and uses it server-side to fetch repositories, verify repository ownership, and clone private repositories for deployment. The browser never receives that token.

Projects are scoped to the authenticated user. The user selects a GitHub repository and chooses Frontend or Backend. Deployments move through `QUEUED`, `BUILDING`, `DEPLOYING`, then `LIVE` or `FAILED`; status and logs are persisted in PostgreSQL and shown on the deployment page.

## Validation

```sh
npm test
npm run build
npm --prefix client run lint
docker compose config
```

`docker compose config` validates Compose interpolation and structure. A real deployment additionally requires valid GitHub OAuth credentials, PostgreSQL, a running Docker Engine, the wildcard DNS records, and the wildcard certificate.