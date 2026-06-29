// client.js
const socket = io();

const nameScreen = document.getElementById('name-screen');
const chatScreen = document.getElementById('chat-screen');
const nameInput = document.getElementById('name-input');
const joinBtn = document.getElementById('join-btn');
const messagesEl = document.getElementById('messages');
const form = document.getElementById('message-form');
const input = document.getElementById('message-input');
const userCountEl = document.getElementById('user-count');

let myName = localStorage.getItem('chat_name') || '';

function showChat() {
  nameScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  input.focus();
}

function joinChat(name) {
  myName = name;
  localStorage.setItem('chat_name', name);
  socket.emit('join', name);
  showChat();
}

// If we already have a saved name, skip straight to the chat
if (myName) {
  joinChat(myName);
} else {
  nameInput.focus();
}

joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }
  joinChat(name);
});

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMessage(msg) {
  const div = document.createElement('div');

  if (msg.type === 'system') {
    div.className = 'msg system';
    div.textContent = msg.text;
  } else {
    const isMe = msg.name === myName;
    div.className = `msg ${isMe ? 'me' : 'other'}`;
    div.innerHTML = `
      ${isMe ? '' : `<span class="name">${escapeHtml(msg.name)}</span>`}
      ${escapeHtml(msg.text)}
    `;
  }

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

socket.on('history', (history) => {
  messagesEl.innerHTML = '';
  history.forEach(renderMessage);
});

socket.on('message', (msg) => {
  renderMessage(msg);
});

socket.on('user_count', (count) => {
  userCountEl.textContent = `${count} online`;
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chat_message', text);
  input.value = '';
});
