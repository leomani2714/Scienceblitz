const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT) || 10000;
const questionBank = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));
const rooms = new Map();

const server = http.createServer((request, response) => {
  const requested = request.url === '/' ? '/index.html' : request.url;
  const filePath = path.normalize(path.join(__dirname, requested));
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8' };
  response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'text/plain; charset=utf-8' });
  fs.createReadStream(filePath).pipe(response);
});

const wss = new WebSocket.Server({ server });

function send(socket, type, payload = {}) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, ...payload }));
}

function broadcast(room, type, payload = {}) {
  room.players.forEach(player => send(player.socket, type, payload));
}

function code() {
  let value;
  do value = crypto.randomBytes(3).toString('hex').toUpperCase(); while (rooms.has(value));
  return value;
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function publicPlayers(room) {
  return [...room.players].map(player => ({ id: player.id, name: player.name, score: player.score, answered: room.answers.has(player.id) }));
}

function roomState(room) {
  return { roomCode: room.code, players: publicPlayers(room), questionNumber: room.questionIndex + 1, totalQuestions: room.questions.length, hostId: room.hostId };
}

function broadcastState(room) {
  broadcast(room, 'room-state', roomState(room));
}

function sendQuestion(room) {
  if (room.questionIndex >= room.questions.length) {
    room.started = false;
    broadcast(room, 'game-over', { players: publicPlayers(room) });
    return;
  }
  room.answers.clear();
  const question = room.questions[room.questionIndex];
  broadcast(room, 'question', {
    question: { text: question.q, options: shuffle(question.opts), subject: question.subject, topic: question.topic },
    questionNumber: room.questionIndex + 1,
    totalQuestions: room.questions.length,
    deadline: Date.now() + room.time * 1000
  });
  broadcastState(room);
  clearTimeout(room.timer);
  room.timer = setTimeout(() => finishQuestion(room), room.time * 1000);
}

function finishQuestion(room) {
  if (!room.started || room.answers.size === room.players.size) return;
  room.questionIndex++;
  broadcastState(room);
  setTimeout(() => sendQuestion(room), 1000);
}

function buildQuestions(settings) {
  const subjects = settings.mix ? Object.keys(questionBank) : [settings.subject];
  const topics = Array.isArray(settings.topics) ? settings.topics : [];
  const result = [];
  const seen = new Set();
  subjects.forEach(subject => {
    const subjectBank = questionBank[subject];
    if (!subjectBank) return;
    Object.keys(subjectBank).forEach(topic => {
      if (!settings.mix && topics.length && !topics.includes(topic)) return;
      const pool = subjectBank[topic][settings.difficulty] || subjectBank[topic].easy || [];
      pool.forEach(question => {
        const key = String(question.q || '').trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push({ ...question, subject, topic });
      });
    });
  });
  return shuffle(result).slice(0, Math.max(1, Math.min(Number(settings.questions) || 10, 50)));
}

function leaveRoom(socket) {
  const room = socket.room;
  if (!room) return;
  room.players = room.players.filter(player => player.socket !== socket);
  socket.room = null;
  if (room.hostId === socket.playerId && room.players.length) room.hostId = room.players[0].id;
  if (!room.players.length) {
    clearTimeout(room.timer);
    rooms.delete(room.code);
  } else {
    broadcastState(room);
  }
}

wss.on('connection', socket => {
  socket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw); } catch { return send(socket, 'error', { message: 'Invalid message.' }); }

    if (message.type === 'create-room' || message.type === 'join-room') {
      leaveRoom(socket);
      const requestedCode = String(message.roomCode || '').trim().toUpperCase();
      const room = message.type === 'create-room'
        ? { code: code(), players: [], hostId: null, started: false, questionIndex: 0, questions: [], answers: new Map(), timer: null, time: 45 }
        : rooms.get(requestedCode);
      if (!room) return send(socket, 'error', { message: 'Room not found.' });
      if (room.started) return send(socket, 'error', { message: 'That game has already started.' });
      if (room.players.length >= 20) return send(socket, 'error', { message: 'Room is full.' });
      const player = { id: crypto.randomUUID(), name: String(message.name || 'Player').trim().slice(0, 20) || 'Player', score: 0, socket };
      room.players.push(player);
      if (!room.hostId) room.hostId = player.id;
      socket.room = room;
      socket.playerId = player.id;
      if (message.type === 'create-room') rooms.set(room.code, room);
      send(socket, 'joined', { playerId: player.id, roomCode: room.code, host: room.hostId === player.id });
      broadcastState(room);
      return;
    }

    const room = socket.room;
    if (!room) return send(socket, 'error', { message: 'Join a room first.' });

    if (message.type === 'start-game') {
      if (socket.playerId !== room.hostId) return send(socket, 'error', { message: 'Only the host can start the game.' });
      if (room.players.length < 2) return send(socket, 'error', { message: 'At least two players are required.' });
      room.questions = buildQuestions(message.settings || {});
      room.time = Math.max(10, Math.min(Number(message.settings?.time) || 45, 120));
      room.questionIndex = 0;
      room.players.forEach(player => { player.score = 0; });
      room.started = true;
      sendQuestion(room);
      return;
    }

    if (message.type === 'answer') {
      if (!room.started || room.answers.has(socket.playerId)) return;
      const question = room.questions[room.questionIndex];
      if (!question) return;
      const correct = message.answer === question.a;
      room.answers.set(socket.playerId, { correct });
      const player = room.players.find(item => item.id === socket.playerId);
      if (correct && player) player.score += 10;
      send(socket, 'answer-result', { correct, answer: question.a });
      broadcastState(room);
      if (room.answers.size === room.players.length) {
        clearTimeout(room.timer);
        room.questionIndex++;
        setTimeout(() => sendQuestion(room), 1000);
      }
    }
  });
  socket.on('close', () => leaveRoom(socket));
});

server.listen(PORT, () => console.log(`ScienceBlitz server listening on port ${PORT}`));
