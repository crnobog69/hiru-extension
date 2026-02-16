# Hiru Chromium/Brave Extension (MVP)

## Load unpacked
1. Open `chrome://extensions` (or `brave://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `extension/chromium`.

## Current behavior
- Saves active tab to `POST /api/bookmarks`.
- Lets user edit title and URL before saving.
- Lets user select folder and optional description.
- Theme selector in popup (`dark`, `light`, `mocha`).
- Configurable Hiru server in popup.
- Presets:
- `http://localhost:3000` (default for local testing)
- `https://hiru.crnbg.org` (production)
- Custom server URL

## Important
- You need to be signed in on selected Hiru server.
- Extension reads `hiru_session` cookie and sends it via `x-hiru-session` header.
- If popup says auth failed, open `${server}/app`, log in, then retry.
