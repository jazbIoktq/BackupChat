// client.js
const socket = io();

// --- Elements ---
const joinScreen = document.getElementById('join-screen');
const chatScreen = document.getElementById('chat-screen');
const nameInput = document.getElementById('name-input');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const roomListEl = document.getElementById('room-list');

const messagesEl = document.getElementById('messages');
const form = document.getElementById('message-form');
const input = document.getElementById('message-input');
const userCountEl = document.getElementById('user-count');
const roomNameEl = document.getElementById('room-name');
const switchRoomBtn = document.getElementById('switch-room-btn');

const replyPreview = document.getElementById('reply-preview');
const replyPreviewName = document.getElementById('reply-preview-name');
const replyPreviewSnippet = document.getElementById('reply-preview-snippet');
const replyCancelBtn = document.getElementById('reply-cancel-btn');

const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');
const imagePreview = document.getElementById('image-preview');
const imagePreviewThumb = document.getElementById('image-preview-thumb');
const imageCancelBtn = document.getElementById('image-cancel-btn');

// --- State ---
let myName = localStorage.getItem('chat_name') || '';
let currentRoom = '';
let replyingTo = null;   // { id, name, text }
let pendingImage = null; // data URL string, ready to send

// --- Join flow ---
nameInput.value = myName;

function renderRoomList(rooms) {
  roomListEl.innerHTML = '';
  if (!rooms || rooms.length === 0) {
    roomListEl.innerHTML = '<div class="directory-empty">No active rooms yet — start one above.</div>';
    return;
  }
  rooms.forEach((r, i) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'room-row';
    row.innerHTML = `
      <span class="room-num">${String(i + 1).padStart(3, '0')}</span>
      <span class="room-row-name">${escapeHtml(r.name)}</span>
      <span class="room-row-count">${r.userCount} here</span>
    `;
    row.addEventListener('click', () => { roomInput.value = r.name; });
    roomListEl.appendChild(row);
  });
}

socket.on('rooms_list', renderRoomList);

function attemptJoin(name, room) {
  myName = name;
  localStorage.setItem('chat_name', name);
  socket.emit('join', { name, room });
}

joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }
  const room = roomInput.value.trim() || 'lobby';
  attemptJoin(name, room);
});

[nameInput, roomInput].forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinBtn.click();
  });
});

switchRoomBtn.addEventListener('click', () => {
  chatScreen.classList.add('hidden');
  joinScreen.classList.remove('hidden');
  roomInput.value = '';
  roomInput.focus();
  socket.emit('get_rooms');
});

socket.on('joined', ({ room }) => {
  currentRoom = room;
  roomNameEl.textContent = room;
  joinScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  clearReply();
  clearImage();
  input.focus();
});

// --- Messages ---
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderMessage(msg) {
  if (msg.type === 'system') {
    const row = document.createElement('div');
    row.className = 'msg-row system-row';
    row.innerHTML = `<div class="msg system">${escapeHtml(msg.text)}</div>`;
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return;
  }

  const isMe = msg.name === myName;
  const row = document.createElement('div');
  row.className = `msg-row ${isMe ? 'me' : 'other'}`;
  row.dataset.id = msg.id;

  let replyHtml = '';
  if (msg.replyTo) {
    replyHtml = `
      <span class="msg-reply-quote">
        <span class="reply-name">${escapeHtml(msg.replyTo.name)}</span>${escapeHtml(msg.replyTo.text)}
      </span>`;
  }

  let imageHtml = '';
  if (msg.image) {
    imageHtml = `<img class="msg-image" src="${msg.image}" alt="Shared image" />`;
  }

  let textHtml = '';
  if (msg.text) {
    textHtml = `<span class="msg-text">${escapeHtml(msg.text)}</span>`;
  }

  row.innerHTML = `
    <div class="msg">
      ${isMe ? '' : `<span class="name">${escapeHtml(msg.name)}</span>`}
      ${replyHtml}
      ${imageHtml}
      ${textHtml}
    </div>
    <div class="msg-actions">
      <button type="button" class="reply-btn">Reply</button>
    </div>
  `;

  row.querySelector('.reply-btn').addEventListener('click', () => {
    startReply(msg);
  });

  const img = row.querySelector('.msg-image');
  if (img) {
    img.addEventListener('click', () => window.open(msg.image, '_blank'));
  }

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

socket.on('history', (history) => {
  messagesEl.innerHTML = '';
  history.forEach(renderMessage);
});

socket.on('message', renderMessage);

socket.on('user_count', (count) => {
  userCountEl.textContent = `${count} here`;
});

socket.on('send_error', (text) => {
  alert(text);
});

// --- Replies ---
function startReply(msg) {
  replyingTo = {
    id: msg.id,
    name: msg.name,
    text: msg.text || (msg.image ? '📷 Image' : ''),
  };
  replyPreviewName.textContent = replyingTo.name;
  replyPreviewSnippet.textContent = replyingTo.text;
  replyPreview.classList.remove('hidden');
  input.focus();
}

function clearReply() {
  replyingTo = null;
  replyPreview.classList.add('hidden');
}

replyCancelBtn.addEventListener('click', clearReply);

// --- Image attach ---
attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Please choose an image file.');
    return;
  }
  compressImage(file, (dataUrl) => {
    pendingImage = dataUrl;
    imagePreviewThumb.src = dataUrl;
    imagePreview.classList.remove('hidden');
  });
});

function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1000;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  pendingImage = null;
  imagePreview.classList.add('hidden');
  imagePreviewThumb.src = '';
}

imageCancelBtn.addEventListener('click', clearImage);

// --- Sending ---
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text && !pendingImage) return;

  socket.emit('chat_message', {
    text,
    image: pendingImage,
    replyTo: replyingTo,
  });

  input.value = '';
  clearReply();
  clearImage();
});
