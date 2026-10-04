# Lijie's Portfolio

Personal portfolio and private photo archive built with Next.js. The site has a public entry page, resume and portfolio routes, an authenticated admin area, Supabase-backed picture data, Cloudflare R2/S3-compatible image uploads, AI-assisted image analysis/translation, and semantic picture search.

## Tech Stack

- Next.js 15 App Router
- React 18 and TypeScript
- Tailwind CSS and shadcn/ui-style components
- Supabase Auth, Database, and RPC functions
- Cloudflare R2 or another S3-compatible object store
- OpenAI or Azure OpenAI for image analysis and translation
- Jina/Hugging Face/custom embedding endpoints for semantic picture search

## Repository Layout

```text
app/                         Next.js routes and API handlers
components/                  UI and portfolio/admin components
components/ui/               Shared primitive UI components
data/                        Static portfolio seed data
docs/                        Supabase SQL and feature notes
hooks/                       React hooks
lib/                         Shared app utilities and domain helpers
public/                      Public images and static assets
scripts/                     Backfill/debug scripts and embedding service tools
utils/                       Supabase, R2, auth, and server helpers
```

## Prerequisites

- Node.js 20 LTS recommended
- pnpm
- A Supabase project
- An R2/S3-compatible bucket for uploaded images
- Optional: OpenAI/Azure OpenAI and Jina/Hugging Face credentials for AI features

Enable pnpm with Corepack if needed:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

## Local Setup

1. Clone the repository and enter the project:

```bash
git clone https://github.com/Cunyli/PrivateWeb.git
cd PrivateWeb
```

2. Install dependencies:

```bash
pnpm install
```

3. Create your local environment file:

```bash
cp .env.example .env
```

4. Fill in at least these required values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_BUCKET_URL=
ADMIN_EMAILS=
NEXT_PUBLIC_ADMIN_EMAILS=
```

5. Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

The full template is in `.env.example`. Keep real values in `.env` locally or in your deployment provider's secret manager.

Required for the core site:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase browser anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-only key used by admin API routes and scripts.
- `NEXT_PUBLIC_BUCKET_URL`: Public base URL for image assets.
- `ADMIN_EMAILS`: Comma-separated admin email allowlist for server checks.
- `NEXT_PUBLIC_ADMIN_EMAILS`: Comma-separated admin email allowlist used by client-side admin UI.

Required for uploads:

- `R2_ENDPOINT_URL`
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Optional AI configuration:

- Use `OPENAI_API_KEY`, `OPENAI_VISION_MODEL`, and `OPENAI_TRANSLATION_MODEL` for OpenAI.
- Or use `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_VERSION`, and `AZURE_OPENAI_DEPLOYMENT` for Azure OpenAI.
- Use `JINA_API_KEY`, `JINA_EMBEDDING_MODEL`, `JINA_EMBEDDING_DIMENSIONS`, and `SEMANTIC_EMBEDDING_PROVIDER` for semantic picture search.
- For a custom embedding service, set `TEXT_EMBEDDING_API_URL` and/or `IMAGE_EMBEDDING_API_URL`.

## Supabase Setup

Run the SQL files in `docs/` from the Supabase SQL Editor as needed:

- `docs/supabase-policies.sql`: row-level security policies.
- `docs/add-location-translations.sql`: multilingual location fields.
- `docs/add-image-variants.sql`: image variant metadata.
- `docs/upgrade-picture-embeddings-1024.sql`: 1024-dimensional vector embeddings and matching RPC.
- `docs/ai-tasks.sql`: private AI/work task table used by the authenticated `/ai-feed` workspace.

Semantic search also depends on the `picture_embeddings` table and `match_pictures_by_embedding` RPC described in `docs/semantic-picture-search.md`.

## Common Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm backfill:picture-embeddings -- --limit 3 --dry-run
```

Use the backfill command only after Supabase and embedding credentials are configured. For a production backfill, read `docs/semantic-picture-search.md` first.

## Deployment

The easiest deployment target is Vercel:

1. Import the GitHub repository in Vercel.
2. Set all required environment variables in the Vercel project settings.
3. Configure the Supabase database and R2 bucket before the first production admin upload.
4. Deploy from the `main` branch.

Before publishing the repository publicly, review `public/private/` and any committed images to make sure they are intended to be visible.

## GitHub Hygiene

- Do not commit `.env`, `.vercel/`, `.next/`, `node_modules/`, logs, test output, or TypeScript build info.
- Keep `.env.example` updated whenever a new environment variable is added.
- Prefer documenting database changes in `docs/` together with the SQL migration.
- If generated files were committed in the past, remove them from the Git index after updating `.gitignore`:

```bash
git rm --cached .DS_Store tsconfig.tsbuildinfo
```
