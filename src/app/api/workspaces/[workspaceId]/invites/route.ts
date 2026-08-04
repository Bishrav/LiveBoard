import { ActivityType, WorkspaceRole } from "@prisma/client";
import { errorResponse, handleRouteError, jsonResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createInviteToken, hashToken } from "@/lib/tokens";
import { createInviteSchema, workspaceParamsSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request);
    const params = workspaceParamsSchema.safeParse(await context.params);
    const body = createInviteSchema.safeParse(await request.json());

    if (!params.success) {
      return errorResponse("Invalid workspace id", 422);
    }

    if (!body.success) {
      return errorResponse("Invalid invite details", 422);
    }

    await requireWorkspaceRole(
      params.data.workspaceId,
      user.id,
      WorkspaceRole.ADMIN,
    );

    const workspace = await prisma.workspace.findUnique({
      where: { id: params.data.workspaceId },
      select: {
        id: true,
        boards: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { id: true },
        },
      },
    });

    if (!workspace) {
      return errorResponse("Workspace not found", 404);
    }

    const token = createInviteToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const invite = await prisma.invite.create({
      data: {
        workspaceId: workspace.id,
        email: body.data.email,
        role: body.data.role,
        tokenHash: hashToken(token),
        expiresAt,
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (workspace.boards[0]) {
      await prisma.activityEvent.create({
        data: {
          boardId: workspace.boards[0].id,
          actorId: user.id,
          type: ActivityType.MEMBER_INVITED,
          metadata: { inviteId: invite.id, email: invite.email, role: invite.role },
        },
      });
    }

    return jsonResponse(
      {
        invite,
        acceptUrl: `/api/invites/${token}/accept`,
      },
      201,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse("Forbidden", 403);
    }

    return handleRouteError(error);
  }
}
