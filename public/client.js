// client.js
const socket = io();

// --- Elements: join screen ---
const joinScreen = document.getElementById('join-screen');
const nameInput = document.getElementById('name-input');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const roomListEl = document.getElementById('room-list');

// --- Elements: chat screen ---
const chatScreen = document.getElementById('chat-screen');
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

// --- Elements: people panel ---
const peopleBtn = document.getElementById('people-btn');
const peoplePanel = document.getElementById('people-panel');
const peopleCloseBtn = document.getElementById('people-close-btn');
const peopleListEl = document.getElementById('people-list');

// --- Elements: DM screen ---
const dmScreen = document.getElementById('dm-screen');
const dmBackBtn = document.getElementById('dm-back-btn');
const dmNameEl = document.getElementById('dm-name');
const dmMessagesEl = document.getElementById('dm-messages');
const dmForm = document.getElementById('dm-form');
const dmInput = document.getElementById('dm-input');
const dmAttachBtn = document.getElementById('dm-attach-btn');
const dmFileInput = document.getElementById('dm-file-input');
const dmImagePreview = document.getElementById('dm-image-preview');
const dmImagePreviewThumb = document.getElementById('dm-image-preview-thumb');
const dmImageCancelBtn = document.getElementById('dm-image-cancel-btn');

// --- State ---
let myName = localStorage.getItem('chat_name') || '';
let replyingTo = null;     // { id, name, text }
let pendingImage = null;   // data URL, for the room composer
let pendingDmImage = null; // data URL, for the DM composer
let roomUsers = [];        // [{ id, name }] for the current room
let currentDm = null;      // { id, name } of the open DM partner

// ============================================================
// Join screen
// ============================================================
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
    // One click joins directly, as long as a name has been entered.
    row.addEventListener('click', () => {
      roomInput.value = r.name;
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }
      attemptJoin(name, r.name);
    });
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
  roomNameEl.textContent = room;
  dmScreen.classList.add('hidden');
  joinScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  clearReply();
  clearImage();
  input.focus();
});

// ============================================================
// Shared helpers
// ============================================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Renders one message into a container. `isMe` decides which side it sits on.
// `showName` and `allowReply` are off for DMs, since there's only two people
// and no reply feature there.
function renderMessage(container, msg, { isMe, showName = true, allowReply = true } = {}) {
  if (msg.type === 'system') {
    const row = document.createElement('div');
    row.className = 'msg-row system-row';
    row.innerHTML = `<div class="msg system">${escapeHtml(msg.text)}</div>`;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
    return;
  }

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

  const nameLabel = msg.name || msg.fromName || '';

  row.innerHTML = `
    <div class="msg">
      ${showName && !isMe ? `<span class="name">${escapeHtml(nameLabel)}</span>` : ''}
      ${replyHtml}
      ${imageHtml}
      ${textHtml}
    </div>
    ${allowReply ? '<div class="msg-actions"><button type="button" class="reply-btn">Reply</button></div>' : ''}
  `;

  if (allowReply) {
    row.querySelector('.reply-btn').addEventListener('click', () => startReply(msg));
  }

  const img = row.querySelector('.msg-image');
  if (img) img.addEventListener('click', () => window.open(msg.image, '_blank'));

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

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

socket.on('send_error', (text) => alert(text));

// ============================================================
// Room chat
// ============================================================
socket.on('history', (history) => {
  messagesEl.innerHTML = '';
  history.forEach((msg) => renderMessage(messagesEl, msg, { isMe: msg.name === myName }));
});

socket.on('message', (msg) => {
  renderMessage(messagesEl, msg, { isMe: msg.name === myName });
});

socket.on('user_count', (count) => {
  userCountEl.textContent = `${count} here`;
});

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

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { alert('Please choose an image file.'); return; }
  compressImage(file, (dataUrl) => {
    pendingImage = dataUrl;
    imagePreviewThumb.src = dataUrl;
    imagePreview.classList.remove('hidden');
  });
});

function clearImage() {
  pendingImage = null;
  imagePreview.classList.add('hidden');
  imagePreviewThumb.src = '';
}

imageCancelBtn.addEventListener('click', clearImage);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text && !pendingImage) return;

  socket.emit('chat_message', { text, image: pendingImage, replyTo: replyingTo });

  input.value = '';
  clearReply();
  clearImage();
});

// ============================================================
// People panel
// ============================================================
function renderPeopleList() {
  const others = roomUsers.filter((u) => u.id !== socket.id);
  if (others.length === 0) {
    peopleListEl.innerHTML = '<div class="people-empty">No one else is in this room right now.</div>';
    return;
  }
  peopleListEl.innerHTML = '';
  others.forEach((u) => {
    const row = document.createElement('div');
    row.className = 'person-row';
    row.innerHTML = `
      <span class="person-name">${escapeHtml(u.name)}</span>
      <button type="button" class="person-dm-btn">Message</button>
    `;
    row.querySelector('.person-dm-btn').addEventListener('click', () => openDm(u));
    peopleListEl.appendChild(row);
  });
}

socket.on('room_users', (list) => {
  roomUsers = list;
  if (!peoplePanel.classList.contains('hidden')) renderPeopleList();
});

peopleBtn.addEventListener('click', () => {
  socket.emit('get_room_users');
  renderPeopleList();
  peoplePanel.classList.remove('hidden');
});

peopleCloseBtn.addEventListener('click', () => peoplePanel.classList.add('hidden'));
peoplePanel.addEventListener('click', (e) => {
  if (e.target === peoplePanel) peoplePanel.classList.add('hidden');
});

// ============================================================
// Direct messages
// ============================================================
function openDm(user) {
  currentDm = user;
  dmNameEl.textContent = user.name;
  dmMessagesEl.innerHTML = '';
  peoplePanel.classList.add('hidden');
  chatScreen.classList.add('hidden');
  dmScreen.classList.remove('hidden');
  clearDmImage();
  socket.emit('get_dm_history', { withId: user.id });
  dmInput.focus();
}

socket.on('dm_history', ({ withId, history }) => {
  if (!currentDm || currentDm.id !== withId) return;
  dmMessagesEl.innerHTML = '';
  history.forEach((msg) => renderMessage(dmMessagesEl, msg, {
    isMe: msg.fromId === socket.id,
    showName: false,
    allowReply: false,
  }));
});

socket.on('dm_message', (msg) => {
  const partnerId = msg.fromId === socket.id ? msg.toId : msg.fromId;
  if (!currentDm || currentDm.id !== partnerId) return; // not the open thread
  renderMessage(dmMessagesEl, msg, {
    isMe: msg.fromId === socket.id,
    showName: false,
    allowReply: false,
  });
});

dmBackBtn.addEventListener('click', () => {
  currentDm = null;
  dmScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
});

dmAttachBtn.addEventListener('click', () => dmFileInput.click());

dmFileInput.addEventListener('change', () => {
  const file = dmFileInput.files[0];
  dmFileInput.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { alert('Please choose an image file.'); return; }
  compressImage(file, (dataUrl) => {
    pendingDmImage = dataUrl;
    dmImagePreviewThumb.src = dataUrl;
    dmImagePreview.classList.remove('hidden');
  });
});

function clearDmImage() {
  pendingDmImage = null;
  dmImagePreview.classList.add('hidden');
  dmImagePreviewThumb.src = '';
}

dmImageCancelBtn.addEventListener('click', clearDmImage);

dmForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentDm) return;
  const text = dmInput.value.trim();
  if (!text && !pendingDmImage) return;

  socket.emit('dm_message', { toId: currentDm.id, text, image: pendingDmImage });

  dmInput.value = '';
  clearDmImage();
});
