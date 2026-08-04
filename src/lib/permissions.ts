import { WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const roleRank: Record<WorkspaceRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export async function getWorkspaceMembership(
  workspaceId: string,
  userId: string,
) {
  return prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });
}

export async function requireWorkspaceRole(
  workspaceId: string,
  userId: string,
  minimumRole: WorkspaceRole = WorkspaceRole.MEMBER,
) {
  const membership = await getWorkspaceMembership(workspaceId, userId);

  if (!membership || roleRank[membership.role] < roleRank[minimumRole]) {
    throw new Error("Forbidden");
  }

  return membership;
}

export async function requireBoardRole(
  boardId: string,
  userId: string,
  minimumRole: WorkspaceRole = WorkspaceRole.MEMBER,
) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { workspaceId: true },
  });

  if (!board) {
    throw new Error("BoardNotFound");
  }

  return requireWorkspaceRole(board.workspaceId, userId, minimumRole);
}

export async function requireColumnRole(
  columnId: string,
  userId: string,
  minimumRole: WorkspaceRole = WorkspaceRole.MEMBER,
) {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    select: {
      board: {
        select: { workspaceId: true },
      },
    },
  });

  if (!column) {
    throw new Error("ColumnNotFound");
  }

  return requireWorkspaceRole(column.board.workspaceId, userId, minimumRole);
}

export async function requireCardRole(
  cardId: string,
  userId: string,
  minimumRole: WorkspaceRole = WorkspaceRole.MEMBER,
) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: {
      column: {
        select: {
          board: {
            select: { workspaceId: true },
          },
        },
      },
    },
  });

  if (!card) {
    throw new Error("CardNotFound");
  }

  return requireWorkspaceRole(card.column.board.workspaceId, userId, minimumRole);
}
