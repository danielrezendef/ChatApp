import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { encryptMessage } from './crypto';

interface AuthSocket extends Socket {
  userId?: string;
}

const onlineUsers = new Set<string>();

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

    onlineUsers.add(userId);
    io.emit('presence', Array.from(onlineUsers));

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
      onlineUsers.delete(userId);
      io.emit('presence', Array.from(onlineUsers));
    });
  });
}
