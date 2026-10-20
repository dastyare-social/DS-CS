---
name: send-message
description: Send WhatsApp (Cloud API), Instagram DM, Facebook Messenger, or Telegram messages from a connected account, including media and WhatsApp templates.
---

# Skill: Send a direct message

Send a WhatsApp, Instagram DM, Facebook Messenger, or Telegram message from a connected Zernio account.

## When to use
The user wants to message a customer or contact programmatically: WhatsApp Business messages (official Cloud API), Instagram DMs, Messenger replies, or Telegram messages, including media attachments and WhatsApp templates.

## Prerequisites
1. A Zernio API key (Bearer token). Get one at https://zernio.com/dashboard after signing up.
2. A connected messaging-capable account (WhatsApp number, Instagram Business, Facebook Page, or Telegram bot). List accounts with `GET /api/v1/accounts`.
3. For WhatsApp: outside the 24-hour customer service window you must use an approved template.

## Request
`POST https://zernio.com/api/v1/messages`

Headers:
- `Authorization: Bearer YOUR_API_KEY`
- `Content-Type: application/json`

Body (existing conversation):
```json
{
  "conversationId": "CONVERSATION_ID",
  "text": "Thanks for reaching out! Your order shipped today."
}
```

Body (WhatsApp, new outbound conversation):
```json
{
  "accountId": "WHATSAPP_ACCOUNT_ID",
  "to": "+15551234567",
  "text": "Your appointment is confirmed for Tuesday at 10:00."
}
```

Attach media with `mediaItems: [{ "type": "image", "url": "https://..." }]`.

## Response
`201` with the message object (`id`, `conversationId`, `status`). Delivery and read receipts arrive on your webhook as `message.delivered` / `message.read`; failures as `message.failed` with the platform error.

## Common errors
- `401` invalid key; `404 conversation_not_found` for a bad conversationId.
- WhatsApp `470`-class platform errors: outside the 24h window, send a template instead (`templateName` + `templateParams`).
- `429`: back off per `Retry-After`.

## Reference
- Inbox API docs: https://docs.zernio.com/inbox
- Conversations: `GET /api/v1/conversations` to find or create conversation ids.
