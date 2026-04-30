import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

export const authRouter = Router();

const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '30d';

function generateTokens(userId: string) {
  const secret = process.env.JWT_SECRET!;
  const accessToken = jwt.sign({ userId }, secret, { expiresIn: ACCESS_EXPIRES });
  const refreshToken = jwt.sign({ userId }, secret, { expiresIn: REFRESH_EXPIRES });
  return { accessToken, refreshToken };
}

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });

authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, password } = schema.parse(req.body);

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, passwordHash: hash } });

  const tokens = generateTokens(user.id);
  res.json({ ...tokens, user });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = schema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

  const tokens = generateTokens(user.id);
  res.json({ ...tokens, user });
});

authRouter.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const secret = process.env.JWT_SECRET!;

  try {
    const payload = jwt.verify(refreshToken, secret) as { userId: string };
    const tokens = generateTokens(payload.userId);
    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Refresh inválido' });
  }
});
