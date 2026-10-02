# DeployHub Feature Flow and Deployment Guide

This document explains how the DeployHub workflow works, which parts are implemented, and how to deploy to a real server with a custom domain.

## 1. Feature status summary

### Implemented and validated locally

- GitHub OAuth sign-in flow and session handling in the server
- Repository listing and repository selection in the UI
- Service type selection: frontend or backend
- Pre-deployment configuration screen for branch and environment variables
- Project creation and deployment queue API
- Deployment status detail page with live logs
- Project detail page with production URL and management actions
- Client build/lint validation passed in this workspace

### Still external runtime dependencies

These features cannot be fully proven without a real deployment host:

- Docker-based project builds and runtime containers
- PostgreSQL persistence in production
- TLS and wildcard domain certificates
- Public custom domain routing
- Real GitHub OAuth callback over HTTPS

This means the flow is implemented, but a real deployed app needs a server with Docker, a public IP, DNS, and valid OAuth credentials.

---

## 2. How the app flow works

### Step 1: User signs in with GitHub

The app uses GitHub OAuth and requests repository access (`repo` scope). The server stores the token and uses it server-side to fetch repositories and verify repository ownership.

Important behavior:

- The browser does not receive the GitHub token directly.
- The token remains on the server and is used for repository access.
- Auth is enforced through a session cookie.

### Step 2: Repository selection

After login, the user opens the project creation flow and selects a GitHub repository. The repository list is fetched from the server, filtered by search/visibility, and each repository can be opened on GitHub or selected for deployment.

### Step 3: Service type selection

Once a repository is selected, the user chooses the project runtime:

- Frontend
- Backend

This is required before moving to configuration.

### Step 4: Pre-deployment configuration

The app loads the chosen repository metadata and asks for:

- branch to deploy
- extra environment variables

Environment values are validated before being stored and are encrypted before persistence.

### Step 5: Project creation

The backend creates a project record linked to the GitHub repository and the selected runtime. The project is stored with metadata such as:

- project type
- GitHub repository
- branch
- status
- creation time
- optional production URL

### Step 6: Deployment queue

The user clicks Deploy Project. The backend creates a deployment record and queues the deployment worker.

Deployment status lifecycle:

- QUEUED
- BUILDING
- DEPLOYING
- LIVE
- FAILED

### Step 7: Deployment detail page

The user is taken to the deployment details page while the deployment is running. That page polls the server and shows:

- deployment status
- project and repo info
- commit SHA
- logs
- public deployment URL when available

### Step 8: Live deployment and project management

When the status becomes LIVE:

- the backend updates both the deployment row and the project row
- the project gets a `production_url`
- the UI redirects to the project details page
- the user sees the application URL and a Manage Project action

This is the expected final user experience: deploy -> monitor -> land on the project page -> manage or open the app.

---

## 3. Actual project architecture

### Frontend

The React app handles:

- GitHub login flow
- repository selection
- project creation wizard
- deployment monitoring
- project detail management

Routes include:

- /login
- /dashboard
- /projects
- /projects/new
- /projects/new/configure
- /projects/:id
- /deployments/:id

### Backend

The Express server contains:

- auth routes
- GitHub repository routes
- project and deployment APIs
- session handling
- deployment runner integration

The server is responsible for:

- GitHub OAuth exchange
- token persistence
- repository access checks
- deployment queue logic
- runtime builds for generated app containers

### Persistence

PostgreSQL stores:

- users
- GitHub auth records
- projects
- deployments
- activity logs
- deployment URLs and commit information

---

## 4. Deployment flow in production

### Required external environment

You need:

- Ubuntu server or EC2 instance
- Docker Engine + Docker Compose
- PostgreSQL accessible inside the Compose network
- Public IP and DNS record
- wildcard TLS certificate
- GitHub OAuth application

### Required values in .env

Example:

```dotenv
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@postgres:5432/deployhub
CLIENT_URL=https://deployhub.prashant.in
GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=YOUR_GITHUB_CLIENT_SECRET
GITHUB_CALLBACK_URL=https://deployhub.prashant.in/api/auth/github/callback
SESSION_SECRET=YOUR_STRONG_SESSION_SECRET
DEPLOYMENT_DOMAIN=deployhub.prashant.in
DEPLOYMENT_PROTOCOL=https
DEPLOYMENT_ENCRYPTION_KEY=YOUR_64_CHAR_HEX_KEY
```

Notes:

