import { createServer } from "http";
import { ActivityType } from "@prisma/client";
import { createAdapter } from "@socket.io/redis-adapter";
import next from "next";
import { createClient } from "redis";
import { Server, type Socket } from "socket.io";
import { getUserFromToken, type AuthUser } from "@/lib/auth";
import { requireBoardRole, requireCardRole, requireColumnRole } from "@/lib/permissions";
import { nextPosition } from "@/lib/positions";
import { prisma } from "@/lib/prisma";
import {
  createCardSchema,
  updateCardSchema,
} from "@/lib/validation";

type ClientToServerEvents = {
  "ping:client": (
    payload: unknown,
    callback?: (response: {
      ok: boolean;
      received: unknown;
      socketId: string;
    }) => void,
  ) => void;
  "board:join": (
    payload: { boardId?: string },
    callback?: (response: { ok: boolean; boardId?: string; error?: string }) => void,
  ) => void;
  "board:leave": (
    payload: { boardId?: string },
    callback?: (response: { ok: boolean; boardId?: string; error?: string }) => void,
  ) => void;
  "card:create": (
    payload: { columnId?: string; title?: string; description?: string; assigneeId?: string },
    callback?: (response: { ok: boolean; card?: CardPayload; error?: string }) => void,
  ) => void;
  "card:update": (
    payload: {
      cardId?: string;
      title?: string;
      description?: string | null;
      assigneeId?: string | null;
      columnId?: string;
      position?: number;
    },
    callback?: (response: { ok: boolean; card?: CardPayload; error?: string }) => void,
  ) => void;
  "card:delete": (
    payload: { cardId?: string },
    callback?: (response: { ok: boolean; cardId?: string; error?: string }) => void,
  ) => void;
};

type ServerToClientEvents = {
  "server:ready": (payload: {
    socketId: string;
    transport: string;
    user: AuthUser;
  }) => void;
  "presence:snapshot": (payload: {
    boardId: string;
    users: Array<AuthUser & { socketIds: string[] }>;
  }) => void;
  "board:user-joined": (payload: { boardId: string; user: AuthUser }) => void;
  "board:user-left": (payload: { boardId: string; user: AuthUser }) => void;
  "card:created": (payload: { boardId: string; card: CardPayload; actor: AuthUser }) => void;
  "card:updated": (payload: { boardId: string; card: CardPayload; actor: AuthUser }) => void;
  "card:moved": (payload: {
    boardId: string;
    card: CardPayload;
    actor: AuthUser;
    fromColumnId: string;
    toColumnId: string;
  }) => void;
  "card:deleted": (payload: {
    boardId: string;
    cardId: string;
    columnId: string;
    actor: AuthUser;
  }) => void;
};

type SocketData = {
  user: AuthUser;
  boardIds: Set<string>;
};

type LiveBoardSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

type CardPayload = {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignee?: AuthUser | null;
};

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const presenceByBoard = new Map<string, Map<string, AuthUser & { socketIds: Set<string> }>>();

function getSocketToken(socket: LiveBoardSocket) {
  const authToken = socket.handshake.auth.token;

  if (typeof authToken === "string") {
    return authToken;
  }

  const header = socket.handshake.headers.authorization;

  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }

  return null;
}

function boardRoom(boardId: string) {
  return `board:${boardId}`;
}

function serializePresence(boardId: string) {
  const users = presenceByBoard.get(boardId);

  if (!users) {
    return [];
  }

  return Array.from(users.values()).map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    socketIds: Array.from(user.socketIds),
  }));
}

function addPresence(boardId: string, socket: LiveBoardSocket) {
  const boardPresence = presenceByBoard.get(boardId) ?? new Map();
  const existingUser = boardPresence.get(socket.data.user.id);

  if (existingUser) {
    existingUser.socketIds.add(socket.id);
  } else {
    boardPresence.set(socket.data.user.id, {
      ...socket.data.user,
      socketIds: new Set([socket.id]),
    });
  }

  presenceByBoard.set(boardId, boardPresence);
}

