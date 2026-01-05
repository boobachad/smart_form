## 1. Project Overview & Identity
- **Name**: Smart Form
- **Type**: Full-stack Web Application
- **Core Functionality & Domain Concept**: "Smart Form" is an advanced form builder and data collection platform designed for organizations (e.g., hackathons, tech clubs, recruiters) that need to verify technical credentials. Unlike standard form builders, Smart Form features "Smart Fields" which automatically fetch and verify respondent statistics from external coding and developer platforms (such as LeetCode, Codeforces, and GitHub). 
  - **Form Creation**: Form Creators can build custom forms with standard fields (text, multiple-choice), Smart Fields, and a built-in "Applicant Identity Card" to securely collect Name/Email.
  - **Verification Engine & Verdicts**: Smart fields can be configured with Logic Criteria (e.g., `rating >= 1500`). Upon submission, the backend evaluates these thresholds and assigns an automated verdict (`ELIGIBLE`, `INELIGIBLE`, or `PENDING`) to the submission.
  - **Live & Asynchronous Verification**: Respondents can trigger a live interactive fetch while filling out the form to instantly see their stats. Submissions can also be processed asynchronously via background `Asynq` workers (batch processing). All fetches are strictly rate-limited to prevent API abuse.
  - **Dashboard & Preview Mode**: Form Creators can preview forms (which safely isolates test submissions) and use the dashboard to view real submissions, check verification statuses, and optionally flag discrepancies.
- **Frontend Stack**: React 19, React Router v7 (Vite), Tailwind CSS v4, Radix UI.
- **Backend Stack**: Go 1.25, Gin (HTTP framework), pgx (PostgreSQL driver for Go), Redis, Asynq (Task Queue for async processing), Firebase Auth (for Google Login & token verification).
- **Runtime / Environment**: Node/Bun for frontend tooling, Go for backend, Portless for local proxy networking.

### Technical Foundations
- **State & Data Fetching**: React Router v7 routing loaders and actions are the primary backbone for data fetching.
- **Authentication Flow**: Users authenticate via Firebase Google Login on the frontend (`frontend/src/lib/auth-client.ts`). The frontend retrieves a token and sends it to the Go backend (`POST /api/v1/auth/google-login`). The backend validates this via Firebase Admin SDK (`backend/internal/api/handlers/auth.go`) and sets a secure, HTTP-only session cookie utilizing `gin-contrib/sessions`.
- **Security**: The backend enforces CSRF protection using `github.com/utrack/gin-csrf` and strict security headers. 

## 2. Essential Commands
- **Start Both Servers (Local Dev)**: `./start.sh` (Runs Portless proxy, backend, and frontend concurrently on port 1355). This handles graceful termination via `SIGINT` trapping.
- **Backend Run**: `cd backend && bun x portless api.smart-form --force go run cmd/server/main.go`
- **Frontend Run**: `cd frontend && bun x portless smart-form --force bun run dev`
- **Frontend Build**: `cd frontend && bun run build` (runs `react-router build`)
- **Frontend Typecheck**: `cd frontend && bun run typecheck` (runs `react-router typegen && tsc`)

## 3. Architecture & Directory Boundaries
### Backend (`backend/`)
- `cmd/server/main.go`: Application entry point. Initializes config, database, Redis, Asynq queue, and Gin server.
- `internal/api/router.go`: Defines all Gin routes, applies security/CSRF middlewares, and maps endpoints to `handlers`.
- `internal/api/handlers/`: Contains HTTP route handlers. E.g., `forms.go` (CRUD for forms), `submissions.go` (CRUD & flagging for submissions), `queue.go` (enqueuing async verification jobs), and `auth.go` (handling session establishment).
- `internal/api/middleware/`: Contains `AuthRequired()` middleware which strictly verifies session cookies.
- `internal/db/`: Contains `db.go` for pgx connection pooling and `redis.go` for Redis client setup.
- `internal/domain/`: The single source of truth for all core Go structs and types (e.g., Form, Submission, VerificationConfig). All packages import from here to prevent cyclic dependencies.
- `internal/queue/`: Manages Asynq background jobs. `client.go` exposes enqueueing capabilities. `tasks.go` defines job payloads (e.g. scoping to LeetCode, Codeforces, GitHub). `worker.go` processes async form verifications off the main request thread.
- `internal/verification/`: Contains the core verification engine and external API clients (`leetcode.go`, `codeforces.go`, `github.go`). Used by background workers to securely fetch respondent stats.

