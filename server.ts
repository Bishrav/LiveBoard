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

        socket.to(boardRoom(boardId)).emit("board:user-joined", {
          boardId,
          user: socket.data.user,
        });

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
      socket.to(boardRoom(boardId)).emit("board:user-left", {
        boardId,
        user: socket.data.user,
      });

      callback?.({ ok: true, boardId });
    });

    socket.on("disconnect", () => {
      for (const boardId of socket.data.boardIds) {
        socket.to(boardRoom(boardId)).emit("board:user-left", {
          boardId,
          user: socket.data.user,
        });
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
