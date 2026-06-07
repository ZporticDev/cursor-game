const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

const players = new Map();
const GRID_WIDTH = 1200;
const GRID_HEIGHT = 800;

wss.on('connection', (ws) => {
  const playerId = Math.random().toString(36).substr(2, 9);
  
  players.set(playerId, {
    id: playerId,
    x: Math.random() * GRID_WIDTH,
    y: Math.random() * GRID_HEIGHT,
    color: `hsl(${Math.random() * 360}, 100%, 50%)`,
    name: `Player${playerId.substr(0, 4)}`
  });

  // Send existing players to new player
  ws.send(JSON.stringify({
    type: 'init',
    playerId,
    players: Array.from(players.values()),
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT
  }));

  // Broadcast new player to all
  broadcastExcept({
    type: 'playerJoined',
    player: players.get(playerId)
  }, ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'move') {
        const player = players.get(playerId);
        if (player) {
          player.x = Math.max(0, Math.min(GRID_WIDTH, data.x));
          player.y = Math.max(0, Math.min(GRID_HEIGHT, data.y));
          
          // Only broadcast to others, not back to sender
          broadcastExcept({
            type: 'playerMoved',
            playerId,
            x: player.x,
            y: player.y
          }, ws);
        }
      }
      
      if (data.type === 'chat') {
        const player = players.get(playerId);
        broadcastExcept({
          type: 'chat',
          playerId,
          playerName: player.name,
          message: data.message,
          x: player.x,
          y: player.y,
          color: player.color
        }, null);
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  ws.on('close', () => {
    players.delete(playerId);
    broadcastExcept({
      type: 'playerLeft',
      playerId
    }, null);
  });
});

function broadcastExcept(message, exclude = null) {
  const json = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== exclude) {
      client.send(json);
    }
  });
}

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
