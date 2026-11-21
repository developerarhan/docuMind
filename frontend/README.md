# DocuMind frontend

The reading workspace for **DocuMind**: a React + TypeScript + Tailwind frontend
for the Django document-intelligence API. It covers authentication, the document
library, PDF reading, page-cited chat, saved conversations, and assistant memory.

## Stack

- React 19 + TypeScript (strict)
- Vite 8
- Tailwind CSS v4
- React Router
- Axios
- `pdfjs-dist` for the custom PDF reader
- `react-markdown` + `remark-gfm` for answers

No state library is used. Authentication, documents, conversations, toasts, and
the upload dialog are provided by small React contexts.

## Running locally

Prerequisites: Node.js 20+ and the DocuMind backend running on
`http://localhost:8000` (Django with its database and worker).

```bash
cd frontend
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` and `/media` to
`VITE_PROXY_TARGET`, so no CORS configuration is needed and PDF.js can fetch
files same-origin.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | API base URL. Keep the proxy path in development. |
| `VITE_MEDIA_BASE_URL` | _(empty)_ | Optional absolute origin for uploaded PDFs. |
| `VITE_PROXY_TARGET` | `http://localhost:8000` | Backend origin used by the dev proxy. |

`.env.example` contains no secrets.

### Scripts

```bash
npm run dev        # Start the Vite dev server
npm run typecheck  # Strict TypeScript check
npm run build      # Type-check and produce a production build in dist/
npm run preview    # Serve the production build locally
```

## Backend integration notes

The frontend uses only endpoints that exist in the backend:

- Token auth: `POST /api/auth/register|login|logout/`, `GET /api/auth/me/`
  with an `Authorization: Token <key>` header.
- Documents: `GET|POST /api/documents/`, `DELETE /api/documents/:id/`,
  `POST /api/documents/:id/process/`, `POST /api/documents/:id/chat/`.
- Conversations: `GET /api/conversations/`,
  `GET|DELETE /api/conversations/:id/`, `GET /api/conversations/:id/messages/`.
- Memory: `GET|POST /api/memories/`, `DELETE /api/memories/:id/`.

Behaviours worth knowing:

- The upload response does not include the document id. After upload the client
  re-fetches the library and matches the returned `file` URL, then starts
  processing automatically.
- Pending/processing documents are polled every four seconds until the library
  has no active jobs.
- Chat responses include `sources` with page numbers, so citation chips jump the
  PDF reader to the cited page. Historical messages from the backend do not
  include sources; only answers from the current session show source cards.
- Retrieval only answers when a chunk scores at least `0.60` cosine similarity
  (`ai_engine/rag/retrieval.py`). Short or sparse PDFs — and generic prompts such
  as "Summarize this document" — often score below that, so the backend replies
  "I couldn't find relevant information in this document to answer your
  question." That message is generated server-side, not by the frontend.
- Even when retrieval succeeds, the API can return `sources: []`: the citation
  validator expects ASCII `[Source 1]` markers, while the configured Groq model
  tends to emit full-width `【Source 1】` brackets. Answers still render; source
  chips and page jumps stay hidden until the backend accepts that format.
- Suggested actions ("Summarize", "Extract key concepts", "Generate important
  questions") send real prompts to the document chat endpoint. Nothing is
  hardcoded.
- PDF previews require Django to serve uploaded media. In `DEBUG`, the backend
  serves `/media/` through `django.conf.urls.static`.

## Structure

```
src/
  components/   UI kit, layout, chat, and document components
  context/      Auth, documents, conversations, toasts, upload dialog
  features/     Chat state, PDF.js setup, filtering, upload validation
  pages/        Routes: dashboard, library, workspace, conversations, settings
  services/api/ Typed Axios client and endpoint wrappers
  types/        API and view-model types
```

## Design

Warm paper (`#f6f3ec`), ink (`#191c25`), and cobalt (`#3b4ee0`) with Inter for
interface text and Newsreader for page headings. The workspace is a two-pane
reading desk on desktop (PDF + assistant) and switches to Reader/Assistant tabs
on smaller screens.
