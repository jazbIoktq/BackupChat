# Lobby — a one-room chat app

A tiny chat app: everyone who opens the link is in the same room and can message
back and forth in real time. No accounts, no database — just a name and a message box.

It works for anyone on any network (wifi, mobile data, anywhere) because the
server lives on the internet, not on your computer.

## How it works
- **Server**: Node.js + Express + Socket.io (`server.js`). Holds the room, broadcasts
  messages to everyone connected, keeps the last 50 messages in memory so late
  joiners see recent context.
- **Client**: plain HTML/CSS/JS (`public/`). Asks for a name once (saved on that
  device), then shows the chat.
- No database. Messages disappear if the server restarts — that's the trade-off
  for "very simple" and free.

## Deploy it for free on Render

1. **Put this folder in a GitHub repo.**
   - Create a new repo on GitHub.
   - Upload these files (`server.js`, `package.json`, `public/`) to it,
     or from your computer:
     ```
     cd chat-app
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
     git push -u origin main
     ```

2. **Create the Render service.**
   - Go to https://render.com and sign up / log in (free tier is fine, no card needed for this).
   - Click **New +** → **Web Service**.
   - Connect your GitHub account and pick the repo you just pushed.
   - Render auto-detects Node. Set:
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Instance Type**: Free
   - Click **Create Web Service**.

3. **Wait for the build**, then Render gives you a public URL like
   `https://your-app-name.onrender.com`. Open it — that's your chat room.
   Send that link to anyone you want in the room; they just open it on any
   device with internet and pick a name.

### One thing to know about Render's free tier
Free web services "spin down" after ~15 minutes with no traffic, and take
10–30 seconds to wake back up on the next visit. That's fine for casual use —
the first message after a quiet period just takes a few extra seconds to land.
Nothing to fix, just expected behavior of the free tier.

## Running it locally first (optional)
```
npm install
npm start
```
Then open `http://localhost:3000` in a couple of browser tabs to try it before
deploying.

## Easy tweaks you might want later
- **Persist messages** across restarts: swap the in-memory `history` array in
  `server.js` for a small database (Render also offers a free Postgres tier).
- **Multiple rooms**: add a room name to the URL and namespace the Socket.io
  events by room.
- **Avoid the sleep delay**: any paid Render plan keeps the service always-on,
  or you can ping the URL every 10 minutes from a free uptime-monitoring
  service to keep it awake (not officially encouraged by Render, but commonly done).
