import { createServer, type Server as HttpServer } from "http";
import { WorkspaceRole } from "@prisma/client";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { Server } from "socket.io";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { signAuthToken, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerLiveBoardSocket } from "../../server";

type SocketHarness = {
  boardId: string;
  backlogId: string;
  doneId: string;
  token: string;
  outsiderToken: string;
};

type JoinResponse = {
  ok: boolean;
  boardId?: string;
  error?: string;
};

type CardResponse = {
  ok: boolean;
  card?: {
    id: string;
    columnId: string;
    title: string;
    position: number;
  };
  error?: string;
};

async function createSocketFixture() {
  const owner = await prisma.user.create({
    data: {
      name: "Socket Owner",
      email: "socket-owner@liveboard.test",
      passwordHash: await hashPassword("LiveBoardDemo123!"),
    },
  });

  const outsider = await prisma.user.create({
    data: {
      name: "Socket Outsider",
      email: "socket-outsider@liveboard.test",
      passwordHash: await hashPassword("LiveBoardDemo123!"),
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Socket Workspace",
      slug: `socket-${crypto.randomUUID()}`,
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
      title: "Socket Board",
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
    boardId: board.id,
    backlogId: board.columns[0].id,
    doneId: board.columns[1].id,
    token: signAuthToken(owner),
    outsiderToken: signAuthToken(outsider),
  };
}

async function listen(server: HttpServer) {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Socket server failed to bind");
  }

  return `http://127.0.0.1:${address.port}`;
}

async function connectSocket(baseUrl: string, token: string) {
  const socket = createClient(baseUrl, {
    auth: { token },
    reconnection: false,
    transports: ["websocket"],
  });

  await new Promise<void>((resolve, reject) => {
    socket.once("server:ready", () => resolve());
    socket.once("connect_error", reject);
  });

  return socket;
}

function emitAck<T>(
  socket: ClientSocket,
  event: string,
  payload: Record<string, unknown>,
) {
  return new Promise<T>((resolve) => {
    socket.emit(event, payload, resolve);
  });
}

function waitForEvent<T>(socket: ClientSocket, event: string) {
  return new Promise<T>((resolve) => {
    socket.once(event, resolve);
  });
}

describe("socket API", () => {
  let httpServer: HttpServer;
  let io: Server;
  let baseUrl: string;
  let fixture: SocketHarness;
  const sockets: ClientSocket[] = [];

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret-for-socket-api";
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ["socket-owner@liveboard.test", "socket-outsider@liveboard.test"],
        },
      },
    });
    fixture = await createSocketFixture();
    httpServer = createServer();
    io = new Server(httpServer);
    registerLiveBoardSocket(io);
    baseUrl = await listen(httpServer);
  });

  afterEach(async () => {
    sockets.forEach((socket) => socket.disconnect());
    sockets.length = 0;
    await io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("joins board rooms and emits presence snapshots", async () => {
    const socket = await connectSocket(baseUrl, fixture.token);
    sockets.push(socket);

    const snapshotPromise = waitForEvent<{ users: Array<{ email: string }> }>(
      socket,
      "presence:snapshot",
    );
    const response = await emitAck<JoinResponse>(socket, "board:join", {
      boardId: fixture.boardId,
    });
    const snapshot = await snapshotPromise;

    expect(response).toMatchObject({ ok: true, boardId: fixture.boardId });
    expect(snapshot.users).toEqual([
      expect.objectContaining({ email: "socket-owner@liveboard.test" }),
    ]);
  });

  it("blocks non-members from joining private board rooms", async () => {
    const socket = await connectSocket(baseUrl, fixture.outsiderToken);
    sockets.push(socket);

    const response = await emitAck<JoinResponse>(socket, "board:join", {
      boardId: fixture.boardId,
    });

    expect(response).toMatchObject({ ok: false, error: "Forbidden" });
  });

  it("persists and broadcasts card create and move events", async () => {
    const first = await connectSocket(baseUrl, fixture.token);
    const second = await connectSocket(baseUrl, fixture.token);
    sockets.push(first, second);

    await emitAck<JoinResponse>(first, "board:join", {
      boardId: fixture.boardId,
    });
    await emitAck<JoinResponse>(second, "board:join", {
      boardId: fixture.boardId,
    });

    const createdEvent = waitForEvent<{ card: { id: string; title: string } }>(
      second,
      "card:created",
    );
    const created = await emitAck<CardResponse>(first, "card:create", {
      columnId: fixture.backlogId,
      title: "Socket created card",
      description: "Created through socket integration test.",
    });

    expect(created.ok).toBe(true);
    expect((await createdEvent).card.title).toBe("Socket created card");

    const movedEvent = waitForEvent<{ card: { id: string; columnId: string } }>(
      second,
      "card:moved",
    );
    const moved = await emitAck<CardResponse>(first, "card:update", {
      cardId: created.card?.id,
      columnId: fixture.doneId,
      position: 3000,
    });

    expect(moved.ok).toBe(true);
    expect((await movedEvent).card.columnId).toBe(fixture.doneId);

    const persistedCard = await prisma.card.findUnique({
      where: { id: created.card?.id },
      select: { columnId: true },
    });

    expect(persistedCard?.columnId).toBe(fixture.doneId);
  });
});
