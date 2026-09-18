lumen
Change++ Fall 2026 Coding Challenge

Full name: Riya Patel
Vanderbilt email: riya.c.patel@vanderbilt.edu



ABOUT
================================================================================
lumen is an image saving/sharing app (Pinterest-style). Find images using Pixabay,
save them into boards/collections, share boards, invite collaborators by user, and
friend users to browse their public boards.

Tech stack:
  frontend: Vite + React + TypeScript + Mantine
  backend:  Express + TypeScript
  database: MongoDB (Mongoose)
  images:   Pixabay api
  auth:     JWT (Bearer token)

Repo layout:
  README.md              — challenge instructions
  README.txt             — this file

  client/                — React frontend (dev: http://localhost:5173)
    .env.example         — notes (no required client secrets; API via proxy)
    vite.config.ts       — Vite config; proxies /api → :3001
    src/
      main.tsx           — app entry (Mantine + router + auth)
      App.tsx            — routes
      theme.ts           — Mantine theme tokens
      index.css          — global / lumen UI styles
      api/               — fetch helper + JWT token storage
      auth/              — AuthContext (login / register / session)
      layout/            — AppLayout (topbar + nav)
      components/        — shared UI
      pages/             — Discover, Collections, CollectionDetail,
                           PublicBoard, Friends, Login, Register, Profile

  server/                — Express API (dev: http://localhost:3001)
    .env.example         — sample env vars (copy to .env)
    .env                 — secrets (not committed): Mongo, JWT, Pixabay
    src/
      index.ts           — server entry, CORS, mounts /api routes
      middleware/        — JWT requireAuth
      models/            — User, Collection, CollectionItem,
                           SavedImage, Friendship
      routes/            — auth, collections, images, share links, friends
      services/          — helpers



HOW TO RUN
================================================================================
prereqs:
  - Node.js 20+
  - MongoDB running locally (or a MongoDB Atlas connection string)
  - Pixabay API key: https://pixabay.com/api/docs/

1) backend
   cd server
   npm install
   copy .env.example to .env and fill in:

     MONGODB_URI=mongodb://127.0.0.1:27017/lumen
     JWT_SECRET=any-long-random-string
     PIXABAY_API_KEY=your_pixabay_key
     PORT=3001
     CLIENT_ORIGIN=http://localhost:5173

   npm run dev

2) frontend (new terminal)
   cd client
   npm install
   npm run dev

3) open http://localhost:5173
   register an account, then use Discover / Collections / Friends.
   the Vite dev server proxies /api to the backend on port 3001



DATA MODEL (high level)
================================================================================
User            — username, email, passwordHash
SavedImage      — per-user Pixabay image (deduped by pixabayId)
Collection      — board: title, visibility (private|public), shareSlug,
                  collaboratorIds, isLibrary (system Library board)
CollectionItem  — Collection ↔ SavedImage join + order
Friendship      — requester/recipient + status (pending|accepted)



REFLECTION
================================================================================
I learned a lot building a full-stack app with a real database and JWT auth.
Prior, I had not worked on a polished full-stack app fully solo, so this gave 
me a lot of experience with backend and set up that I did not have previously.
I also had to think a lot about permissions because of board sharing and collab.
My main challenge this project was keeping the UI fast while loading a lot of 
images and keeping the flows clean.



FEEDBACK
================================================================================
Clear rubric and Pixabay suggestion helped a lot. Office hour and challenge times
were inconvienient for me, so I did not get much value from them (though I hope 
it helped others!).








ui inspo: https://galekto.com/contact