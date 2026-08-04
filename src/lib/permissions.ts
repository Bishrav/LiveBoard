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
