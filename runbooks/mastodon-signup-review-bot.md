# Mastodon Signup Review Bot

This runbook documents the deployment of a signup review bot for Mustard.

The bot connects Mastodon's account approval workflow to a private Matrix room. It receives new-account events through a Mastodon webhook, waits for email confirmation, and allows moderators to review signup information before approving or rejecting an account.

## Background

Mustard has received spam registrations using disposable or unusual email domains.

Some of these accounts randomly mention users, while others appear to be automated accounts attempting to collect data from the server. While obvious spam accounts can often be identified manually, distinguishing legitimate users with custom email domains from disposable or abusive accounts becomes increasingly difficult.

Blocking all unusual or custom email domains would also risk rejecting legitimate users.

The signup review bot was introduced to provide moderators with additional information before making an approval decision rather than relying solely on the email domain or profile appearance.

## Architecture

```text
New signup
    │
    ▼
Mastodon (mustard.blog)
    │
    │ account.created webhook
    ▼
Nginx
    │
    │ reverse proxy
    ▼
Signup Review Bot (Docker)
    │
    ├──────────────► Mastodon Admin API
    │
    ▼
Matrix Review Room
    │
    │ approve / reject
    ▼
Signup Review Bot
    │
    ▼
Mastodon Admin API
```

The bot itself listens only on localhost.

```text
https://signup.mustard.blog
            │
            ▼
          Nginx
            │
            ▼
http://127.0.0.1:8080
            │
            ▼
   fedi-signup-bot
```

## Components

- Mastodon
- fedi-signup-bot
- Docker
- Nginx
- Matrix
- Mastodon Admin API
- Mastodon Webhooks

Optional email reputation providers are currently disabled.

## Directory Layout

The signup bot is kept separate from the main Mastodon installation.

```text
/opt/
├── mastodon/
│   ├── docker-compose.yml
│   ├── .env.production
│   └── ...
│
└── mastodon-signup-bot/
    └── bot.yaml
```

`bot.yaml` contains credentials and must never be committed to Git.

Recommended permissions:

```bash
sudo chown root:root /opt/mastodon-signup-bot/bot.yaml
sudo chmod 600 /opt/mastodon-signup-bot/bot.yaml
```

## Matrix Setup

A dedicated Matrix account is used by the signup bot.

The bot account is invited to a private Matrix room used only for signup review.

The review room must remain private because signup information may include:

- Email addresses
- Signup IP addresses
- IP geolocation information
- ASN information
- Moderation decisions

The complete internal Matrix room ID must be used.

Example:

```text
!exampleRoomId:matrix.org
```

Do not use only the opaque portion of the room ID.

The bot automatically joins the room after it has been invited.

## Mastodon Admin API

Create a Mastodon application under:

```text
Preferences → Development → New Application
```

The application requires at least:

```text
admin:read:accounts
admin:write:accounts
```

The generated access token allows the bot to inspect pending accounts and approve or reject them.

Treat this token as a privileged credential.

## Configuration

The bot configuration is stored at:

```text
/opt/mastodon-signup-bot/bot.yaml
```

Example structure:

```yaml
webhook_host: "0.0.0.0"
webhook_port: 8080

matrix:
  homeserver: "https://matrix.example.org"
  user_id: "@mustard_signup:matrix.example.org"
  access_token: "REPLACE_WITH_MATRIX_ACCESS_TOKEN"
  review_room: "!ROOM_ID:matrix.example.org"

email_confirmation:
  poll_interval: 60
  timeout: 86400
  on_timeout: notify

manual_action_poll_interval: 300

email_check:
  - provider: usercheck.com
    enabled: false
    token: ""

  - provider: reacher
    enabled: false
    url: "http://reacher.internal:8080"
    token: ""

mastodon_instances:
  - domain: "mustard.blog"
    access_token: "REPLACE_WITH_MASTODON_ADMIN_TOKEN"
    webhook_secret: "REPLACE_WITH_WEBHOOK_SECRET"
```

Do not put real tokens or secrets in this repository.

Configuration is loaded when the bot starts. Restart the container after modifying `bot.yaml`.

## Docker Deployment

Pull the image:

```bash
docker pull git.fediverse.foundation/ff_pub/fedi-signup-bot:latest
```

Run the bot:

```bash
docker run -d \
  --name fedi-signup-bot \
  -p 127.0.0.1:8080:8080 \
  -v /opt/mastodon-signup-bot/bot.yaml:/app/bot.yaml:ro \
  --restart unless-stopped \
  git.fediverse.foundation/ff_pub/fedi-signup-bot:latest
```

Binding the port to `127.0.0.1` prevents port 8080 from being exposed directly to the Internet.

Check the container:

```bash
docker ps
```

