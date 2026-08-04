import { ActivityType } from "@prisma/client";
import { errorResponse, handleRouteError, jsonResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireCardRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cardParamsSchema, updateCardSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    cardId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request);
    const params = cardParamsSchema.safeParse(await context.params);
    const body = updateCardSchema.safeParse(await request.json());

    if (!params.success) {
      return errorResponse("Invalid card id", 422);
    }

    if (!body.success || Object.keys(body.data).length === 0) {
      return errorResponse("Invalid card update", 422);
    }

    await requireCardRole(params.data.cardId, user.id);

    const existingCard = await prisma.card.findUnique({
      where: { id: params.data.cardId },
      select: {
        columnId: true,
        column: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!existingCard) {
      return errorResponse("Card not found", 404);
    }

    const card = await prisma.card.update({
      where: { id: params.data.cardId },
      data: body.data,
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const isMove =
      body.data.columnId !== undefined || body.data.position !== undefined;

    await prisma.activityEvent.create({
      data: {
        boardId: existingCard.column.boardId,
        actorId: user.id,
        type: isMove ? ActivityType.CARD_MOVED : ActivityType.CARD_UPDATED,
        metadata: {
          cardId: card.id,
          fromColumnId: existingCard.columnId,
          toColumnId: card.columnId,
          position: card.position,
        },
      },
    });

    return jsonResponse({ card });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse("Forbidden", 403);
    }

    if (error instanceof Error && error.message === "CardNotFound") {
      return errorResponse("Card not found", 404);
    }

    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request);
    const params = cardParamsSchema.safeParse(await context.params);

    if (!params.success) {
      return errorResponse("Invalid card id", 422);
    }

    await requireCardRole(params.data.cardId, user.id);

    await prisma.card.delete({
      where: { id: params.data.cardId },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse("Forbidden", 403);
    }

    if (error instanceof Error && error.message === "CardNotFound") {
      return errorResponse("Card not found", 404);
    }

    return handleRouteError(error);
  }
}
