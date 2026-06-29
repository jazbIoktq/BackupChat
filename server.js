// server.js
// Multi-room chat. Rooms are created on the fly when someone joins one.
// Messages live in memory only (cleared on server restart) - keep it simple.

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Default is 1MB, which is too small once people start sending images.
  maxHttpBufferSize: 3 * 1024 * 1024, // 3MB
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const MAX_HISTORY = 50;
const MAX_ROOMS = 100;
const MAX_IMAGE_CHARS = 2_200_000; // ~1.6MB binary once base64-decoded
const DEFAULT_ROOM = 'lobby';

// roomName -> { history: [], users: Map<socketId, name>, lastActivity: number }
const rooms = new Map();

function sanitizeName(name) {
  return String(name || 'Anonymous').slice(0, 24).trim() || 'Anonymous';
}

function sanitizeRoom(room) {
  const clean = String(room || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 _-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 24);
  return clean || DEFAULT_ROOM;
}

function getOrCreateRoom(roomName) {
  let r = rooms.get(roomName);
  if (!r) {
    pruneRoomsIfNeeded();
    r = { history: [], users: new Map(), lastActivity: Date.now() };
    rooms.set(roomName, r);
  }
  return r;
}

function pruneRoomsIfNeeded() {
  if (rooms.size < MAX_ROOMS) return;
  // Drop the least-recently-active empty room to make space.
  let oldestEmptyName = null;
  let oldestTime = Infinity;
  for (const [name, r] of rooms.entries()) {
    if (r.users.size === 0 && r.lastActivity < oldestTime) {
      oldestTime = r.lastActivity;
      oldestEmptyName = name;
    }
  }
  if (oldestEmptyName) rooms.delete(oldestEmptyName);
}

function addHistory(room, msg) {
  room.history.push(msg);
  if (room.history.length > MAX_HISTORY) room.history.shift();
}

function makeSystemMsg(text) {
  return { id: crypto.randomUUID(), type: 'system', text, timestamp: Date.now() };
}

function roomsSummary() {
  return Array.from(rooms.entries())
    .filter(([name, r]) => r.users.size > 0 || name === DEFAULT_ROOM)
    .sort((a, b) => b[1].lastActivity - a[1].lastActivity)
    .slice(0, 12)
    .map(([name, r]) => ({ name, userCount: r.users.size }));
}

function broadcastRoomList() {
  io.emit('rooms_list', roomsSummary());
}

function broadcastUserCount(roomName) {
  const r = rooms.get(roomName);
  if (!r) return;
  io.to(roomName).emit('user_count', r.users.size);
}

function leaveCurrentRoom(socket) {
  const roomName = socket.data.room;
  if (!roomName) return;
  const r = rooms.get(roomName);
  socket.leave(roomName);
  if (!r) return;

  const name = r.users.get(socket.id);
  r.users.delete(socket.id);

  if (name) {
    const sysMsg = makeSystemMsg(`${name} left the room`);
    addHistory(r, sysMsg);
    io.to(roomName).emit('message', sysMsg);
  }

  broadcastUserCount(roomName);
  broadcastRoomList();
}

// Make sure the default room always exists so the directory never looks empty.
getOrCreateRoom(DEFAULT_ROOM);

io.on('connection', (socket) => {
  socket.emit('rooms_list', roomsSummary());

  socket.on('get_rooms', () => {
    socket.emit('rooms_list', roomsSummary());
  });

  socket.on('join', ({ name, room } = {}) => {
    const safeName = sanitizeName(name);
    const roomName = sanitizeRoom(room);

    if (socket.data.room && socket.data.room !== roomName) {
      leaveCurrentRoom(socket);
    }

    const r = getOrCreateRoom(roomName);
    socket.join(roomName);
    r.users.set(socket.id, safeName);
    r.lastActivity = Date.now();

    socket.data.name = safeName;
    socket.data.room = roomName;

    socket.emit('joined', { room: roomName });
    socket.emit('history', r.history);

    const sysMsg = makeSystemMsg(`${safeName} joined the room`);
    addHistory(r, sysMsg);
    io.to(roomName).emit('message', sysMsg);

    broadcastUserCount(roomName);
    broadcastRoomList();
  });

  socket.on('chat_message', (payload = {}) => {
    const roomName = socket.data.room;
    if (!roomName) return;
    const r = rooms.get(roomName);
    if (!r) return;

    const text = String(payload.text || '').slice(0, 500).trim();
    let image = null;
    if (typeof payload.image === 'string' && payload.image.startsWith('data:image/')) {
      if (payload.image.length <= MAX_IMAGE_CHARS) {
        image = payload.image;
      } else {
        socket.emit('send_error', 'That image is too large. Try a smaller one.');
      }
    }

    if (!text && !image) return;

    let replyTo = null;
    if (payload.replyTo && payload.replyTo.id) {
      replyTo = {
        id: String(payload.replyTo.id).slice(0, 64),
        name: sanitizeName(payload.replyTo.name),
        text: String(payload.replyTo.text || '').slice(0, 120),
      };
    }

    const msg = {
      id: crypto.randomUUID(),
      type: 'chat',
      name: socket.data.name || 'Anonymous',
      text,
      image,
      replyTo,
      timestamp: Date.now(),
    };

    addHistory(r, msg);
    r.lastActivity = Date.now();
    io.to(roomName).emit('message', msg);
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Chat server running on port ${PORT}`);
});
