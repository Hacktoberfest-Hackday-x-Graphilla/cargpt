# CarGPT

An AI automotive assistant for maintenance, diagnostics, warning lights, tyres, brakes, EV charging, fuel economy, and buying advice.

Built with a vanilla HTML/CSS/JS frontend and a small Express backend that proxies requests to an OpenAI-compatible LLM endpoint.

---

## Features

- **Real LLM replies** — powered by `openai/gpt-4o-mini` through the Hack Club AI proxy (any OpenAI-compatible endpoint works)
- **Persistent conversations** — chat history stored in `localStorage`, survives page reloads
- **Multi-conversation** — sidebar with history, new-chat button, per-chat delete
- **Mini markdown renderer** — supports paragraphs, bullet lists, callout notes, and bold text (safely, without `innerHTML`)
- **Mobile responsive** — slide-in sidebar with scrim overlay on small screens
- **Keyboard shortcuts** — `Enter` to send, `Shift+Enter` for newline, `Ctrl/Cmd+K` for new chat, `Esc` to close menu
- **Rate limiting** — 20 requests per minute per IP
- **Retry logic** — exponential backoff on 429 and 5xx errors
- **Input sanitization** — role validation and length caps prevent prompt injection
- **Output coercion** — strips markdown the renderer can't handle, so the UI never breaks

---

## Tech Stack

| Layer         | Technology                                               |
| ------------- | -------------------------------------------------------- |
| Frontend      | Vanilla HTML, CSS, JavaScript (ES modules)               |
| Backend       | Node.js, Express 5                                       |
| LLM Client    | `openai` SDK (works with any OpenAI-compatible endpoint) |
| Rate Limiting | `express-rate-limit`                                     |
| CORS          | `cors`                                                   |
| Config        | `dotenv`                                                 |
| Dev Reload    | `nodemon`                                                |

No build step. No bundler. No framework. The browser reads the files as-is.

---

## Project Structure
```

cargpt-backend/
├── public/
│ ├── index.html # HTML markup only
│ ├── styles.css # All CSS
│ └── app.js # All client-side JS
├── .env # Secrets and config (never commit)
├── .gitignore # Git ignore rules
├── package.json # Project manifest
├── package-lock.json # Locked dependency versions
├── README.md # This file
└── server.js # Express backend

````

Two auto-generated items are not listed: `node_modules/` (dependencies) and any log files.

---

## Prerequisites

- **Node.js** v18 or newer (`node --version`)
- **npm** v9 or newer (`npm --version`)
- An **API key** for an OpenAI-compatible endpoint

This project is tested against [Hack Club AI](https://ai.hackclub.com) but will work with OpenAI, Groq, Together, OpenRouter, or any local Ollama/LM Studio setup that exposes an OpenAI-compatible `/v1/chat/completions` route.

---

## Setup

### 1. Install dependencies

```bash
npm install
````

### 2. Create the `.env` file

Create a file named exactly `.env` in the project root (the same folder as `package.json`). It must contain these five lines — no quotes, no `echo`, no shell syntax:

```
OPENAI_API_KEY=your-key-here
OPENAI_BASE_URL=https://ai.hackclub.com/proxy/v1
PORT=3000
ALLOWED_ORIGIN=http://localhost:3000
MODEL=openai/gpt-4o-mini
```

#### Environment variables

| Variable          | Required | Default                            | Description                                                     |
| ----------------- | -------- | ---------------------------------- | --------------------------------------------------------------- |
| `OPENAI_API_KEY`  | Yes      | —                                  | Your API key                                                    |
| `OPENAI_BASE_URL` | No       | `https://ai.hackclub.com/proxy/v1` | Base URL of the OpenAI-compatible endpoint (must include `/v1`) |
| `PORT`            | No       | `3000`                             | Port the server listens on                                      |
| `ALLOWED_ORIGIN`  | No       | `http://localhost:3000`            | CORS allow-list origin                                          |
| `MODEL`           | No       | `openai/gpt-4o-mini`               | Model identifier as the endpoint expects it                     |