View logs:

```bash
docker logs -f fedi-signup-bot
```

Restart after changing the configuration:

```bash
docker restart fedi-signup-bot
```

## Nginx Reverse Proxy

The public endpoint is:

```text
https://signup.mustard.blog
```

Nginx terminates TLS and forwards requests to the bot on localhost.

Example configuration:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name signup.mustard.blog;

    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;

    server_name signup.mustard.blog;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://127.0.0.1:8080;

        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Before reloading Nginx:

```bash
sudo nginx -t
```

If the test succeeds:

```bash
sudo systemctl reload nginx
```

## Mastodon Webhook

Create a webhook in the Mastodon administration interface.

Event:

```text
account.created
```

Endpoint:

```text
https://signup.mustard.blog/webhook/mustard.blog
```

The final domain component:

```text
mustard.blog
```

must exactly match:

```yaml
mastodon_instances:
  - domain: "mustard.blog"
```

in `bot.yaml`.

The webhook signing secret generated by Mastodon should also be added to the corresponding `webhook_secret` field.

## Health Check

The bot exposes a health endpoint.

Local check:

```bash
curl http://127.0.0.1:8080/health
```

Public check through Nginx:

```bash
curl https://signup.mustard.blog/health
```

A healthy instance returns a response similar to:

```json
{ "status": "ok", "pending": 0 }
```

## Expected Startup Logs

A successful startup should include messages similar to:

```text
mastodon-signup-bot dev starting
Config — email confirmation: poll_interval=60s, timeout=86400s, on_timeout=notify
Config — manual action poll interval: 300s
Config — instance mustard.blog: using global defaults
Joined review room !ROOM_ID:matrix.example.org
Matrix sync loop started as @mustard_signup:matrix.example.org
Webhook listener on http://0.0.0.0:8080
Registered webhook endpoints: /webhook/mustard.blog
```

## Signup Workflow

The intended workflow is:

```text
User submits registration
        │
        ▼
Mastodon sends account.created webhook
        │
        ▼
Bot begins polling account status
        │
        ▼
User confirms email
        │
        ▼
Account remains pending approval
        │
        ▼
Bot posts review card to Matrix
        │
        ├── ✅ / accept ──► Approve
        │
        └── ❌ / reject ──► Reject
```

The bot waits for email confirmation before posting the review card.

With the current configuration:

```yaml
poll_interval: 60
timeout: 86400
on_timeout: notify
```

the account status is checked every 60 seconds and the bot waits up to 24 hours for email confirmation.

## Registration Mode

The signup review workflow is designed for Mastodon instances that require manual approval of new registrations.

If Mastodon automatically approves a registration, the bot may detect that the account has already been approved before it can post a review card.

This was observed during initial testing:

```text
Webhook event=account.created from instance=mustard.blog

[mustard.blog] Polling account status for @test ...

[mustard.blog] @test ... was manually approved before bot posted card

[mustard.blog] @test ... already approved manually — posting notice
```

Therefore, signup approval must be enabled for the bot to function as an actual pre-registration moderation workflow.

## Email Reputation Checks

The bot supports optional email validation through:

- UserCheck
- Reacher

Both are currently disabled:

```yaml
email_check:
  - provider: usercheck.com
    enabled: false

  - provider: reacher
    enabled: false
```

The initial deployment intentionally leaves these providers disabled.

The first goal is to evaluate whether the basic combination of:

- Email confirmation
- IP information
- Geolocation
- ASN information
- Manual Matrix review

provides enough information to improve signup decisions.

Email reputation checks can be enabled later if custom or disposable email domains remain difficult to evaluate.

## Security Notes

### Protect `bot.yaml`

`bot.yaml` contains:

- Matrix access token
- Mastodon Admin API token
- Mastodon webhook signing secret

Never commit this file to Git.

Use restrictive filesystem permissions.

### Protect the Matrix room

The Matrix review room contains private signup information and should only be accessible to trusted moderators.

### Protect the Admin API token

The Mastodon token has administrative account permissions.

A leaked token could potentially be used to approve or reject accounts.

### Do not expose port 8080 directly

The Docker container is bound to:

```text
127.0.0.1:8080
```

External traffic should reach it only through Nginx over HTTPS.

### Use webhook signature verification

Configure `webhook_secret` so the bot can verify that incoming webhook events originate from Mastodon.

## Troubleshooting

### `/app/bot.yaml` is a directory

Observed error:

```text
IsADirectoryError: [Errno 21] Is a directory: '/app/bot.yaml'
```

The bot expects `/app/bot.yaml` to be a file.

Check the host path:

```bash
ls -ld /opt/mastodon-signup-bot/bot.yaml
```

If the path is a directory rather than a file, remove the incorrectly created directory:

