import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { encryptMessage } from './crypto';

interface AuthSocket extends Socket {
  userId?: string;
}

const onlineUsers = new Map<string, Set<string>>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();
const DISCONNECT_DELAY_MS = 5000;

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

function emitPresence(io: Server) {
  io.emit('presence', getOnlineUserIds());
}

function addUserConnection(userId: string, socketId: string, io: Server) {
  const pendingTimer = disconnectTimers.get(userId);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    disconnectTimers.delete(userId);
  }

  const connections = onlineUsers.get(userId) || new Set<string>();
  const wasOffline = connections.size === 0;

  connections.add(socketId);
  onlineUsers.set(userId, connections);

  if (wasOffline) emitPresence(io);
}

function removeUserConnection(userId: string, socketId: string, io: Server) {
  const connections = onlineUsers.get(userId);
  if (!connections) return;

  connections.delete(socketId);

  if (connections.size > 0) {
    onlineUsers.set(userId, connections);
    return;
  }

  onlineUsers.delete(userId);

  const timer = setTimeout(() => {
    disconnectTimers.delete(userId);

    const currentConnections = onlineUsers.get(userId);
    if (currentConnections && currentConnections.size > 0) return;

    emitPresence(io);
  }, DISCONNECT_DELAY_MS);

  disconnectTimers.set(userId, timer);
}

export function setupSocket(io: Server) {
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    const secret = process.env.JWT_SECRET;

    if (!token || !secret) return next(new Error('Não autenticado'));

    try {
      const payload = jwt.verify(token, secret) as { userId: string };
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.userId!;

    addUserConnection(userId, socket.id, io);
    socket.emit('presence', getOnlineUserIds());

    socket.join(`user:${userId}`);

    socket.on('typing', ({ to }) => {
      io.to(`user:${to}`).emit('typing', { from: userId });
    });

    socket.on('stop_typing', ({ to }) => {
      io.to(`user:${to}`).emit('stop_typing', { from: userId });
    });

    socket.on('read_messages', async ({ from }) => {
      await prisma.message.updateMany({
        where: { senderId: from, receiverId: userId, readAt: null },
        data: { readAt: new Date() },
      });

      io.to(`user:${from}`).emit('messages_read', { by: userId });
    });

    socket.on('send_message', async ({ receiverId, content }) => {
      const message = await prisma.message.create({
        data: {
          senderId: userId,
          receiverId,
          content: encryptMessage(content),
        },
      });

      const payload = { ...message, content };

      io.to(`user:${userId}`).to(`user:${receiverId}`).emit('new_message', payload);
    });

    socket.on('disconnect', () => {
      removeUserConnection(userId, socket.id, io);
    });
  });
}