### 3. Start the server

Development (auto-reload on file changes):

```bash
npm run dev
```

Production:

```bash
npm start
```

Expected output:

```
CarGPT listening on http://localhost:3000
Model: openai/gpt-4o-mini
Base URL: https://ai.hackclub.com/proxy/v1
```

### 4. Open the app

Navigate to [http://localhost:3000](http://localhost:3000).

---

## Usage

1. Type a question in the composer at the bottom.
2. Press **Enter** to send, or **Shift+Enter** for a new line.
3. The assistant's reply appears in the thread below your message.
4. Click **New conversation** (or press **Ctrl/Cmd+K**) to start a fresh chat.
5. Click any item in the sidebar to switch back to a previous conversation.
6. Hover over a history item and click **×** to delete it.

Try these starter prompts:

- "What does a flashing check engine light mean?"
- "How often should I service my car?"
- "How do I look after an EV battery?"
- "What should I check on a used car?"

---

## API Reference

### `POST /api/chat`

Send a conversation and receive an assistant reply.

**Request body:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What does a flashing check engine light mean?"
    }
  ]
}
```

- `messages` must be an array
- Each message must have `role` of `"user"` or `"assistant"` and a non-empty string `content`
- Only the last 20 messages are used
- The last message must have role `"user"`
- Each message is truncated to 2000 characters

**Success response (200):**

```json
{
  "reply": "Dashboard lights are grouped by colour...\n\n- **Red** ...\n\n> Tell me the exact symbol..."
}
```

The `reply` string uses a mini format the frontend can render:

- Blank line separates paragraphs
- Lines starting with `- ` become a bullet list
- Lines starting with `> ` become a callout note
- `**bold**` is rendered as bold text

**Error responses:**

| Status | Body                           | Cause                                                     |
| ------ | ------------------------------ | --------------------------------------------------------- |
| 400    | `{"error":"invalid_messages"}` | Messages missing, malformed, or not ending on a user turn |
| 429    | `{"error":"upstream_error"}`   | Upstream rate-limited                                     |
| 502    | `{"error":"upstream_error"}`   | Upstream error or network failure                         |
| 502    | `{"error":"empty_reply"}`      | Model returned nothing                                    |

**Example:**

```bash
curl -s http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What does a flashing check engine light mean?"}]}'
```

### `GET /api/health`

Liveness check for uptime monitoring.

**Response:**

```json
{ "ok": true }
```

---

## Architecture

### Request flow

```
Browser
  │
  │  fetch POST /api/chat  { messages: [...] }
  ▼
Express (server.js)
  │  1. Rate limit check
  │  2. Sanitize messages
  │  3. Prepend system prompt
  │  4. Call OpenAI SDK
  ▼
OpenAI-compatible endpoint
  │
  │  { choices: [{ message: { content: "..." } }] }
  ▼
Express
  │  5. Coerce markdown to mini format
  │  6. Return { reply: "..." }
  ▼
Browser
  │  7. renderRich() parses and displays
