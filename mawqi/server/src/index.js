import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { db } from './db.js';
import { login, projectScope, requireAuth, verifyToken } from './auth.js';
import { buildDashboard } from './dashboard.js';
import { startJobs } from './jobs.js';
import { seed } from './seed.js';

if (db.prepare('SELECT COUNT(*) AS n FROM projects').get().n === 0) seed();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'موقعي' }));

app.post('/api/auth/login', (req, res) => {
  const out = login(String(req.body?.username || '').trim(), String(req.body?.password || ''));
  if (!out) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  res.json(out);
});

app.get('/api/me', requireAuth, (req, res) => res.json(req.user));

app.get('/api/dashboard', requireAuth, (req, res) => res.json(buildDashboard(projectScope(req.user))));

const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' } });

// Every client joins a room per visible project (or "all"), so a change is pushed
// only to the phones and dashboards that are allowed to see it.
io.use((socket, next) => {
  try {
    socket.data.user = verifyToken(socket.handshake.auth?.token);
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});
io.on('connection', (socket) => {
  const scope = projectScope(socket.data.user);
  if (scope === null) socket.join('all');
  else scope.forEach((id) => socket.join(`project:${id}`));
});

/** Tell every connected client that can see `projectId` that data changed. */
export function broadcast(event, payload = {}) {
  const rooms = ['all'];
  if (payload.projectId) rooms.push(`project:${payload.projectId}`);
  io.to(rooms).emit(event, payload);
}
app.locals.broadcast = broadcast;

if (process.env.NODE_ENV !== 'production') {
  // Used by scripts/simulate.js to push a live update after editing the database directly.
  app.post('/api/dev/ping', (req, res) => {
    broadcast('data:changed', { entity: 'attendance', projectId: req.body?.projectId });
    res.json({ ok: true });
  });
}

startJobs(broadcast);

const PORT = Number(process.env.PORT || 4000);
http.listen(PORT, '0.0.0.0', () => console.log(`موقعي server on http://0.0.0.0:${PORT}`));
