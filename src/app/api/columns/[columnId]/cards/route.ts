import { ActivityType } from "@prisma/client";
import { errorResponse, handleRouteError, jsonResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireColumnRole } from "@/lib/permissions";
import { nextPosition } from "@/lib/positions";
import { prisma } from "@/lib/prisma";
import { columnParamsSchema, createCardSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    columnId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request);
    const params = columnParamsSchema.safeParse(await context.params);
    const body = createCardSchema.safeParse(await request.json());

    if (!params.success) {
      return errorResponse("Invalid column id", 422);
    }

    if (!body.success) {
      return errorResponse("Invalid card details", 422);
    }

    await requireColumnRole(params.data.columnId, user.id);

    const column = await prisma.column.findUnique({
      where: { id: params.data.columnId },
      select: { boardId: true },
    });

    if (!column) {
      return errorResponse("Column not found", 404);
    }

    const position = await nextPosition(
      () =>
        prisma.card.findFirst({
          where: { columnId: params.data.columnId },
          orderBy: { position: "desc" },
        }),
      (card) => card.position,
    );

    const card = await prisma.card.create({
      data: {
        columnId: params.data.columnId,
        title: body.data.title,
        description: body.data.description,
        assigneeId: body.data.assigneeId,
        position,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await prisma.activityEvent.create({
      data: {
        boardId: column.boardId,
        actorId: user.id,
        type: ActivityType.CARD_CREATED,
        metadata: { cardId: card.id, title: card.title },
      },
    });

    return jsonResponse({ card }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse("Forbidden", 403);
    }

    if (error instanceof Error && error.message === "ColumnNotFound") {
      return errorResponse("Column not found", 404);
    }

    return handleRouteError(error);
  }
}