```

### Why the format coercion exists

The renderer in `public/app.js` is deliberately minimal — it only understands paragraphs, `- ` lists, `> ` notes, and `**bold**`. It uses `textContent` and `createTextNode` instead of `innerHTML` for safety, which means it can't handle arbitrary markdown.

The `coerceToMiniFormat()` function in `server.js` strips anything the renderer can't handle (headings, code fences, numbered lists, italics) before sending the reply to the browser. This is belt-and-braces: the system prompt already instructs the model to use only the mini format, but LLMs occasionally drift.

### Why the API key is server-side only

The browser never sees the API key. All LLM calls happen on the server. The frontend only talks to `localhost:3000`.

This is the only correct way to build this. Never put an API key in client-side JavaScript — it will be scraped from your site within hours.

---

## Customization

### Change the model

Edit `MODEL` in `.env`:

```
MODEL=openai/gpt-4o
```

Or any other model your endpoint supports.

### Change the system prompt

Edit the `SYSTEM_PROMPT` constant in `server.js`. The prompt instructs the model on personality, scope, and output format. If you change the output format, you must also update `renderRich()` in `public/app.js`.

### Use OpenAI directly instead of Hack Club

Edit `.env`:

```
OPENAI_API_KEY=sk-proj-...
OPENAI_BASE_URL=https://api.openai.com/v1
MODEL=gpt-4o-mini
```

Note: OpenAI's model naming is `gpt-4o-mini`, not `openai/gpt-4o-mini`.

### Use a local model (Ollama)

Edit `.env`:

```
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
MODEL=llama3.1
```

The SDK sends the key in an `Authorization` header, but Ollama ignores it. Any non-empty value works.

### Change the rate limit

Edit the `rateLimit({...})` block in `server.js`:

```js
app.use(
  "/api/",
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per window
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
```

### Change the port

Edit `PORT` in `.env`, or override on the command line:

```bash
PORT=4000 npm run dev
```

### Add new starter prompts

Edit the `PROMPTS` array in `public/app.js`:

```js
const PROMPTS = [
  ["Your question here", "Short subtitle"],
  ...
];
```

Each entry is `[full prompt text, subtitle]`.

---

## Security

### What's protected

- **API key is server-side only** — never sent to the browser
- **CORS** — locked to `ALLOWED_ORIGIN` (set to `*` only for testing)
- **Rate limiting** — 20 requests per minute per IP by default
- **Input validation** — role whitelist, length caps, history truncation
- **No `innerHTML`** — all rendering uses `textContent` and `createTextNode`
- **Token budget** — `max_tokens: 600` caps per-request cost

### What's not protected

- **No authentication** — anyone who can reach the server can use it
- **No per-user quotas** — the rate limit is per-IP, not per-user
- **No audit logging** — requests are not persisted server-side
- **No CSRF protection** — acceptable because there's no auth or state to hijack

If you deploy this publicly, add authentication (Clerk, Supabase Auth, or plain sessions) and a per-user quota before pointing anyone at it.

### If your key leaks

1. Immediately revoke it in your provider's dashboard and generate a new one
2. Update `.env` with the new key
3. Restart the server (`Ctrl+C` then `npm run dev`)
4. Check your provider's usage dashboard for unauthorized charges

Never commit `.env` to git. The provided `.gitignore` handles this automatically.

---

## Deployment

### Before deploying

1. **Rotate your API key** if it has ever been exposed
2. **Set `ALLOWED_ORIGIN`** to your production domain, not `*`
3. **Confirm `.env` is in `.gitignore`** — run `git check-ignore .env` (should print `.env`)
4. **Test locally first** — `npm start` should run cleanly

### Railway (recommended)

1. Push the repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo. Railway auto-detects Node and sets the start command from `package.json`
4. Under **Variables**, add:
   - `OPENAI_API_KEY` — your key
   - `OPENAI_BASE_URL` — the endpoint URL
   - `MODEL` — the model identifier
   - `ALLOWED_ORIGIN` — your Railway URL (e.g. `https://your-app.up.railway.app`)
   - Leave `PORT` unset; Railway provides it via env var
5. Deploy. Railway gives you a public URL.

### Fly.io

```bash
fly launch
fly secrets set OPENAI_API_KEY=... OPENAI_BASE_URL=... MODEL=...
fly deploy
```

Add a `Dockerfile` if you want full control; otherwise Fly detects Node automatically.

### Render

1. New → Web Service → connect repo
2. Build command: `npm install`
3. Start command: `npm start`
4. Add environment variables in the dashboard
5. Deploy

### Vercel / Netlify

Both work but require converting `server.js` into a serverless function. The Express app becomes a single handler, `app.listen()` is removed, and the file exports the app. Doable but more fiddly than Railway or Fly.

### Serving the frontend from the same origin

The frontend already uses relative paths (`/api/chat`, `/styles.css`), so as long as you serve the HTML from the same origin as the API, no CORS is needed. In production:

- Set `ALLOWED_ORIGIN` to the same URL the app is served from
- Or drop CORS entirely by removing the `app.use(cors(...))` line

---

## Troubleshooting

### `Missing OPENAI_API_KEY in .env`

The `.env` file is empty, misnamed, or contains shell syntax instead of key-value pairs.

**Check:**

```bash
cat .env
```

You should see five plain lines. If you see `echo '...'`, the file has the shell commands pasted in instead of the values. Delete the file and recreate it.

**Check the filename:**

```bash
ls -la | grep env
```

Must show `.env`, not `.env.txt` or `env`.

### `npm error Missing script: "dev"`

The `dev` script isn't in `package.json`. Add it:

```bash
npm pkg set scripts.start="node server.js"
npm pkg set scripts.dev="nodemon server.js"
```

### `Cannot use import statement outside a module`

`package.json` is missing `"type": "module"`. Add it:

```bash
npm pkg set type=module
```

### `EADDRINUSE: address already in use :::3000`

Something else is on port 3000. Either kill it or use a different port:

```bash
PORT=3001 npm run dev
```

### `{"error":"upstream_error"}` from `/api/chat`

The LLM call failed. Check the **server terminal** — it prints the real error:

| Server log shows     | Meaning                 | Fix                                  |
| -------------------- | ----------------------- | ------------------------------------ |
| `401`                | Invalid API key         | Check `OPENAI_API_KEY` in `.env`     |
| `404`                | Wrong model or base URL | Verify `MODEL` and `OPENAI_BASE_URL` |
| `429`                | Rate limited upstream   | Wait, or upgrade your plan           |
| `ECONNREFUSED`       | Base URL unreachable    | Check the URL and your network       |
| `insufficient_quota` | Out of credits          | Top up your provider account         |

### Browser loads the page but nothing works

Open DevTools → **Console**. Common errors:

| Console error                    | Cause                                                      |
| -------------------------------- | ---------------------------------------------------------- |
| `Failed to fetch`                | Server isn't running, or wrong port                        |
| `404 /app.js`                    | File is in the wrong folder                                |
| `Uncaught SyntaxError`           | JS file has a typo                                         |
| `Cannot read properties of null` | A DOM element referenced by `id` doesn't exist in the HTML |

### `cat: illegal option -- A` on macOS

Use `cat -e` instead (BSD `cat` doesn't support `-A`).

### Styles look stale after editing

Hard-refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows/Linux).

---

## Development Notes

### Editing the frontend

Files under `public/` are served statically. Nodemon **does not** watch them by default (it only watches `.js`/`.mjs`/`.cjs`/`.json` at the root). After editing, just refresh the browser — no restart needed.

If you want nodemon to watch the frontend too, run it with:

```bash
nodemon --watch public --watch server.js server.js
```

### Editing the backend

Any change to `server.js` triggers an automatic restart. Nodemon prints `[nodemon] restarting due to changes...` when it does.

### Clearing chat history

Conversations live in `localStorage` under the key `cargpt.v1`. To reset, open DevTools → **Application** → **Local Storage** → `http://localhost:3000` → delete `cargpt.v1`, then reload.

Or from the console:

```js
localStorage.removeItem("cargpt.v1");
location.reload();
```

### Resetting dependencies

If `node_modules` gets corrupted:

```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Roadmap

Possible directions if you keep building:

- **Streaming responses** — Server-Sent Events so tokens appear as they're generated
- **Authentication** — per-user accounts with server-side chat storage
- **Retrieval-augmented generation** — ground answers in real service manuals and TSBs
- **File attachments** — let users upload photos of dashboard lights or error codes
- **Voice input** — Web Speech API for hands-free use while working on a car

---

## License

ISC — do whatever you want with it.

---

## Disclaimer

CarGPT provides general guidance only. It is not a substitute for professional mechanical inspection. Always verify safety-critical work — brakes, steering, suspension, fuel systems, high-voltage EV components — with a certified mechanic.
git check-ignore .env
````

If it prints `.env`, your secret is safe from git. If it prints nothing, the `.gitignore` isn't working — check that it contains the line `.env`.