function removePresence(boardId: string, socket: LiveBoardSocket) {
  const boardPresence = presenceByBoard.get(boardId);

  if (!boardPresence) {
    return;
  }

  const existingUser = boardPresence.get(socket.data.user.id);
  existingUser?.socketIds.delete(socket.id);

  if (existingUser && existingUser.socketIds.size === 0) {
    boardPresence.delete(socket.data.user.id);
  }

  if (boardPresence.size === 0) {
    presenceByBoard.delete(boardId);
  }
}

function emitPresenceSnapshot(io: ServerToClientEventsEmitter, boardId: string) {
  io.to(boardRoom(boardId)).emit("presence:snapshot", {
    boardId,
    users: serializePresence(boardId),
  });
}

function cardSelect() {
  return {
    id: true,
    columnId: true,
    title: true,
    description: true,
    position: true,
    assigneeId: true,
    createdAt: true,
    updatedAt: true,
    assignee: {
      select: { id: true, name: true, email: true },
    },
  };
}

type ServerToClientEventsEmitter = Pick<
  Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >,
  "to"
>;

async function main() {
  const httpServer = createServer((request, response) => {
    handle(request, response);
  });
  const app = next({
    dev,
    hostname,
    port,
    httpServer,
  });
  const handle = app.getRequestHandler();

  await app.prepare();

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN ?? "http://localhost:3000",
      methods: ["GET", "POST"],
    },
    destroyUpgrade: false,
  });

  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.io Redis adapter connected");
  }

  io.use(async (socket, nextMiddleware) => {
    const user = await getUserFromToken(getSocketToken(socket));

    if (!user) {
      nextMiddleware(new Error("Unauthorized"));
      return;
    }

    socket.data.user = user;
    socket.data.boardIds = new Set();
    nextMiddleware();
  });

  io.on("connection", (socket) => {
    socket.emit("server:ready", {
      socketId: socket.id,
      transport: socket.conn.transport.name,
      user: socket.data.user,
    });

    socket.on("ping:client", (payload, callback) => {
      callback?.({
        ok: true,
        received: payload,
        socketId: socket.id,
      });
    });

    socket.on("board:join", async (payload, callback) => {
      const boardId = payload.boardId;

      if (!boardId) {
        callback?.({ ok: false, error: "boardId is required" });
        return;
      }

      try {
        await requireBoardRole(boardId, socket.data.user.id);
        socket.join(boardRoom(boardId));
        socket.data.boardIds.add(boardId);
        addPresence(boardId, socket);

        socket.to(boardRoom(boardId)).emit("board:user-joined", {
          boardId,
          user: socket.data.user,
        });
        emitPresenceSnapshot(io, boardId);

        callback?.({ ok: true, boardId });
      } catch (error) {
        callback?.({
          ok: false,
          error:
            error instanceof Error && error.message === "BoardNotFound"
              ? "Board not found"
              : "Forbidden",
        });
      }
    });

    socket.on("board:leave", (payload, callback) => {
      const boardId = payload.boardId;

      if (!boardId) {
        callback?.({ ok: false, error: "boardId is required" });
        return;
      }

      socket.leave(boardRoom(boardId));
      socket.data.boardIds.delete(boardId);
      removePresence(boardId, socket);
      socket.to(boardRoom(boardId)).emit("board:user-left", {
        boardId,
        user: socket.data.user,
      });
      emitPresenceSnapshot(io, boardId);

      callback?.({ ok: true, boardId });
    });

    socket.on("card:create", async (payload, callback) => {
      const parsed = createCardSchema.safeParse(payload);
      const columnId = payload.columnId;

      if (!columnId || !parsed.success) {
        callback?.({ ok: false, error: "Invalid card details" });
        return;
      }

      try {
        await requireColumnRole(columnId, socket.data.user.id);

        const column = await prisma.column.findUnique({
          where: { id: columnId },
          select: { boardId: true },
        });

        if (!column) {
          callback?.({ ok: false, error: "Column not found" });
          return;
        }

        const position = await nextPosition(
          () =>
            prisma.card.findFirst({
              where: { columnId },
              orderBy: { position: "desc" },
            }),
          (card) => card.position,
        );

        const card = await prisma.card.create({
          data: {
            columnId,
            title: parsed.data.title,
            description: parsed.data.description,
            assigneeId: parsed.data.assigneeId,
            position,
          },
          select: cardSelect(),
        });

        await prisma.activityEvent.create({
          data: {
            boardId: column.boardId,
            actorId: socket.data.user.id,
            type: ActivityType.CARD_CREATED,
            metadata: { cardId: card.id, title: card.title },
          },
        });

        io.to(boardRoom(column.boardId)).emit("card:created", {
          boardId: column.boardId,
          card,
          actor: socket.data.user,
        });
        callback?.({ ok: true, card });
      } catch {
        callback?.({ ok: false, error: "Forbidden" });
      }
    });

    socket.on("card:update", async (payload, callback) => {
      const cardId = payload.cardId;
      const parsed = updateCardSchema.safeParse(payload);

      if (!cardId || !parsed.success) {
        callback?.({ ok: false, error: "Invalid card update" });
        return;
      }

      const data = Object.fromEntries(
        Object.entries({
          title: payload.title,
          description: payload.description,
          assigneeId: payload.assigneeId,
          columnId: payload.columnId,
          position: payload.position,
        }).filter(([, value]) => value !== undefined),
      );
      const update = updateCardSchema.safeParse(data);

      if (!update.success || Object.keys(update.data).length === 0) {
        callback?.({ ok: false, error: "Invalid card update" });
        return;
      }

      try {
        await requireCardRole(cardId, socket.data.user.id);

        const existingCard = await prisma.card.findUnique({
          where: { id: cardId },
          select: {
            columnId: true,
            column: { select: { boardId: true } },
          },
        });

        if (!existingCard) {
          callback?.({ ok: false, error: "Card not found" });
          return;
        }

        const card = await prisma.card.update({
          where: { id: cardId },
          data: update.data,
          select: cardSelect(),
        });
        const isMove =
          update.data.columnId !== undefined || update.data.position !== undefined;

        await prisma.activityEvent.create({
          data: {
            boardId: existingCard.column.boardId,
            actorId: socket.data.user.id,
            type: isMove ? ActivityType.CARD_MOVED : ActivityType.CARD_UPDATED,
            metadata: {
              cardId: card.id,
              fromColumnId: existingCard.columnId,
              toColumnId: card.columnId,
              position: card.position,
            },
          },
        });

        if (isMove) {
          io.to(boardRoom(existingCard.column.boardId)).emit("card:moved", {
            boardId: existingCard.column.boardId,
            card,
            actor: socket.data.user,
            fromColumnId: existingCard.columnId,
            toColumnId: card.columnId,
          });
        } else {
          io.to(boardRoom(existingCard.column.boardId)).emit("card:updated", {
            boardId: existingCard.column.boardId,
            card,
            actor: socket.data.user,
          });
        }

        callback?.({ ok: true, card });
      } catch {
        callback?.({ ok: false, error: "Forbidden" });
      }
    });

    socket.on("card:delete", async (payload, callback) => {
      const cardId = payload.cardId;

      if (!cardId) {
        callback?.({ ok: false, error: "cardId is required" });
        return;
      }

      try {
        await requireCardRole(cardId, socket.data.user.id);

        const existingCard = await prisma.card.findUnique({
          where: { id: cardId },
          select: {
            id: true,
            columnId: true,
            column: { select: { boardId: true } },
          },
        });

        if (!existingCard) {
          callback?.({ ok: false, error: "Card not found" });
          return;
        }

        await prisma.card.delete({ where: { id: cardId } });

        io.to(boardRoom(existingCard.column.boardId)).emit("card:deleted", {
          boardId: existingCard.column.boardId,
          cardId,
          columnId: existingCard.columnId,
          actor: socket.data.user,
        });
        callback?.({ ok: true, cardId });
      } catch {
        callback?.({ ok: false, error: "Forbidden" });
      }
    });

    socket.on("disconnect", () => {
      for (const boardId of socket.data.boardIds) {
        removePresence(boardId, socket);
        socket.to(boardRoom(boardId)).emit("board:user-left", {
          boardId,
          user: socket.data.user,
        });
        emitPresenceSnapshot(io, boardId);
      }
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`LiveBoard ready on http://${hostname}:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
