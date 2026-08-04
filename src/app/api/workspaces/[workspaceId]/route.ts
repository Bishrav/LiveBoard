import { errorResponse, handleRouteError, jsonResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { workspaceParamsSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request);
    const params = workspaceParamsSchema.safeParse(await context.params);

    if (!params.success) {
      return errorResponse("Invalid workspace id", 422);
    }

    const membership = await requireWorkspaceRole(
      params.data.workspaceId,
      user.id,
    );

    const workspace = await prisma.workspace.findUnique({
      where: { id: params.data.workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        boards: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            _count: {
              select: { columns: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        members: {
          select: {
            role: true,
            joinedAt: true,
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!workspace) {
      return errorResponse("Workspace not found", 404);
    }

    return jsonResponse({
      workspace,
      currentUserRole: membership.role,
    });
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
