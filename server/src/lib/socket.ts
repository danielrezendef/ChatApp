import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

interface AuthSocket extends Socket {
  userId?: string;
}

export function setupSocket(io: Server) {
  // Auth middleware for Socket.IO
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    const secret = process.env.JWT_SECRET;

    if (!token || !secret) {
      return next(new Error('Não autenticado'));
    }

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
    console.log(`User connected: ${userId}`);

    // Join personal room
    socket.join(`user:${userId}`);

    socket.on('send_message', async (data: { receiverId: string; content: string }) => {
      const { receiverId, content } = data;

      if (!receiverId || !content || typeof content !== 'string') return;
      if (content.trim().length === 0 || content.length > 5000) return;
      if (receiverId === userId) return;

      try {
        const message = await prisma.message.create({
          data: {
            senderId: userId,
            receiverId,
            content: content.trim(),
          },
          select: {
            id: true,
            content: true,
            senderId: true,
            receiverId: true,
            createdAt: true,
          },
        });

        // Emit to sender and receiver rooms
        io.to(`user:${userId}`).to(`user:${receiverId}`).emit('new_message', message);
      } catch (err) {
        console.error('Socket send_message error:', err);
        socket.emit('error', { message: 'Erro ao enviar mensagem' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
    });
  });
}
