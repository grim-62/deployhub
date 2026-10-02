# DeployHub on AWS EC2

Follow this guide from top to bottom to publish the complete DeployHub repository to GitHub, create an Ubuntu EC2 server, and start the app with Docker Compose. The client, API, PostgreSQL, and Nginx are deployed together from this one repository.

Example domain used below: `deployhub.prashant.in`. Replace it everywhere if your actual domain is different.

## 1. Push the project to GitHub

Run these commands in a terminal on your development computer from the DeployHub repository root:

```sh
git status --short
git check-ignore .env
git add -A
git status --short
git commit -m "Prepare DeployHub for EC2 deployment"
git push -u origin main
```

If your default branch is not `main`, replace `main` with the branch shown by `git branch --show-current`. The `.env` file must be ignored and must not appear in `git status`; never push production secrets, TLS certificates, or `.env` to GitHub. If `git push` says there is no `origin`, create an empty GitHub repository and connect it with:

```sh
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

## 2. Create the EC2 instance

In AWS, launch an **Ubuntu Server 24.04 LTS** instance. For a small test deployment, choose at least 2 vCPUs, 4 GB RAM, and 20 GB storage; real build workloads may need more. Create or select a key pair and download its `.pem` file. Allocate and associate an Elastic IP so the address does not change when the instance is stopped and started.

Create a security group with these inbound rules:

| Port | Protocol | Source | Purpose |
| --- | --- | --- | --- |
| 22 | TCP | Your current public IP only | SSH |
| 80 | TCP | Anywhere (IPv4 and IPv6) | HTTP to HTTPS redirect |
| 443 | TCP | Anywhere (IPv4 and IPv6) | HTTPS |

Do not open PostgreSQL `5432`, API `5000`, client `8080`, or project container ports to the internet. The Compose stack only publishes host ports `80` and `443`.

Connect from your computer. On Linux/macOS/Git Bash, run:

```sh
ssh -i YOUR_KEY.pem ubuntu@EC2_ELASTIC_IP
```

On Windows PowerShell, run:

```powershell
ssh -i .\YOUR_KEY.pem ubuntu@EC2_ELASTIC_IP
```

The remote Linux account is `ubuntu`, not `root`. Once connected, the prompt will be on the EC2 machine.

## 3. Install Docker and Git on EC2

Run these commands in the SSH session on EC2:

```sh
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git certbot dnsutils
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
```

Use `sudo docker compose` for the commands below. Adding `ubuntu` to the Docker group grants root-equivalent control of the machine, so this guide does not do that.

## 4. Configure DNS

At the DNS provider for your domain, point both the DeployHub host and the project subdomains at the EC2 Elastic IP. For `deployhub.prashant.in`, add:

| Name | Type | Value |
| --- | --- | --- |
| `deployhub` | A | `EC2_ELASTIC_IP` |
| `*.deployhub` | A | `EC2_ELASTIC_IP` |

The wildcard record allows project URLs under `*.deployhub.prashant.in`. Wait until these return the Elastic IP before continuing:

```sh
dig +short deployhub.prashant.in
dig +short test.deployhub.prashant.in
```

If your DNS provider uses a different record-name format, enter the equivalent fully qualified names `deployhub.prashant.in` and `*.deployhub.prashant.in`.

## 5. Clone the GitHub repository on EC2

Still in the EC2 SSH session, clone the repository you pushed in step 1:

```sh
git clone YOUR_GITHUB_REPOSITORY_URL deployhub
cd deployhub
```

Use the HTTPS or SSH clone URL shown by GitHub. For a private repository, configure an SSH deploy key for EC2 or another secure non-interactive GitHub authentication method before cloning; do not put a personal access token in the clone URL.

## 6. Configure GitHub OAuth

Before starting the app, create an OAuth App in GitHub under **Settings > Developer settings > OAuth Apps > New OAuth App**:

- Homepage URL: `https://deployhub.prashant.in`
- Authorization callback URL: `https://deployhub.prashant.in/api/auth/github/callback`

Keep the generated client ID and secret available for the `.env` setup below. DeployHub requests the `repo` scope to access repositories allowed by the signing-in GitHub account.

## 7. Create the production .env file

Generate three separate values on EC2:

```sh
openssl rand -hex 24
openssl rand -hex 48
openssl rand -hex 32
```

Use the first output as `POSTGRES_PASSWORD`, the second as `SESSION_SECRET`, and the third as `DEPLOYMENT_ENCRYPTION_KEY`. Keep the encryption key stable and backed up; changing it makes previously saved project environment variables unreadable.

Create the local environment file on EC2 and edit it:

```sh
cp .env.example .env
nano .env
```

Set the values below. Replace every `REPLACE_...` and `YOUR_...` value, and use the same generated database password in both places:

