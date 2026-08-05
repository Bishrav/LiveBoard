import { createServer } from "http";
import next from "next";
import { Server, type Socket } from "socket.io";
import { getUserFromToken, type AuthUser } from "@/lib/auth";
import { requireBoardRole } from "@/lib/permissions";

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
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((request, response) => {
    handle(request, response);
  });

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
  });

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
