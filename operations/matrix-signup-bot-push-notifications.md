# Matrix Signup Bot push notifications

# Issue

Signup Review Bot messages were delivered successfully to the Matrix review room, but Element X on iPhone did not generate push notifications.

Manual messages sent from the same bot account to the same room generated notifications normally.

This initially suggested a possible Element X, APNs, session, or iOS notification issue.

# Investigation

The bot's Matrix message payload was inspected.

The main signup card was sent as:

```python
content = TextMessageEventContent(
    msgtype=MessageType.NOTICE,
    body=plain,
    format=Format.HTML,
    formatted_body=html,
)
```

`MessageType.NOTICE` is serialized as:

```text
m.notice
```

Matrix clients suppress push notifications for notice messages by default.

A second helper used for thread replies and status messages also used `MessageType.NOTICE`.

# Resolution

Only the main signup card was changed from:

```python
msgtype=MessageType.NOTICE
```

to:

```python
msgtype=MessageType.TEXT
```

Thread replies, enrichment details, and accept/reject confirmation messages remain `NOTICE`.

This results in:

```text
New signup card
→ m.text
→ push notification

Thread/status messages
→ m.notice
→ no unnecessary push notification
```

# Verification

After restarting the Signup Review Bot, a new signup notification generated a push notification successfully on Element X for iPhone.

# Lessons Learned

- A message appearing in a Matrix room does not guarantee that it will generate a push notification.
- `m.notice` is appropriate for passive bot/status messages but not for alerts that require moderator attention.
- Alerting messages should use `m.text` when push notification delivery is expected.
- Follow-up thread messages can remain `m.notice` to avoid notification noise.
- When diagnosing push failures, compare manually sent messages and bot-generated event payloads before assuming APNs or client failure.
