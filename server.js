// server.js
// One shared chat room. Anyone who opens the site joins the same room.
// Messages live in memory only (cleared on server restart) - keep it simple.

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve the front-end
app.use(express.static(path.join(__dirname, 'public')));

// Keep a small rolling history so people who join late see recent context
const MAX_HISTORY = 50;
const history = [];

// Track who's online (socket.id -> name)
const onlineUsers = new Map();

function broadcastUserCount() {
  io.emit('user_count', onlineUsers.size);
}

io.on('connection', (socket) => {
  // Send recent history to the newly connected client
  socket.emit('history', history);

  socket.on('join', (name) => {
    const safeName = String(name || 'Anonymous').slice(0, 24).trim() || 'Anonymous';
    onlineUsers.set(socket.id, safeName);

    const systemMsg = {
      type: 'system',
      text: `${safeName} joined the chat`,
      timestamp: Date.now(),
    };
    history.push(systemMsg);
    if (history.length > MAX_HISTORY) history.shift();

    io.emit('message', systemMsg);
    broadcastUserCount();
  });

  socket.on('chat_message', (text) => {
    const name = onlineUsers.get(socket.id) || 'Anonymous';
    const clean = String(text || '').slice(0, 500).trim();
    if (!clean) return;

    const msg = {
      type: 'chat',
      name,
      text: clean,
      timestamp: Date.now(),
    };

    history.push(msg);
    if (history.length > MAX_HISTORY) history.shift();

    io.emit('message', msg);
  });

  socket.on('disconnect', () => {
    const name = onlineUsers.get(socket.id);
    if (name) {
      onlineUsers.delete(socket.id);
      const systemMsg = {
        type: 'system',
        text: `${name} left the chat`,
        timestamp: Date.now(),
      };
      history.push(systemMsg);
      if (history.length > MAX_HISTORY) history.shift();

      io.emit('message', systemMsg);
      broadcastUserCount();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Chat server running on port ${PORT}`);
});