```dotenv
POSTGRES_USER=postgres
POSTGRES_PASSWORD=REPLACE_WITH_FIRST_HEX_OUTPUT
POSTGRES_DB=deployhub
DATABASE_URL=postgresql://postgres:REPLACE_WITH_FIRST_HEX_OUTPUT@localhost:5432/deployhub
PORT=5000
CLIENT_URL=https://deployhub.prashant.in
GITHUB_CLIENT_ID=YOUR_GITHUB_OAUTH_CLIENT_ID
GITHUB_CLIENT_SECRET=YOUR_GITHUB_OAUTH_CLIENT_SECRET
GITHUB_CALLBACK_URL=https://deployhub.prashant.in/api/auth/github/callback
SESSION_SECRET=REPLACE_WITH_SECOND_HEX_OUTPUT
DEPLOYMENT_DOMAIN=deployhub.prashant.in
DEPLOYMENT_PROTOCOL=https
DEPLOYMENT_ENCRYPTION_KEY=REPLACE_WITH_THIRD_HEX_OUTPUT
TLS_CERT_DIR=./certs
```

Save in nano with `Ctrl+O`, Enter, then `Ctrl+X`. The `.env` file is ignored by Git. Do not commit it or paste its contents into chat or tickets.

`DATABASE_URL` uses `localhost` in the shared file for running the API directly during local development. Docker Compose overrides it inside the server container to use the private `postgres` service hostname; do not change the `.env` value to `postgres` for this single-file setup.

## 8. Create the wildcard HTTPS certificate

The certificate must cover the main DeployHub host and its project subdomains. Certbot's DNS-01 challenge requires you to add the TXT record it prints at your DNS provider. Run this on EC2 from the `deployhub` directory:

```sh
mkdir -p certs
DOMAIN=deployhub.prashant.in
sudo certbot certonly --manual --preferred-challenges dns \
  --config-dir "$PWD/certs" \
  --work-dir "$PWD/certs/work" \
  --logs-dir "$PWD/certs/logs" \
  -d "$DOMAIN" -d "*.$DOMAIN"
```

When prompted, create the requested `_acme-challenge` TXT record and wait for it to propagate before pressing Enter in Certbot. The expected files are:

```text
certs/live/deployhub.prashant.in/fullchain.pem
certs/live/deployhub.prashant.in/privkey.pem
```

The manual DNS certificate does not renew automatically. Repeat the DNS-01 process before expiry and restart Nginx after renewing. Keep `certs/` private; it is Git-ignored.

## 9. Validate and start DeployHub

From the EC2 `deployhub` directory:

```sh
sudo docker compose config -q
sudo docker compose up -d --build
sudo docker compose ps
```

Check logs if a service is not healthy:

```sh
sudo docker compose logs --tail=100 postgres server client nginx
```

When the services are up, open `https://deployhub.prashant.in`, sign in with GitHub, select a repository, choose Frontend or Backend, configure the branch and environment variables, and deploy. The app shows deployment status/logs, then opens the project detail page when deployment becomes live.

## 10. Publish later code changes

After making and testing code changes on your development computer, push them:

```sh
git add -A
git commit -m "Describe the change"
git push
```

Then SSH into EC2 and update/rebuild the running app:

```sh
cd ~/deployhub
git pull --ff-only
sudo docker compose up -d --build
sudo docker compose ps
```

The database uses the persistent `postgres_data` volume, so ordinary rebuilds do not delete projects. Never run `docker compose down -v` unless you intentionally want to delete the database volume and all stored app data.

## Network and security notes

- Nginx is the only Compose service publishing ports on the EC2 host.
- PostgreSQL, API, and client communicate on the private Compose network.
- Project containers use a separate Docker network shared with Nginx, not PostgreSQL.
- The API mounts `/var/run/docker.sock` to build and run project containers. Access to the EC2 host, API, and OAuth credentials must be tightly controlled; Docker socket access is effectively root access.
- Project containers do not receive the Docker socket and are configured with resource limits and reduced privileges.
- PostgreSQL data persists in the `postgres_data` volume. Back it up regularly.
- Back up `DEPLOYMENT_ENCRYPTION_KEY` separately and preserve it during updates.

## Troubleshooting

Check service status and recent logs:

```sh
sudo docker compose ps
sudo docker compose logs --tail=200 server nginx postgres
```

If OAuth fails, confirm `CLIENT_URL`, `GITHUB_CALLBACK_URL`, OAuth credentials, and the registered callback URL match exactly. If the main site works but project subdomains do not, check the wildcard DNS record, wildcard certificate, and `deployhub_deployments` network. If a project deployment fails, inspect its deployment logs; common causes include a missing Node `build`/`start` script, an invalid branch, Docker problems, or an app that does not listen on `0.0.0.0` and `PORT`.

After changing Compose configuration, recreate the affected services with:

```sh
sudo docker compose up -d --force-recreate server nginx
```
