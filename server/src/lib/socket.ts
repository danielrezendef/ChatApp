import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { encryptMessage } from './crypto';

interface AuthSocket extends Socket {
  userId?: string;
}

const onlineUsers = new Map<string, number>();
const TEXT_MESSAGE_MAX_LENGTH = 5000;
const IMAGE_PREFIX = '[image]';
const IMAGE_MAX_BYTES = 1024 * 1024;
const IMAGE_DATA_URL_PATTERN = /^data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/]+={0,2})$/;

function addOnlineUser(userId: string) {
  onlineUsers.set(userId, (onlineUsers.get(userId) || 0) + 1);
}

function removeOnlineUser(userId: string) {
  const connections = onlineUsers.get(userId) || 0;
  if (connections <= 1) {
    onlineUsers.delete(userId);
    return;
  }

  onlineUsers.set(userId, connections - 1);
}

function emitPresence(io: Server) {
  io.emit('presence', Array.from(onlineUsers.keys()));
}

function isValidImageContent(content: string) {
  const dataUrl = content.slice(IMAGE_PREFIX.length);
  const match = dataUrl.match(IMAGE_DATA_URL_PATTERN);

  if (!match) return false;

  return Buffer.byteLength(match[1], 'base64') <= IMAGE_MAX_BYTES;
}

function normalizeMessageContent(content: unknown) {
  if (typeof content !== 'string') return '';

  return content.startsWith(IMAGE_PREFIX) ? content : content.trim();
}

function isValidMessageContent(content: string) {
  if (!content) return false;

  if (content.startsWith(IMAGE_PREFIX)) {
    return isValidImageContent(content);
  }

  return content.length <= TEXT_MESSAGE_MAX_LENGTH;
}

type SendMessageAck = (response: { ok: boolean; message?: unknown; error?: string }) => void;

interface SendMessagePayload {
  receiverId?: string;
  content?: string;
  clientId?: string;
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

    addOnlineUser(userId);
    emitPresence(io);

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

    socket.on('send_message', async (data: SendMessagePayload, ack?: SendMessageAck) => {
      const receiverId = typeof data?.receiverId === 'string' ? data.receiverId.trim() : '';
      const content = normalizeMessageContent(data?.content);

      if (!receiverId || !isValidMessageContent(content)) {
        ack?.({ ok: false, error: 'Mensagem inválida' });
        return;
      }

      try {
        const message = await prisma.message.create({
          data: {
            senderId: userId,
            receiverId,
            content: encryptMessage(content),
          },
        });

        const payload = { ...message, content, clientId: data.clientId };

        ack?.({ ok: true, message: payload });
        socket.to(`user:${userId}`).to(`user:${receiverId}`).emit('new_message', payload);
      } catch (err) {
        console.error(err);
        ack?.({ ok: false, error: 'Erro interno' });
      }
    });

    socket.on('disconnect', () => {
      removeOnlineUser(userId);
      emitPresence(io);
    });
  });
}