### Frontend (`frontend/`)
- `vite.config.ts`: Configures Vite, Tailwind v4, React Router dev plugin, and proxies `/api` to `https://api.smart-form.localhost:1355`.
- `src/routes/`: Route components adhering to React Router v7 file-based conventions (`form.$id.edit.tsx`, `form.$id.view.tsx`, `login.tsx`, `workspace.tsx`).
- `src/lib/`: Essential utilities:
  - `auth-client.ts`: Abstraction for communicating with backend auth endpoints.
  - `firebase.ts`: Firebase initialization for client-side Google auth.
  - `object-utils.ts` / `table-sorting.ts`: Data manipulation helpers.
- `src/components/`: Reusable UI components. Strongly reliant on Radix UI primitives and Tailwind CSS.
- `package.json` & `bun.lock`: Managed entirely via Bun. Uses React 19.

## 4. Coding Standards & Idioms
- **Backend (Go)**:
  - **Domain-Driven Architecture**: The `internal/domain` package is the strict, isolated source of truth for all data structures to prevent cyclic dependencies.
  - **Database Access**: Direct SQL via `pgx` pool instead of an ORM like GORM. All queries MUST be parameterized to prevent SQL injection.
  - **Session Management**: Rely on cookie-based sessions established by `gin-contrib/sessions` rather than passing raw JWTs in headers for subsequent requests. The Firebase token is ONLY used initially to prove identity to the backend.
  - **Async Processing**: Any heavy task (like bulk form submission verification) MUST be offloaded to `Asynq`. Route handlers should enqueue the task via `queue.client` and immediately return a job ID to the client. The client polls `/api/v1/jobs/:id/status`.
  - **Platform Capabilities**: `internal/config/capabilities.go` is the source of truth for which external API metrics (LeetCode, Codeforces, GitHub) are supported.
  - **CSRF Token**: Non-GET/HEAD requests require a valid `X-CSRF-Token` header.
- **Frontend (React)**:
  - **UI/UX Design Philosophy**: Clean, serious, and professional. **NO fluff and absolutely NO gradients.** Interfaces should rely on thick borders, monochrome text, and sharp structural boxes, though rounded corners (e.g., `rounded-md`, `rounded-lg`) are perfectly acceptable and encouraged.
  - **Form Component Architecture**: All form inputs (both Smart Fields and standard fields like text, email, number) MUST utilize the `FusedGroup`, `FusedInput`, and `FusedLabel` components from `@/components/ui/fused-group` to maintain a consistent, unified boxed-icon aesthetic. Dynamic standard icons (e.g., `AtSign` for email, `23` for numbers, `Type` for text) must be strictly aligned with platform icons.
  - **Routing & Fetching**: Utilize React Router v7 primitives (`loader`, `action`, `useFetcher`, `useLoaderData`). 
  - **Styling**: Strictly utilize Tailwind CSS v4 patterns. For complex interactive components, compose Radix UI primitives rather than building from scratch.
  - **Type Safety**: Avoid `any`. Leverage `zod` for form validation and strict TypeScript interfaces for API responses. All builds must pass `tsc` cleanly.
  - **State Management**: 
    - *Form Builder (Creator View)*: Relies on `Zustand` (`store/form-builder-store.ts`) for complex drag-and-drop state.
    - *Form Filling (Respondent View)*: State and submission validation logic is heavily centralized in `hooks/use-form-viewer.ts`. Validation runs here before hitting the backend.
