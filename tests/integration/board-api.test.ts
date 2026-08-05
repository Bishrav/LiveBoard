import { WorkspaceRole } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET as getBoard } from "@/app/api/boards/[boardId]/route";
import { POST as createCard } from "@/app/api/columns/[columnId]/cards/route";
import { PATCH as updateCard } from "@/app/api/cards/[cardId]/route";
import { signAuthToken } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequest, jsonRequest, patchRequest, readJson } from "../helpers/api";

type BoardResponse = {
  board: {
    id: string;
    columns: Array<{
      id: string;
      cards: Array<{ id: string; columnId: string; position: number }>;
    }>;
  };
};

type CardResponse = {
  card: {
    id: string;
    columnId: string;
    position: number;
    title: string;
  };
};

async function createBoardFixture() {
  const owner = await prisma.user.create({
    data: {
      name: "Board API Owner",
      email: "board-owner@liveboard.test",
      passwordHash: await hashPassword("LiveBoardDemo123!"),
    },
  });

  const outsider = await prisma.user.create({
    data: {
      name: "Board API Outsider",
      email: "board-outsider@liveboard.test",
      passwordHash: await hashPassword("LiveBoardDemo123!"),
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Board API Workspace",
      slug: `board-api-${crypto.randomUUID()}`,
      ownerId: owner.id,
      members: {
        create: {
          userId: owner.id,
          role: WorkspaceRole.OWNER,
        },
      },
    },
  });

  const board = await prisma.board.create({
    data: {
      workspaceId: workspace.id,
      title: "Board API Test",
      columns: {
        create: [
          { title: "Backlog", position: 1000 },
          { title: "Done", position: 2000 },
        ],
      },
    },
    include: {
      columns: {
        orderBy: { position: "asc" },
      },
    },
  });

  return {
    owner,
    outsider,
    board,
    token: signAuthToken(owner),
    outsiderToken: signAuthToken(outsider),
  };
}

describe("board API", () => {
  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret-for-board-api";
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ["board-owner@liveboard.test", "board-outsider@liveboard.test"],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns a member board and persists card movement", async () => {
    const fixture = await createBoardFixture();
    const [backlog, done] = fixture.board.columns;

    const createResponse = await createCard(
      jsonRequest(
        {
          title: "Realtime persistence test",
          description: "Created by the API integration test.",
        },
        fixture.token,
      ),
      { params: Promise.resolve({ columnId: backlog.id }) },
    );

    expect(createResponse.status).toBe(201);
    const created = await readJson<CardResponse>(createResponse);
    expect(created.card.columnId).toBe(backlog.id);

    const moveResponse = await updateCard(
      patchRequest(
        {
          columnId: done.id,
          position: 3000,
        },
        fixture.token,
      ),
      { params: Promise.resolve({ cardId: created.card.id }) },
    );

    expect(moveResponse.status).toBe(200);
    const moved = await readJson<CardResponse>(moveResponse);
    expect(moved.card.columnId).toBe(done.id);

    const boardResponse = await getBoard(getRequest(fixture.token), {
      params: Promise.resolve({ boardId: fixture.board.id }),
    });

    expect(boardResponse.status).toBe(200);
    const board = await readJson<BoardResponse>(boardResponse);
    const doneCards = board.board.columns.find((column) => column.id === done.id)?.cards;
    expect(doneCards?.some((card) => card.id === created.card.id)).toBe(true);
  });

  it("blocks non-members from private boards", async () => {
    const fixture = await createBoardFixture();

    const response = await getBoard(getRequest(fixture.outsiderToken), {
      params: Promise.resolve({ boardId: fixture.board.id }),
    });

    expect(response.status).toBe(403);
  });
});
