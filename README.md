# AI Chat Studio

AI Chat Studio is an AI-assisted web application for generating and managing text and images. It combines conversational text generation through a locally hosted LM Studio server with cloud image generation through Black Forest Labs, alongside personal chat history, folders, media reuse, and profile management.

The project was developed as the implementation component of a Master's dissertation.

## Dissertation Context

AI Chat Studio supports a Master's dissertation focused on an **AI-Assisted Web Application for Content Generation**. It demonstrates how local and cloud AI services can be integrated into a secure, persistent, multimodal web workspace.

## Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Supabase Setup](#supabase-setup)
- [LM Studio Setup](#lm-studio-setup)
- [Storage](#storage)
- [Testing](#testing)
- [Security](#security)

## Features

### Authentication

- Registration, login, and logout
- Server-validated JWT session cookies backed by persisted authentication sessions
- Protected chat and profile routes
- Password hashing with `bcryptjs`

### AI text generation

- Multi-turn conversational generation through LM Studio's OpenAI-compatible API
- Optional user image attachments for multimodal prompts
- Request cancellation through `AbortController`; canceled generations are not persisted
- Generated initial chat titles with a safe fallback
- Six answer modes:
  - **Standard** — balanced, clear responses
  - **Concise** — brief responses with fewer details
  - **Detailed** — extended explanations, examples, and context
  - **Creative** — ideation, storytelling, and creative writing
  - **Code** — programming-focused responses and explanations
  - **Step-by-Step** — sequential tutorial-style guidance

### Image generation

- Prompt-only generation using Black Forest Labs FLUX.2 Klein 4B (`flux-2-klein-4b`)
- Aspect ratios: `1:1`, `16:9`, and `9:16`
- Image-guided generation from explicitly uploaded or reused references
- Up to four explicit source/reference images per image request
- Generated output persisted to private Supabase Storage
- Enlarged image viewer, authenticated original download, and unavailable-image fallback

Generated images can be selected with **Reuse** and attached directly to another image request. Previous images are never included automatically: generation is prompt-only unless the user explicitly uploads or reuses a reference.

### Personal chat history

- Persisted chats and messages
- Case-insensitive title search
- Newest-first and oldest-first deterministic sorting
- Folder creation, rename, deletion, and drag-and-drop chat movement
- Chat rename, move, rating, and deletion
- URL-persisted content filtering with **All**, **Text only**, and **Images**

The content filter classifies generated output, not user input:

| Filter | Meaning |
| --- | --- |
| **All** | Every chat matching the current search and folder rules |
| **Text only** | Chats with no assistant-generated image |
| **Images** | Chats containing at least one assistant-generated image |

A chat containing a user-uploaded image and only a textual assistant response remains **Text only**. Reusing a generated image on a user message does not by itself classify that chat as an image-output chat.

### Profile and account management

- Profile page with display name, email, and membership date
- Initials avatar and customizable six-digit HEX fallback color
- Private profile-photo upload, change, and removal with signed display URLs
- Explicitly confirmed account deletion

Account deletion removes profile-owned sessions, folders, chats, messages, attachment metadata, chat media, and avatar media. Database cascades remove dependent records, while Storage prefixes are removed through authenticated server-side cleanup.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Mantine, Tabler Icons, dnd-kit |
| Server | Next.js Server Components and Route Handlers |
| Database and Storage | Supabase PostgreSQL, Supabase Storage, Supabase JavaScript SDK |
| Text AI | LM Studio, OpenAI JavaScript SDK, OpenAI-compatible API |
| Image AI | Black Forest Labs API, FLUX.2 Klein 4B |
| Image processing | `sharp` |
| Validation and authentication | Zod, `bcryptjs`, `jose` |
| Content rendering | `marked`, `isomorphic-dompurify` |
| Testing and quality | Vitest, ESLint, TypeScript |

## Architecture

```text
Browser / Client Components
        |
        | HTTP / fetch
        v
Next.js Route Handlers
        |
        +--> Authentication / Zod validation / ownership checks
        +--> Database repositories --------> Supabase PostgreSQL
        +--> Storage helpers --------------> Private Supabase Storage
        +--> AI services
              +--> LM Studio (text)
              +--> Black Forest Labs (images)
```

Privileged database, Storage, authentication, and AI-provider operations run on the Next.js server. The browser communicates with application Route Handlers and does not instantiate a privileged Supabase client.

### Client and Server Responsibilities

Server Components include the root page, route-group layouts, and chat/profile pages without a `"use client"` directive. They read authentication cookies, validate persisted sessions, load safe profile fields, create signed avatar URLs where required, and pass sanitized initial data to interactive components.

Client Components include `ChatShell`, `ProfileEditor`, `AuthShell`, history items, message rendering, image viewers, and confirmation modals. They manage React state, browser `File` objects, object-URL previews, drag-and-drop, routing, client fetches, dialogs, and request cancellation.

Files under `app/api/**/route.ts` are server-side Route Handlers. They authenticate requests, validate input, enforce ownership, invoke repositories and Storage helpers, and coordinate AI requests.

### Next.js Route Groups

The parenthesized directories `(auth)` and `(chat)` are organizational Route Groups. Their names do not appear in browser URLs:

```text
app/(auth)/login/page.tsx          -> /login
app/(auth)/register/page.tsx       -> /register
app/(chat)/chat/page.tsx           -> /chat
app/(chat)/chat/[chatId]/page.tsx  -> /chat/[chatId]
app/(chat)/profile/page.tsx        -> /profile
```

`app/(auth)/layout.tsx` redirects an authenticated user to `/chat`. `app/(chat)/layout.tsx` redirects an unauthenticated user to `/login`.

### Text Generation Flow

```text
User prompt
  -> ChatShell
  -> Next.js text exchange Route Handler
  -> authentication and validation
  -> persisted conversation context
  -> LM Studio
  -> attachment and exchange persistence
  -> UI and history refresh
```

The client attaches an `AbortController` signal to text requests. Cancellation reaches the LM Studio request and returns without persisting an incomplete exchange.

### Image Generation Flow

```text
Prompt and explicit references
  -> Next.js image exchange Route Handler
  -> authentication, validation, and ownership checks
  -> Black Forest Labs submission and polling
  -> temporary result download and validation
  -> private Supabase Storage
  -> message and attachment metadata
  -> temporary signed display URL
  -> browser
```

Black Forest Labs delivery URLs are temporary transport URLs. Stable Storage paths and database attachment rows are the application's persistent source of truth.

## Project Structure

```text
app/
  (auth)/                 Authentication pages and redirecting layout
  (chat)/                 Protected chat/profile pages and layout
  api/                    Server-side Route Handlers
  globals.css             Global styles
  layout.tsx              Root layout and providers

components/
  auth/                   Login and registration UI
  chat/                   Chat, history, messages, image viewer, modals
  profile/                Profile editor, avatar, account deletion

lib/
  ai/                     LM Studio, BFL, prompts, answer modes
  auth/                   Cookies, JWTs, passwords, sessions
  db/                     Server-side Supabase repositories
  http/                   Request parsing, responses, rate limiting
  profile/                Safe identity and signed profile views
  storage/                Chat media, avatars, URLs, account cleanup
  validation/             Zod schemas

supabase/migrations/      Ordered PostgreSQL migrations
types/                    Shared domain types
```

## Page Routes

| Route | Purpose |
| --- | --- |
| `/` | Redirects to `/chat` when authenticated or `/login` otherwise |
| `/login` | Login page |
| `/register` | Account registration |
| `/chat` | New chat workspace and personal history |
| `/chat/[chatId]` | Existing persisted conversation |
| `/profile` | Protected profile and account management |

## API Overview

| Area | Method and route | Purpose |
| --- | --- | --- |
| Authentication | `POST /api/auth/register` | Create a profile and session |
| Authentication | `POST /api/auth/login` | Verify credentials and create a session |
| Authentication | `POST /api/auth/logout` | Revoke the session and clear its cookie |
| Authentication | `GET /api/auth/me` | Read the authenticated identity |
| Chats | `GET /api/chats` | Search, sort, and filter chat history |
| Chats | `POST /api/chats/initial-exchange` | Create an initial text exchange |
| Chats | `POST /api/chats/initial-image-exchange` | Create an initial image exchange |
| Chats | `GET/PATCH/DELETE /api/chats/[chatId]` | Read, update, or delete a chat |
| Messages | `GET/POST /api/chats/[chatId]/messages` | Read messages or append text |
| Images | `POST /api/chats/[chatId]/images` | Append an image exchange |
| Ratings | `PUT /api/chats/[chatId]/rating` | Set or clear a rating |
| Folders | `GET/POST /api/folders` | List or create folders |
| Folders | `PATCH/DELETE /api/folders/[folderId]` | Rename or delete a folder |
| Profile | `GET/PATCH/DELETE /api/profile` | Read, update, or delete the profile |
| Avatar | `POST/DELETE /api/profile/avatar` | Upload/change or remove a photo |
| Attachments | `GET /api/attachments/[attachmentId]/download` | Authenticated image download |

## Database

Supabase provides PostgreSQL. The principal tables are:

- `profiles` — identity, password hash, display name, avatar path, and color
- `auth_sessions` — JWT identifiers, expiration, and revocation state
- `chat_folders` — profile-owned history folders
- `chats` — conversations, titles, models, folders, and ratings
- `messages` — ordered user and assistant content with answer-mode metadata
- `message_attachments` — Storage paths, MIME types, dimensions, and sizes

Profiles own sessions, folders, and chats. Chats own messages, and messages own attachment metadata. Cascades remove dependent records. Persistence functions save complete user/assistant exchanges atomically.

### Migrations

Apply migrations from `supabase/migrations/` in filename order.

| Migration | Purpose |
| --- | --- |
| `0001_init.sql` | Initial tables, indexes, relationships, and access controls |
| `0002_chat_rating_history_indexes.sql` | Ratings and history indexes |
| `0003_persist_chat_exchange.sql` | Atomic exchange persistence |
| `0004_persist_message_answer_mode.sql` | Answer-mode persistence |
| `0005_drop_chat_system_prompt.sql` | Removes stored chat system prompts |
| `0006_cascade_folder_chat_deletion.sql` | Folder/chat deletion relationship |
| `0007_atomic_initial_chat_exchange.sql` | Atomic initial chat and exchange |
| `0008_image_generation_exchanges.sql` | Image exchange persistence |
| `0009_chat_media_storage.sql` | Chat media attachment persistence |
| `0010_image_guided_generation.sql` | Explicit source/reference images |
| `0011_drop_message_structured_payload.sql` | Final normalized message schema |
| `0012_profile_identity.sql` | Avatar path, HEX color, current identity schema |

Historical migrations describe schema evolution and should not be edited after application.

## Storage

The application expects two private Supabase Storage buckets.

`chat` bucket:

```text
<profileId>/
  <chatId>/
    uploaded/<uuid>.<extension>
    generated/<uuid>.<extension>
```

`profile` bucket:

```text
<profileId>/
  avatar/<uuid>.<extension>
```

The database stores stable object paths, not signed URLs. Browser display uses short-lived signed URLs, while generated-image downloads use an authenticated server route. Neither bucket needs public object URLs.

## Prerequisites

- A current supported Node.js version and npm
- A Supabase project
- LM Studio with a compatible chat model loaded
- A Black Forest Labs API key for image generation

The Next.js server must be able to reach LM Studio. Starting Next.js does not start LM Studio automatically.

## Local Setup

```bash
git clone https://github.com/Gqbriel02/ai-content-generator.git
cd ai-content-generator
npm install
cp .env.example .env.local
```

On Windows, copy `.env.example` to `.env.local` using File Explorer or your preferred shell. Replace every placeholder with the appropriate local value.

### Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | Yes | JWT signing secret of at least 32 characters |
| `LM_STUDIO_BASE_URL` | No | LM Studio endpoint; defaults to `http://localhost:1234/v1` |
| `LM_STUDIO_API_KEY` | No | Key sent to LM Studio; defaults to `lm-studio` |
| `LM_STUDIO_MODEL` | Yes | Model identifier reported by LM Studio |
| `ALLOWED_DEV_ORIGINS` | No | Comma-separated development origins accepted by Next.js |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL; current access is server-side |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only privileged Supabase credential |
| `BFL_API_KEY` | For images | Server-only Black Forest Labs credential |

`.env.local` is ignored and must never be committed. `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `BFL_API_KEY` must never reach browser code. `.env.example` contains placeholders only.

### Run the Application

Start LM Studio's local server, then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production compilation and local production server:

```bash
npm run build
npm start
```

The project is primarily designed for local/development use because text generation depends on an independently running LM Studio server.

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Apply `supabase/migrations/0001_init.sql` through `0012_profile_identity.sql` in order.
4. Create a `chat` Storage bucket with **Public bucket disabled**.
5. Create a `profile` Storage bucket with **Public bucket disabled**.
6. Add the project URL and service-role key to `.env.local`.

Bucket restrictions are optional defense-in-depth. The application validates chat images and enforces profile avatars as JPEG, PNG, or WebP with a maximum size of 5 MB.

The repository contains ordered SQL files rather than an automated deployment workflow, so the Supabase SQL Editor is the documented setup path. Do not skip intermediate migrations.

## LM Studio Setup

1. Install and open LM Studio.
2. Download and load a model compatible with its OpenAI-compatible server.
3. Start the local API server.
4. Set `LM_STUDIO_MODEL` to the model identifier reported by LM Studio.
5. Change `LM_STUDIO_BASE_URL` if needed; otherwise it defaults to `http://localhost:1234/v1`.

The repository does not require one hard-coded text model. Multimodal prompts require a model with compatible image-input support.

## Black Forest Labs Setup

Image generation uses Black Forest Labs with `flux-2-klein-4b`.

1. Obtain Black Forest Labs API access.
2. Set `BFL_API_KEY` in `.env.local`.
3. Keep the key server-side; never prefix it with `NEXT_PUBLIC_`.

Without `BFL_API_KEY`, text chat can still be configured independently, while image requests return a controlled configuration error.

## Testing

Tests cover authentication, validation, chat persistence, history filtering and folders, text cancellation, image generation and reuse, profile/avatar workflows, deletion, Storage helpers, and AI-provider behavior.

```bash
npm test
npm run lint
npm run build
```

Watch mode and a direct TypeScript check are also available:

```bash
npm run test:watch
npx tsc --noEmit
```

Tests use mocks and do not require production Supabase mutations or paid AI requests.

## Security

- Passwords are hashed with `bcryptjs`; hashes are never returned to the browser.
- JWTs use HTTP-only, same-site cookies and persisted revocable sessions.
- Protected Route Handlers validate the profile and resource ownership.
- Database and Storage access uses a server-only Supabase service-role client.
- The browser has no privileged Supabase client.
- Storage buckets are private and display uses temporary signed URLs.
- Generated-image downloads use an authenticated ownership-checking route.
- `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `BFL_API_KEY` remain server-side.
- Account deletion is scoped to the authenticated profile and requires explicit confirmation.
- Assistant Markdown is rendered with `marked` and sanitized with `isomorphic-dompurify`.

These controls establish trust boundaries but do not replace deployment-specific security review and operational hardening.