```bash
sudo rmdir /opt/mastodon-signup-bot/bot.yaml
```

Then create the actual configuration file:

```bash
sudo nano /opt/mastodon-signup-bot/bot.yaml
```

Verify it:

```bash
file /opt/mastodon-signup-bot/bot.yaml
```

Restart the container after correcting the mount.

### Matrix room ID is rejected

Observed error:

```text
MUnknown: !exampleRoomId was not legal room ID or room alias
```

The incomplete room ID was being used.

Use the complete internal room ID instead:

```text
!exampleRoomId:matrix.example.org
```

Update:

```yaml
review_room: "!exampleRoomId:matrix.example.org"
```

Then restart:

```bash
docker restart fedi-signup-bot
```

Successful connection should produce:

```text
Joined review room !exampleRoomId:matrix.example.org
Matrix sync loop started as @mustard_signup:matrix.example.org
```

### Webhook URL returns HTTP 405 in a browser

Opening:

```text
https://signup.mustard.blog/webhook/mustard.blog
```

in a browser may produce:

```text
405 Method Not Allowed
```

This is expected.

A browser sends a `GET` request, while the endpoint is intended to receive webhook `POST` requests from Mastodon.

A successful Mastodon request appears in the logs as:

```text
Webhook event=account.created from instance=mustard.blog
```

followed by an access log similar to:

```text
POST /webhook/mustard.blog HTTP/1.1" 200
```

### `/favicon.ico` returns HTTP 404

A browser may automatically request:

```text
/favicon.ico
```

and receive:

```text
404
```

This is unrelated to the signup bot and can be ignored.

### Bot repeatedly restarts

Inspect the logs:

```bash
docker logs --tail 100 fedi-signup-bot
```

or follow them in real time:

```bash
docker logs -f fedi-signup-bot
```

A configuration or startup failure combined with:

```text
--restart unless-stopped
```

can cause the container to repeatedly restart.

Fix the underlying error and restart the container.

### Bot shuts down with SIGTERM

Logs such as:

```text
Received signal SIGTERM — initiating graceful shutdown
Shutting down …
Shutdown complete.
```

are expected when the container is deliberately restarted or stopped.

If immediately followed by a new startup sequence after running:

```bash
docker restart fedi-signup-bot
```

this indicates a normal graceful restart.

### Signup is detected but no review card appears

Check the logs for:

```text
Webhook event=account.created from instance=mustard.blog
```

and:

```text
Polling account status for @username
```

If these appear, the webhook is working.

The bot waits for email confirmation before posting the review card.

If the account is approved through Mastodon before the card is posted, the bot may instead report:

```text
was manually approved before bot posted card
```

In that case, test again with an account that remains pending after email confirmation.

### Testing the complete workflow

For an end-to-end test:

1. Enable approval-based registration in Mastodon.
2. Create a test account.
3. Confirm the test account's email address.
4. Do not approve the account manually in Mastodon.
5. Watch the bot logs:

```bash
docker logs -f fedi-signup-bot
```

6. Wait for the Matrix review card.
7. React with ✅ or reply `accept`.
8. Confirm that the account becomes approved in Mastodon.

Repeat with another test account using ❌ or `reject` if rejection behavior also needs to be verified.

### Review card appears but no mobile push notification is generated

The main moderator-facing review card must use `m.text` rather than `m.notice`
when a mobile push notification is expected.

Thread replies and status messages may remain `m.notice` to avoid notification noise.

See:

[Matrix Signup Bot push notifications](../operations/matrix-signup-bot-push-notifications.md)

## Initial Deployment Verification

The following parts of the deployment have been verified:

- Docker container starts successfully.
- Configuration is loaded.
- Matrix review room is joined successfully.
- Matrix sync loop starts successfully.
- Webhook listener starts on port 8080.
- `/webhook/mustard.blog` is registered.
- Local health check returns HTTP 200.
- Public HTTPS health check through Nginx returns successfully.
- Mastodon sends `account.created` events successfully.
- The webhook endpoint returns HTTP 200 to Mastodon.
- The bot begins polling newly created accounts.
- The bot detects an account that was approved before the review card was posted.

The Matrix approve/reject workflow should be tested separately with Mastodon registration approval enabled.

## Future Improvements

Possible improvements after evaluating the initial deployment:

- Enable UserCheck for disposable email detection.
- Deploy a self-hosted Reacher instance.
- Evaluate IP and ASN information as moderation signals.
- Add persistence for pending reviews.
- Document the signup approval policy.
- Evaluate denylist integration separately.
- Add monitoring for bot/container availability.

The goal is not to automatically reject every unusual signup, but to provide moderators with enough context to make better decisions while reducing false positives for legitimate users.
