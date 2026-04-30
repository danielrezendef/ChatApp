import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { encryptMessage, decryptMessage } from '../lib/crypto';

export const messagesRouter = Router();
messagesRouter.use(authMiddleware);

messagesRouter.get('/:otherUserId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { otherUserId } = req.params;
  const userId = req.userId!;

  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages.map(m => ({ ...m, content: decryptMessage(m.content) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

const sendSchema = z.object({
  receiverId: z.string().min(1),
  content: z.string().min(1).max(5000),
});

messagesRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { receiverId, content } = parsed.data;
  const senderId = req.userId!;

  try {
    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content: encryptMessage(content),
      },
    });

    res.status(201).json({ ...message, content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});
