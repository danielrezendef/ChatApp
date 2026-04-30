import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { encryptMessage, decryptMessage } from './crypto';

interface AuthSocket extends Socket {
  userId?: string;
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
    socket.join(`user:${userId}`);

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
  });
}
