import { errorResponse, handleRouteError, jsonResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import { inviteParamsSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request);
    const params = inviteParamsSchema.safeParse(await context.params);

    if (!params.success) {
      return errorResponse("Invalid invite token", 422);
    }

    const invite = await prisma.invite.findFirst({
      where: {
        tokenHash: hashToken(params.data.token),
        acceptedAt: null,
      },
    });

    if (!invite || invite.expiresAt < new Date()) {
      return errorResponse("Invite not found or expired", 404);
    }

    if (invite.email !== user.email) {
      return errorResponse("Invite belongs to another email address", 403);
    }

    const membership = await prisma.$transaction(async (tx) => {
      const member = await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: user.id,
          },
        },
        update: { role: invite.role },
        create: {
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role,
        },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return member;
    });

    return jsonResponse({ membership });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse("Unauthorized", 401);
    }

    return handleRouteError(error);
  }
}
