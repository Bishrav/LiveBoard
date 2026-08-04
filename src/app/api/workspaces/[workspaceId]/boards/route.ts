import { ActivityType, WorkspaceRole } from "@prisma/client";
import { errorResponse, handleRouteError, jsonResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createBoardSchema, workspaceParamsSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request);
    const params = workspaceParamsSchema.safeParse(await context.params);
    const body = createBoardSchema.safeParse(await request.json());

    if (!params.success) {
      return errorResponse("Invalid workspace id", 422);
    }

    if (!body.success) {
      return errorResponse("Invalid board details", 422);
    }

    await requireWorkspaceRole(
      params.data.workspaceId,
      user.id,
      WorkspaceRole.MEMBER,
    );

    const board = await prisma.board.create({
      data: {
        workspaceId: params.data.workspaceId,
        title: body.data.title,
        columns: {
          create: [
            { title: "Backlog", position: 1000 },
            { title: "In Progress", position: 2000 },
            { title: "Review", position: 3000 },
            { title: "Done", position: 4000 },
          ],
        },
        activities: {
          create: {
            actorId: user.id,
            type: ActivityType.BOARD_CREATED,
            metadata: { title: body.data.title },
          },
        },
      },
      include: {
        columns: {
          orderBy: { position: "asc" },
          include: {
            cards: {
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });

    return jsonResponse({ board }, 201);
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
