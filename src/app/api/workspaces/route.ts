import { WorkspaceRole } from "@prisma/client";
import { errorResponse, handleRouteError, jsonResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSlug } from "@/lib/slug";
import { createWorkspaceSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        members: {
          where: { userId: user.id },
          select: { role: true },
        },
        _count: {
          select: {
            boards: true,
            members: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonResponse({
      workspaces: workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: workspace.members[0]?.role,
        boardCount: workspace._count.boards,
        memberCount: workspace._count.members,
        createdAt: workspace.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse("Unauthorized", 401);
    }

    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const parsed = createWorkspaceSchema.safeParse(await request.json());

    if (!parsed.success) {
      return errorResponse("Invalid workspace details", 422);
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: parsed.data.name,
        slug: `${createSlug(parsed.data.name)}-${crypto.randomUUID().slice(0, 8)}`,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: WorkspaceRole.OWNER,
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
      },
    });

    return jsonResponse({ workspace }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse("Unauthorized", 401);
    }

    return handleRouteError(error);
  }
}
