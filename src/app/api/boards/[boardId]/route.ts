import { errorResponse, handleRouteError, jsonResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireBoardRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { boardParamsSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    boardId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request);
    const params = boardParamsSchema.safeParse(await context.params);

    if (!params.success) {
      return errorResponse("Invalid board id", 422);
    }

    const membership = await requireBoardRole(params.data.boardId, user.id);

    const board = await prisma.board.findUnique({
      where: { id: params.data.boardId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            members: {
              select: {
                role: true,
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
              orderBy: { joinedAt: "asc" },
            },
          },
        },
        columns: {
          orderBy: { position: "asc" },
          include: {
            cards: {
              orderBy: { position: "asc" },
              include: {
                assignee: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
        activities: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
            actor: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!board) {
      return errorResponse("Board not found", 404);
    }

    return jsonResponse({
      board,
      currentUserRole: membership.role,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse("Forbidden", 403);
    }

    if (error instanceof Error && error.message === "BoardNotFound") {
      return errorResponse("Board not found", 404);
    }

    return handleRouteError(error);
  }
}
