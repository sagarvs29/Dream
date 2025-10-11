# projectil

A full-stack web application with a Node.js/Express backend and a React (Vite) frontend. This repository hosts both services and is configured for local development on Windows.

## Tech Stack
- Backend: Node.js (ES Modules), Express, Mongoose, JWT, Multer, Cloudinary
- Frontend: React 19 + Vite, React Router, Tailwind CSS v4
- Dev tools: ESLint, Nodemon

## Monorepo Layout
```
backend/
  server.js                # Express app entry
  routes/                  # API routes (auth, identity, chat, portal, etc.)
  models/                  # Mongoose models
  middleware/              # Auth and rate limiter middleware
  utils/                   # Helper utilities (audit, cloudinary, otp store)
  data/                    # Mock data

frontend/
  il/                      # Vite React app
    src/                   # React source (pages, components)
    public/                # Static assets
```

## Prerequisites
- Node.js 18+ and npm
- A MongoDB connection string
- (Optional) Cloudinary credentials for media uploads

## Environment variables
Create a `.env` file in `backend/` with at least:
```
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
WEB_ORIGIN=http://localhost:5173
# Optional seed admin overrides
SEED_SERVER_ADMIN_EMAIL=server.admin@example.com
SEED_SERVER_ADMIN_NAME=Server Admin
SEED_SERVER_ADMIN_PASSWORD=ChangeMe@123
# Optional for Cloudinary uploads
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## Install and run (Windows PowerShell)
Open two terminals at the repo root.

1) Backend
```powershell
cd backend
npm install
npm run dev  # or: npm start
```
The API starts on http://localhost:5000 by default and exposes `/api/health`.

2) Frontend
```powershell
cd frontend/il
npm install
npm run dev
```
Vite serves the app on http://localhost:5173.

If you see a CORS error, ensure `WEB_ORIGIN` is set to the exact Vite URL and restart the backend. The backend allows localhost:5173/5174 by default.

## Common scripts
- Backend
  - `npm run dev`: Start with Nodemon (auto-restart on changes)
  - `npm start`: Start with Node
- Frontend
  - `npm run dev`: Start Vite dev server
  - `npm run build`: Build production assets
  - `npm run preview`: Preview the built app

## Notes
- The backend seeds a SERVER admin and a couple of sample schools at startup when empty.
- Chat, mentee management, and portal routes are namespaced under `/api/*` and `/api/portal/*`.
- Tailwind v4 is already configured for the frontend; styles live in `src/styles/`.

## Troubleshooting
- Frontend dev server fails to start (Exit Code 1): run `npm install` inside `frontend/il` first. Check the terminal for the exact error.
- CORS blocked: confirm `WEB_ORIGIN` and that you restarted the backend after changes.
- Mongo connection error: verify `MONGO_URI` and network access to your cluster.

## StudentHomePostsAgent (LLM prompt)
The exact system prompt for the Student Home Posts agent lives at:

- `frontend/il/src/ai/studentHomePostsAgent.js`

Exports:
- `STUDENT_HOME_POSTS_SYSTEM_PROMPT`: copy-ready system prompt string
- `buildAgentInput(payload)`: helper to build/clean the agent input JSON
- `safeParseAgentJson(json)`: safe JSON parsing for agent responses
- `toChatMessages(input)`: convenience to build messages for chat LLMs

Example usage (pseudo-code):

```js
import { STUDENT_HOME_POSTS_SYSTEM_PROMPT, buildAgentInput, safeParseAgentJson } from "./src/ai/studentHomePostsAgent";

const input = buildAgentInput({ event: "createPost", owner: { id: "u1", schoolId: "s1", profileVisibility: "school" }, post: { media: [{ kind: "image", url: "https://..." }], caption: "Great work! #art" } });
const messages = [
  { role: "system", content: STUDENT_HOME_POSTS_SYSTEM_PROMPT },
  { role: "user", content: JSON.stringify(input) }
];
// const llmResult = await callYourLLM(messages);
// const data = safeParseAgentJson(llmResult.content);
```

## License
This repository currently has no explicit license. Add one if you plan to share or open-source the project.
