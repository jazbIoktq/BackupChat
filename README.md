Lobby — a one-room chat app
A tiny chat app: everyone who opens the link is in the same room and can message
back and forth in real time. No accounts, no database — just a name and a message box.
It works for anyone on any network (wifi, mobile data, anywhere) because the
server lives on the internet, not on your computer.
How it works
Server: Node.js + Express + Socket.io (`server.js`). Tracks any number of
rooms (created automatically the first time someone joins one), broadcasts
messages only to people in the same room, keeps the last 50 messages per
room in memory so late joiners see recent context.
Client: plain HTML/CSS/JS (`public/`). Asks for a name and a room once
(name is saved on that device), shows a live directory of active rooms to
join, then shows the chat.
Rooms: type any room name to create or join it. The directory on the
join screen lists active rooms with how many people are in each — click one
to fill it in. Switch rooms anytime with the "Switch" button in the chat header.
Replies: hover/tap a message and click "Reply" to quote it in your next message.
Images: the paperclip button attaches an image. It's resized and compressed
in the browser before sending, so it stays small and fast over any connection.
No database. Messages disappear if the server restarts — that's the trade-off
for "very simple" and free.
Deploy it for free on Render
Put this folder in a GitHub repo.
Create a new repo on GitHub.
Upload these files (`server.js`, `package.json`, `public/`) to it,
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
Create the Render service.
Go to https://render.com and sign up / log in (free tier is fine, no card needed for this).
Click New + → Web Service.
Connect your GitHub account and pick the repo you just pushed.
Render auto-detects Node. Set:
Build Command: `npm install`
Start Command: `npm start`
Instance Type: Free
Click Create Web Service.
Wait for the build, then Render gives you a public URL like
`https://your-app-name.onrender.com`. Open it — that's your chat room.
Send that link to anyone you want in the room; they just open it on any
device with internet and pick a name.
One thing to know about Render's free tier
Free web services "spin down" after ~15 minutes with no traffic, and take
10–30 seconds to wake back up on the next visit. That's fine for casual use —
the first message after a quiet period just takes a few extra seconds to land.
Nothing to fix, just expected behavior of the free tier.
Running it locally first (optional)
```
npm install
npm start
```
Then open `http://localhost:3000` in a couple of browser tabs to try it before
deploying.
Easy tweaks you might want later
Persist messages across restarts: swap the in-memory `history` arrays in
`server.js` for a small database (Render also offers a free Postgres tier).
Avoid the sleep delay: any paid Render plan keeps the service always-on,
or you can ping the URL every 10 minutes from a free uptime-monitoring
service to keep it awake (not officially encouraged by Render, but commonly done).
Bigger image limit: images are capped around ~1.6MB after compression
(`MAX_IMAGE_CHARS` in `server.js`, plus `maxHttpBufferSize` on the Socket.io
server). Raise both together if you need more headroom.
