import { errorResponse, handleRouteError, jsonResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireColumnRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { columnParamsSchema, updateColumnSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    columnId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser(request);
    const params = columnParamsSchema.safeParse(await context.params);
    const body = updateColumnSchema.safeParse(await request.json());

    if (!params.success) {
      return errorResponse("Invalid column id", 422);
    }

    if (!body.success || Object.keys(body.data).length === 0) {
      return errorResponse("Invalid column update", 422);
    }

    await requireColumnRole(params.data.columnId, user.id);

    const column = await prisma.column.update({
      where: { id: params.data.columnId },
      data: body.data,
    });

    return jsonResponse({ column });
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
