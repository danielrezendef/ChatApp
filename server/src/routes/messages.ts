import { Router, Response } from "express";
import { Server } from "socket.io";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { encryptMessage, decryptMessage } from "../lib/crypto";

export const messagesRouter = Router();
messagesRouter.use(authMiddleware);

const TEXT_MESSAGE_MAX_LENGTH = 5000;
const IMAGE_PREFIX = "[image]";
const IMAGE_MAX_BYTES = 1024 * 1024;
const IMAGE_DATA_URL_PATTERN =
  /^data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/]+={0,2})$/;

function isValidImageContent(content: string) {
  const dataUrl = content.slice(IMAGE_PREFIX.length);
  const match = dataUrl.match(IMAGE_DATA_URL_PATTERN);

  if (!match) return false;

  return Buffer.byteLength(match[1], "base64") <= IMAGE_MAX_BYTES;
}

function normalizeMessageContent(content: unknown) {
  if (typeof content !== "string") return "";

  return content.startsWith(IMAGE_PREFIX) ? content : content.trim();
}

function isValidMessageContent(content: string) {
  if (!content) return false;

  if (content.startsWith(IMAGE_PREFIX)) {
    return isValidImageContent(content);
  }

  return content.length <= TEXT_MESSAGE_MAX_LENGTH;
}

function getSocketServer(req: AuthRequest) {
  return req.app.get("io") as Server | undefined;
}

messagesRouter.get(
  "/:otherUserId",
  async (req: AuthRequest, res: Response): Promise<void> => {
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
        orderBy: { createdAt: "asc" },
      });

      res.json(
        messages.map((m) => ({ ...m, content: decryptMessage(m.content) })),
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro interno" });
    }
  },
);

messagesRouter.delete(
  "/:otherUserId",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { otherUserId } = req.params;
    const userId = req.userId!;

    try {
      const deleted = await prisma.message.deleteMany({
        where: {
          senderId: userId,
          receiverId: otherUserId,
        },
      });

      res.json({ ok: true, deletedCount: deleted.count });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro interno" });
    }
  },
);

const sendSchema = z.object({
  receiverId: z.string().min(1),
  content: z.unknown(),
  clientId: z.string().optional(),
});

messagesRouter.post(
  "/",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { receiverId, clientId } = parsed.data;
    const content = normalizeMessageContent(parsed.data.content);
    const senderId = req.userId!;

    if (!isValidMessageContent(content)) {
      res.status(400).json({ error: "Mensagem inválida" });
      return;
    }

    try {
      const message = await prisma.message.create({
        data: {
          senderId,
          receiverId,
          content: encryptMessage(content),
        },
      });

      const payload = { ...message, content, clientId };
      getSocketServer(req)
        ?.to(`user:${senderId}`)
        .to(`user:${receiverId}`)
        .emit("new_message", payload);

      res.status(201).json(payload);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro interno" });
    }
  },
);
