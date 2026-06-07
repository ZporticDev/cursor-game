const container = document.getElementById('gameContainer');
const chatPanel = document.getElementById('chatPanel');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');
const infoDiv = document.getElementById('info');
const playerListSpan = document.getElementById('playerList');
const onlineCountSpan = document.getElementById('onlineCount');

let playerId = null;
let players = new Map();
let ws = null;
let gridWidth = 1200;
let gridHeight = 800;
let chatBubbles = new Map();
let lastMoveTime = 0;
const MOVE_THROTTLE = 50; // ms between move updates

// Connect to WebSocket
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    console.log('Connected to server');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'init':
        playerId = data.playerId;
        gridWidth = data.gridWidth;
        gridHeight = data.gridHeight;
        data.players.forEach(player => {
          players.set(player.id, player);
          renderPlayer(player);
        });
        updatePlayerCount();
        break;

      case 'playerJoined':
        players.set(data.player.id, data.player);
        renderPlayer(data.player);
        updatePlayerCount();
        break;

      case 'playerMoved':
        if (players.has(data.playerId)) {
          players.get(data.playerId).x = data.x;
          players.get(data.playerId).y = data.y;
          updatePlayerPosition(data.playerId);
        }
        break;

      case 'playerLeft':
        removePlayer(data.playerId);
        updatePlayerCount();
        break;

      case 'chat':
        showChatBubble(data.playerId, data.message, data.x, data.y, data.color);
        addChatMessage(players.get(data.playerId)?.name || 'Unknown', data.message, data.color);
        break;
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('Disconnected from server');
    setTimeout(connect, 3000);
  };
}

function updatePlayerCount() {
  playerListSpan.textContent = players.size;
  onlineCountSpan.textContent = players.size;
}

function renderPlayer(player) {
  if (!document.getElementById(`player-${player.id}`)) {
    const playerEl = document.createElement('div');
    playerEl.id = `player-${player.id}`;
    playerEl.className = 'player-cursor';
    playerEl.style.left = player.x + 'px';
    playerEl.style.top = player.y + 'px';

    const arrow = document.createElement('div');
    arrow.className = 'cursor-arrow';
    arrow.style.borderTopColor = player.color;

    const name = document.createElement('div');
    name.className = 'player-name';
    name.textContent = player.name;
    name.style.color = player.color;

    playerEl.appendChild(name);
    playerEl.appendChild(arrow);
    container.appendChild(playerEl);
  }
}

function updatePlayerPosition(playerId) {
  const player = players.get(playerId);
  const playerEl = document.getElementById(`player-${playerId}`);
  if (playerEl && player) {
    playerEl.style.left = player.x + 'px';
    playerEl.style.top = player.y + 'px';
  }
}

function removePlayer(playerId) {
  const playerEl = document.getElementById(`player-${playerId}`);
  if (playerEl) {
    playerEl.remove();
  }
  players.delete(playerId);
}

function showChatBubble(playerIdMsg, message, x, y, color) {
  const bubbleId = `bubble-${Date.now()}-${Math.random()}`;
  
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.id = bubbleId;
  bubble.textContent = message;
  bubble.style.left = x + 'px';
  bubble.style.top = (y - 60) + 'px';
  bubble.style.borderColor = color;
  
  container.appendChild(bubble);
  chatBubbles.set(bubbleId, { element: bubble, time: Date.now() });

  setTimeout(() => {
    bubble.remove();
    chatBubbles.delete(bubbleId);
  }, 3500);
}

function addChatMessage(author, message, color) {
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message';
  msgEl.style.borderLeftColor = color;
  
  const authorEl = document.createElement('span');
  authorEl.className = 'chat-message-author';
  authorEl.textContent = author;
  
  msgEl.appendChild(authorEl);
  msgEl.appendChild(document.createTextNode(message));
  
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Keep last 50 messages
  const messages = chatMessages.querySelectorAll('.chat-message');
  if (messages.length > 50) {
    messages[0].remove();
  }
}

// Toggle chat panel with Y key
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'y' && document.activeElement !== chatInput) {
    e.preventDefault();
    chatPanel.classList.toggle('open');
    if (chatPanel.classList.contains('open')) {
      chatInput.focus();
    }
  }
});

// Close chat with Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && chatPanel.classList.contains('open')) {
    chatPanel.classList.remove('open');
  }
});

// Mouse movement - throttled
document.addEventListener('mousemove', (e) => {
  const now = Date.now();
  if (now - lastMoveTime < MOVE_THROTTLE) return;
  lastMoveTime = now;

  const rect = container.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (x >= 0 && x <= gridWidth && y >= 0 && y <= gridHeight) {
    if (playerId && players.has(playerId)) {
      const player = players.get(playerId);
      player.x = x;
      player.y = y;
      updatePlayerPosition(playerId);
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'move',
          x,
          y
        }));
      }
    }
  }
});

// Send chat message
function sendMessage() {
  if (chatInput.value.trim()) {
    const message = chatInput.value.trim();
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'chat',
        message
      }));
    }
    
    chatInput.value = '';
  }
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

// Start connection
connect();
