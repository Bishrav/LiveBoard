import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(128),
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const workspaceParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const createBoardSchema = z.object({
  title: z.string().trim().min(2).max(120),
});

export const boardParamsSchema = z.object({
  boardId: z.string().uuid(),
});

export const createColumnSchema = z.object({
  title: z.string().trim().min(2).max(80),
});

export const columnParamsSchema = z.object({
  columnId: z.string().uuid(),
});

export const updateColumnSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  position: z.number().int().positive().optional(),
});

export const createCardSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  assigneeId: z.string().uuid().optional(),
});

export const cardParamsSchema = z.object({
  cardId: z.string().uuid(),
});

export const updateCardSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  columnId: z.string().uuid().optional(),
  position: z.number().int().positive().optional(),
});

export const createInviteSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export const inviteParamsSchema = z.object({
  token: z.string().min(16).max(256),
});
