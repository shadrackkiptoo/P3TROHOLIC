# P3TROHOLIC — WhatsApp Sticker Bot

Simple WhatsApp Web bot that converts images to stickers.

Prerequisites
- Node.js 20.18.0

Install
```bash
npm install
```

Run
```bash
npm start
```

On first run the terminal will show a QR code — scan it with WhatsApp (Linked Devices).
Send an image or reply to an image with any message; the bot will convert the image into a sticker and send it back.

Usage with command
- Send an image with the caption `.st` and the bot will reply with a sticker.
- Or reply to an existing image with the text `.st` and the bot will convert the quoted image into a sticker.

Troubleshooting
- If the bot fails to connect or the QR doesn't appear, try:
	- Disabling VPNs or proxies and allowing outbound WebSocket connections.
	- Checking your firewall to allow the Node.js process outbound network access.
	- Waiting a few minutes and restarting the bot — WhatsApp endpoints sometimes rotate.
- The bot implements an automatic reconnect (up to 5 attempts) with exponential backoff.

If you want, I can add logging to a file or increase the retry limit.

Logs
- Runtime logs are appended to `p3troholic.log` in the project root. Check this file for QR prints, connection errors, and reconnect attempts.
