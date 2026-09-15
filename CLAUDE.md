# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                          # Node deps (frontend + backend share one package.json)
pip install -r server/requirements.txt   # Python deps for the receipt parser (Python 3.11, see .python-version)

npm start        # Backend: Express + Socket.io on PORT (default 3001)
npm run dev      # Frontend: Vite dev server on port 3000 (vite.config.ts)
npm run build    # Frontend production build to dist/
```

There is no test suite, linter, or tsconfig. `npm run build` (Vite/SWC, no type-checking) is the only automated check — use it to verify frontend changes.

Required `.env` at repo root: `MONGO_URI`, `GEMINI_API_KEY`, optional `PORT`, and `VITE_API_URL` (frontend; defaults to `http://localhost:3001`).

## Architecture

Single repo, two deployables: React frontend (`src/`, hosted on Vercel) and a Node backend (`server/`, hosted on Render via `render-build.sh`, which installs both Node and Python deps).

### Sessions and roles
- No user accounts. An admin creates a session with a 4–6 digit PIN (`POST /api/create-session`) and shares `?session=<uuid>`. Anyone with the link is a guest.
- `POST /api/verify-pin` (rate-limited per IP and per session) exchanges the PIN for the session's random `adminToken`, which the client caches in `localStorage` as `cost-splitting-admin-<sessionId>` and re-checks on load via `/api/verify-admin-token`. `isAdmin` in `App.tsx` is just `adminToken !== null`; the **server** enforces admin rights by checking the token on every admin write and on `/api/parse-receipt` (`X-Session-Id` / `X-Admin-Token` headers).
- `adminPin` and `adminToken` are `select: false` in the schema. Anything sent to clients goes through `toClientSession` in `server/index.js`, never the raw document.
- `isGuestView` toggles between the simplified `GuestView` (pick your name, tap items you ate) and the admin dashboard (`ImageUploader`, `ReceiptItemsSection`, `GuestsSection`, `SplitSummary`).

### State sync
- `src/App.tsx` owns all session state (`receiptItems`, `guests`, and `charges` for tax/tip) and updates it optimistically. Two socket events write to the server:
  - `update-session` (admin token required): `syncUpdate` sends the **entire** changed array(s) and/or tax/tip; the server replaces those fields.
  - `toggle-assignment` (anyone with the link): `{ itemId, guestId, unitIndex, assigned }`, applied server-side to a single unit. This is the only write guests can make.
- Both go through `runSessionAction`, which serializes writes per session with an in-process lock (assumes a single server instance), saves, and broadcasts `session-updated` to the rest of the room (not the sender). The sender gets a socket ack; on rejection it includes the authoritative session, which `handleActionResult` applies to roll back the optimistic update.
- Initial load is `GET /api/session/:id`; subsequent updates arrive via the socket.
- `server/models/Session.js` stores `items`/`guests` as untyped `Array`s. `server/validation.js` is the server-side source of truth for their shape and limits (lengths, amounts, hex colors, quantity 1–99); it also drops assignments to guests that no longer exist. Keep it in sync with the TS interfaces in `src/App.tsx`.

### Data model details
- `ReceiptItem.price` is the **unit** price; `assignedTo` is `string[][]` indexed by unit (`assignedTo[i]` = guest IDs sharing unit `i`). A unit's price is split evenly among its assignees. `normalizeItems` in `App.tsx` upgrades the legacy flat `string[]` format and pads `assignedTo` to `quantity` — run incoming items through it.
- Tax and tip each have a value and a mode (`taxMode`/`tipMode`: `'percent'` of the subtotal or flat `'amount'` in dollars); sessions saved without a mode read back as `'percent'` via the schema default. The whole-bill dollar tax/tip is pro-rated to each guest by their share of the subtotal.
- All split maths lives in `src/utils/split.ts` (`calculateBillTotals`, `calculateGuestTotals`); `SplitSummary` and `GuestView` must both use it rather than computing totals themselves.
- `Guest.paidAmount` is admin-entered. Balance owed = guest total − `paidAmount`; admins enter **negative** values to add direct costs (e.g. gas someone else covered).

### Receipt parsing
`ImageUploader` renders a HEIC preview with `heic2any` but uploads the original file. `src/utils/ocrProcessor.ts` posts it to `POST /api/parse-receipt` (admin only, rate-limited to 5/min/IP, images ≤15 MB). The server saves the upload via multer to `uploads/`, then spawns `python3 server/receipt_parser.py <path>` (killed after 90s). The script calls Gemini (`gemini-2.5-flash`) and prints a JSON array of `{name, price, quantity}` to stdout. The server filters that output through `sanitizeParsedItems` and deletes the temp file. The client assigns item IDs and empty `assignedTo` arrays. On Windows, `python3` is usually the Microsoft Store stub, so receipt parsing only works locally if a real `python3` is on PATH.

Rate limits key on `req.ip`. `trust proxy` is set from `TRUST_PROXY`, or defaults to `1` when Render's `RENDER` env var is present.

### Frontend conventions
- `src/components/ui/` is generated shadcn/Radix primitives; `cn()` lives in `src/utils/index.ts`. The long alias list in `vite.config.ts` maps versioned import specifiers (e.g. `sonner@2.0.3`) to plain packages — leave it alone unless adding such an import.
- Tailwind v4 via `@tailwindcss/vite`; animations via `motion/react`; toasts via `sonner`.

### Backend conventions
- Express v5. NoSQL-injection protection is a custom middleware calling `mongoSanitize.sanitize` on body/params/query (the stock `express-mongo-sanitize` middleware breaks on Express 5's read-only `req.query`). Route/socket IDs are coerced with `String(...)` before querying. Socket payloads do not pass through this middleware.