- `SESSION_SECRET` must be at least 32 characters
- `DEPLOYMENT_ENCRYPTION_KEY` must stay stable
- if you rotate it, previously saved env vars become unreadable

---

## 5. Deployment guide for AWS / EC2

### 1) Create EC2 instance

Create an Ubuntu server and keep a fixed public IP. Open only:

- 22 for SSH
- 80 for HTTP
- 443 for HTTPS

Do not expose PostgreSQL or app internals to the internet.

### 2) Install Docker and cert tooling

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git certbot
sudo systemctl enable docker
sudo systemctl start docker
```

### 3) Clone the repo

```bash
git clone YOUR_REPOSITORY_URL deployhub
cd deployhub
cp .env.example .env
nano .env
```

### 4) Configure GitHub OAuth

In GitHub, create an OAuth app and set:

- Homepage URL: `https://deployhub.prashant.in`
- Callback URL: `https://deployhub.prashant.in/api/auth/github/callback`

Copy the client ID and secret into `.env`.

### 5) Configure domain DNS

For the main DeployHub host:

```text
deployhub    A    EC2_PUBLIC_IP
```

If you want the deployed project URLs to live under the same subdomain root, also add:

```text
*.deployhub  A    EC2_PUBLIC_IP
```

If you prefer the platform to live on `prashant.in` and project subdomains under `*.prashant.in`, then set the root domain accordingly and use the wildcard record for that zone instead.

### 6) Request wildcard TLS certificate

```bash
mkdir -p certs
sudo certbot certonly --manual --preferred-challenges dns \
  --config-dir "$PWD/certs" \
  --work-dir "$PWD/certs/work" \
  --logs-dir "$PWD/certs/logs" \
  -d deployhub.prashant.in \
  -d "*.deployhub.prashant.in"
```

This creates the certificate files the stack expects under `certs/live/...`.

### 7) Start the stack

```bash
sudo docker compose config -q
sudo docker compose up -d --build
sudo docker compose ps
```

### 8) Validate access

Open the main app at:

```text
https://deployhub.prashant.in
```

Then:

1. sign in with GitHub
2. select a repository
3. choose Frontend or Backend
4. configure branch and env variables
5. click Deploy Project
6. wait for `LIVE`
7. open the project detail page
8. use the production URL or Manage Project action

---

## 6. Custom domain example: deployhub.prashant.in

If your main domain is `prashantxu.in` and you want DeployHub at `deployhub.prashant.in`, the target setup is:

- `deployhub.prashant.in` -> EC2 public IP
- wildcard subdomain for project apps, for example `*.deployhub.prashant.in` -> EC2 public IP

Recommended `.env` values:

```dotenv
CLIENT_URL=https://deployhub.prashant.in
GITHUB_CALLBACK_URL=https://deployhub.prashant.in/api/auth/github/callback
DEPLOYMENT_DOMAIN=deployhub.prashant.in
DEPLOYMENT_PROTOCOL=https
```

If the app should generate URLs using the root domain `prashant.in`, change `DEPLOYMENT_DOMAIN` and DNS records to match your chosen root layout.

---

## 7. Operational notes

### Live URL behavior

The product is designed to do this after `LIVE`:

- update the deployment row with the final URL
- update the project row with the production URL
- redirect the user to the project detail page
- show a clickable management link and application link

### Project container details

The runtime layer is designed to:

- build frontend and backend projects separately
- expose the application behind Nginx
- keep project containers isolated from the database network
- require a valid build/start script in the app repo

### Important pitfalls

- GitHub callback must match the actual host exactly
- the wildcard certificate must cover the domain you use
- the Docker socket must be available on the server for the deployment worker
- environment variables must be preserved and not regenerated in production unexpectedly

---

## 8. Validation performed in this workspace

I verified the client side in this workspace with:

```bash
cd /c/something-pd/deployhub/client
node --test src/utils/deploymentFlow.test.js
npm run build
npm run lint
```

The result was:

- regression tests passed
- Vite build succeeded
- ESLint passed

The full live public deployment still requires an external Docker-enabled server, valid OAuth credentials, and domain/TLS setup.

---

## 9. Recommended next steps

1. Configure a real EC2 instance with Docker installed
2. Set `.env` values for your own domain and GitHub OAuth app
3. Create DNS records for `deployhub.prashant.in` and wildcard subdomains
4. Request the TLS certificate
5. Run `docker compose up -d --build`
6. Sign in, create a project, and verify the deployment reaches `LIVE`
7. Confirm the project detail page shows the public URL and management link

This is the final path the app expects once it is running on a real public environment.
