# Budae-jjigae Sidecar Retirement (2026-10-23)

## Decision and scope

On **2026-10-23 JST**, the Mustard Mastodon instance retired the optional Budae-jjigae ActivityPub inbox-filtering sidecar, while continuing to run Mastodon **4.7.3**.

This was a **deliberate reduction of an obsolete dependency**, not a replacement filter or a Mastodon version upgrade. Following consultation, the project's maintainer recommended disabling the sidecar for the time being and indicated that further development was not expected soon. The operator also had identified an outdated Alpine 3.18 base in the sidecar image. A previously applied non-root/read-only/capability-restricted runtime configuration reduced risk but did not refresh the old base.

The operational trade-off is explicit: **the extra Budae filtering layer was removed.** Mastodon's own federation handling and the instance's independently configured signup/moderation controls remain separate concerns. Removing the sidecar does not establish that equivalent anti-spam filtering remains in place.

For the preceding security maintenance and original hardened Budae runtime, see [2026-10-22 runtime security maintenance](../update-log/4-7-3-security-maintenance-2026-10-22.md).

## Previous routing and dependencies

The running Nginx configuration previously routed two ActivityPub endpoints to the sidecar:

~~~nginx
location /inbox {
  try_files $uri @budae;
}

location ~ /users/(.*)/inbox {
  try_files $uri @budae;
}
~~~

The `@budae` named location proxied to `127.0.0.1:7000`. Docker Compose published the Budae container there and configured its backend as `web:3000`.

The existing, already-used Nginx `@proxy` location instead passed requests to `http://backend`, whose upstream was confirmed as:

~~~nginx
upstream backend {
    server 127.0.0.1:3000 fail_timeout=0;
}
~~~

The operator verified these routes **before** stopping the sidecar. This sequencing mattered because disabling Budae while Nginx still proxied Inbox requests to port 7000 would have broken that intake path.

## Retirement procedure

1. Inspect the resolved Nginx configuration and Docker Compose service definition to locate Budae dependencies and the original Mastodon Web upstream.
2. Back up `/etc/nginx/conf.d/mastodon.conf`.
3. Redirect both shared and per-user Inbox locations to `@proxy`, preserving the original named proxy and all other locations:

   ~~~nginx
   location /inbox {
     try_files $uri @proxy;
   }

   location ~ /users/(.*)/inbox {
     try_files $uri @proxy;
   }
   ~~~

4. Run `sudo nginx -t`; after successful syntax/configuration tests, run `sudo systemctl reload nginx`. The retired `@budae` location remained available during the first routing test.
5. Review real Mastodon Web logs. Multiple `POST /inbox` requests and a `POST /users/thx/inbox` request were accepted by `ActivityPub::InboxesController` with `status=202` while the new routing was active.
6. Stop **only** the Budae service using `docker compose stop budae`. With Budae stopped, verify service health, HTTPS, incoming Inbox requests, and Sidekiq work completion.
7. Remove the stopped Budae container using `docker compose rm -f budae` while its service was still defined.
8. Back up and remove the Budae service definition from Docker Compose; remove the unreferenced Nginx `location @budae` block. Retain the two `@proxy` Inbox locations. No mass container recreation was required.
9. Verify the final state and preserve recovery information. The sidecar image itself was **not shown to be deleted**, and its registry status was not established.

## Verification evidence

Two operational checkpoints were captured: immediately after bypassing the sidecar, and after stopping/cleaning up the container and proxy configuration.

| Check | Observed result |
| --- | --- |
| `nginx -t` after initial route switch | `syntax is ok` / `test is successful` |
| Reload of Nginx after route switch | command completed without a reported failure |
| Common `/inbox` with direct Mastodon routing | repeated `202` responses in Web logs |
| User-specific `/users/thx/inbox` with direct routing | `202` response in Web logs |
| Budae stopped | `docker compose stop budae` succeeded |
| Web / Sidekiq / Streaming | all `healthy` after stop and final cleanup |
| PostgreSQL / Redis / Elasticsearch | all `healthy` in final `docker compose ps` |
| HTTP availability | `HTTP/2 200` from the public site |
| Sidekiq after sidecar stop | repeated `ActivityPub::DeliveryWorker ... done` records |
| Retired container | `docker ps -a --filter name=mastodon-budae-1` returned no matches |
| Remaining Nginx Budae references | no `@budae` or `127.0.0.1:7000` matches from `nginx -T` |

The final sample of real Inbox requests at approximately **14:19 JST on 2026-10-23** still showed `status=202` after the container and routing cleanup. One earlier `403` response from a particular remote network also appeared during tests; its cause was not established and should not be attributed to removal without more evidence.

### Validation limits

- `202 Accepted` proves the application's controller accepted these requests, **not** that every federated object was successfully processed and delivered downstream.
- The sampled Sidekiq `done` events were outgoing delivery jobs, not a complete verification of every incoming federation pathway.
- No quantified before/after spam-rejection comparison was performed.
- No long-term trend or end-user behavioral regression assessment has yet been documented.
- No new database migration, application image rebuild or restart of otherwise healthy Mastodon services was needed for this change.
- No final `nginx -t` output after deletion of `@budae` was included in the last checkpoint. The active configuration was inspectable with `nginx -T` and HTTP/Inbox traffic continued, but a subsequent explicit syntax check is still a useful hygiene step.

Raw user identifiers, signing-key URIs, access logs and active moderation thresholds are not reproduced here.

## Rollback considerations

If federation intake or abuse handling regresses and Budae needs to be temporarily restored:

1. Restore the versioned Docker Compose backup and check `docker compose config -q`.
2. Confirm that the former Budae image remains available and compatible; recreate/start the Budae service and verify that its loopback port responds.
3. **Only after Budae is responding**, restore or reintroduce the Inbox-to-`@budae` routing from the Nginx backup. Check `nginx -t` and reload Nginx.
4. Re-check shared and per-user Inbox acceptance, worker logs, and public HTTP availability.

Never restore Inbox routing to a stopped sidecar first, as that would strand incoming federation requests.

## Follow-up

- Monitor federation-intake errors and trends in unwanted remote mentions/content after removal.
- Continue normal moderation, instance-blocking and account-approval practices as separate controls.
- If the maintainer releases a supported successor or if abuse trends justify reintroducing a filter, evaluate and test the new implementation independently rather than automatically restoring the outdated image.
- Confirm the current Nginx config syntax with an explicit `nginx -t` during the next regular check.

