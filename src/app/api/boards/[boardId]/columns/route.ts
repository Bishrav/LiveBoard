import { ActivityType } from "@prisma/client";
import { errorResponse, handleRouteError, jsonResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireBoardRole } from "@/lib/permissions";
import { nextPosition } from "@/lib/positions";
import { prisma } from "@/lib/prisma";
import { boardParamsSchema, createColumnSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    boardId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request);
    const params = boardParamsSchema.safeParse(await context.params);
    const body = createColumnSchema.safeParse(await request.json());

    if (!params.success) {
      return errorResponse("Invalid board id", 422);
    }

    if (!body.success) {
      return errorResponse("Invalid column details", 422);
    }

    await requireBoardRole(params.data.boardId, user.id);

    const position = await nextPosition(
      () =>
        prisma.column.findFirst({
          where: { boardId: params.data.boardId },
          orderBy: { position: "desc" },
        }),
      (column) => column.position,
    );

    const column = await prisma.column.create({
      data: {
        boardId: params.data.boardId,
        title: body.data.title,
        position,
      },
    });

    await prisma.activityEvent.create({
      data: {
        boardId: params.data.boardId,
        actorId: user.id,
        type: ActivityType.COLUMN_CREATED,
        metadata: { columnId: column.id, title: column.title },
      },
    });

    return jsonResponse({ column }, 201);
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
