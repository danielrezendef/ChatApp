import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { messagesRouter } from './routes/messages';
import { setupSocket } from './lib/socket';

const app = express();
const httpServer = createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/messages', messagesRouter);

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Socket.IO setup
setupSocket(io);

const PORT = parseInt(process.env.PORT || '3000', 10);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
