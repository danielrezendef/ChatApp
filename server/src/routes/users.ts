import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const usersRouter = Router();

usersRouter.use(authMiddleware);

usersRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: { id: { not: req.userId } },
      select: { id: true, email: true, createdAt: true },
      orderBy: { email: 'asc' },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

usersRouter.get('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});
