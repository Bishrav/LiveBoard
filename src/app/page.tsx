"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  Check,
  Circle,
  Clock3,
  Database,
  GitBranch,
  GripVertical,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wifi,
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import styles from "./page.module.css";

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  boardCount: number;
  memberCount: number;
};

type BoardCard = {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  assigneeId: string | null;
  assignee?: AuthUser | null;
};

type BoardColumn = {
  id: string;
  title: string;
  position: number;
  cards: BoardCard[];
};

type ActivityEvent = {
  id: string;
  type: string;
  createdAt: string;
  actor: AuthUser;
  metadata: Record<string, unknown>;
};

type BoardDetail = {
  id: string;
  title: string;
  workspace: {
    id: string;
    name: string;
    members: Array<{
      role: string;
      user: AuthUser;
    }>;
  };
  columns: BoardColumn[];
  activities: ActivityEvent[];
};

type BoardResponse = {
  board: BoardDetail;
};

type LoginResponse = {
  user: AuthUser;
  token: string;
};

type ConnectionStatus = "loading" | "connected" | "offline" | "error";

const demoCredentials = {
  email: "admin@liveboard.dev",
  password: "LiveBoardDemo123!",
};

const tagTones = ["blue", "green", "red", "gold"] as const;

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatEvent(event: ActivityEvent) {
  const cardTitle =
    typeof event.metadata?.title === "string"
      ? event.metadata.title
      : "a card";

  return `${event.actor.name} ${event.type.toLowerCase().replaceAll("_", " ")} ${cardTitle}`;
}

function sortColumns(columns: BoardColumn[]) {
  return [...columns]
    .sort((first, second) => first.position - second.position)
    .map((column) => ({
      ...column,
      cards: [...column.cards].sort(
        (first, second) => first.position - second.position,
      ),
    }));
}

function updateCardInBoard(
  board: BoardDetail,
  card: BoardCard,
  removeFromPreviousColumn = true,
) {
  return {
    ...board,
    columns: sortColumns(
      board.columns.map((column) => {
        const withoutCard = removeFromPreviousColumn
          ? column.cards.filter((item) => item.id !== card.id)
          : column.cards;

        if (column.id !== card.columnId) {
          return { ...column, cards: withoutCard };
        }

        return {
          ...column,
          cards: [...withoutCard, card],
        };
      }),
    ),
  };
}

export default function Home() {
  const socketRef = useRef<Socket | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [presence, setPresence] = useState<AuthUser[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [statusText, setStatusText] = useState("Loading demo board");
  const [search, setSearch] = useState("");
  const boardId = board?.id;

  useEffect(() => {
    let cancelled = false;

    async function bootstrapDemo() {
      try {
        const loginResponse = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(demoCredentials),
        });

        if (!loginResponse.ok) {
          throw new Error("Demo login failed");
        }

        const login = (await loginResponse.json()) as LoginResponse;

        const workspaceResponse = await fetch("/api/workspaces", {
          headers: { Authorization: `Bearer ${login.token}` },
        });

        if (!workspaceResponse.ok) {
          throw new Error("Workspace fetch failed");
        }

        const workspaceData = (await workspaceResponse.json()) as {
          workspaces: WorkspaceSummary[];
        };
        const firstWorkspace = workspaceData.workspaces[0];

        if (!firstWorkspace) {
          throw new Error("Seed workspace missing");
        }

        const workspaceDetailResponse = await fetch(
          `/api/workspaces/${firstWorkspace.id}`,
          { headers: { Authorization: `Bearer ${login.token}` } },
        );

        if (!workspaceDetailResponse.ok) {
          throw new Error("Workspace detail fetch failed");
        }

        const workspaceDetail = (await workspaceDetailResponse.json()) as {
          workspace: WorkspaceSummary & {
            boards: Array<{ id: string; title: string }>;
          };
        };
        const firstBoard = workspaceDetail.workspace.boards[0];

        if (!firstBoard) {
          throw new Error("Seed board missing");
        }

        const boardResponse = await fetch(`/api/boards/${firstBoard.id}`, {
          headers: { Authorization: `Bearer ${login.token}` },
        });

        if (!boardResponse.ok) {
          throw new Error("Board fetch failed");
        }

        const boardData = (await boardResponse.json()) as BoardResponse;

        if (!cancelled) {
          setToken(login.token);
          setUser(login.user);
          setWorkspace(firstWorkspace);
          setBoard({ ...boardData.board, columns: sortColumns(boardData.board.columns) });
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setStatusText(error instanceof Error ? error.message : "Demo failed");
        }
      }
    }

    bootstrapDemo();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token || !boardId) {
      return;
    }

    const socket = io({
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("server:ready", () => {
      setStatus("connected");
      setStatusText("Socket connected");
      socket.emit("board:join", { boardId }, (response: { ok: boolean; error?: string }) => {
        if (!response.ok) {
          setStatus("error");
          setStatusText(response.error ?? "Board room join failed");
        }
      });
    });

    socket.on("connect_error", () => {
      setStatus("error");
      setStatusText("Socket auth failed");
    });

    socket.on("disconnect", () => {
      setStatus("offline");
      setStatusText("Socket disconnected");
    });

    socket.on(
      "presence:snapshot",
      (payload: { boardId: string; users: AuthUser[] }) => {
        if (payload.boardId === boardId) {
          setPresence(payload.users);
        }
      },
    );

    socket.on("card:created", (payload: { boardId: string; card: BoardCard }) => {
      if (payload.boardId === boardId) {
        setBoard((current) =>
          current ? updateCardInBoard(current, payload.card, true) : current,
        );
      }
    });

    socket.on("card:updated", (payload: { boardId: string; card: BoardCard }) => {
      if (payload.boardId === boardId) {
        setBoard((current) =>
          current ? updateCardInBoard(current, payload.card, true) : current,
        );
      }
    });

    socket.on("card:moved", (payload: { boardId: string; card: BoardCard }) => {
      if (payload.boardId === boardId) {
        setBoard((current) =>
          current ? updateCardInBoard(current, payload.card, true) : current,
        );
      }
    });

    socket.on(
      "card:deleted",
      (payload: { boardId: string; cardId: string }) => {
        if (payload.boardId === boardId) {
          setBoard((current) =>
            current
              ? {
                  ...current,
                  columns: current.columns.map((column) => ({
                    ...column,
                    cards: column.cards.filter((card) => card.id !== payload.cardId),
                  })),
                }
              : current,
          );
        }
      },
    );

    return () => {
      socket.emit("board:leave", { boardId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [boardId, token]);

  const filteredColumns = useMemo(() => {
    if (!board) {
      return [];
    }

    const query = search.trim().toLowerCase();

    if (!query) {
      return board.columns;
    }

    return board.columns.map((column) => ({
      ...column,
      cards: column.cards.filter(
        (card) =>
          card.title.toLowerCase().includes(query) ||
          card.description?.toLowerCase().includes(query),
      ),
    }));
  }, [board, search]);

  const totalCards = useMemo(
    () => board?.columns.reduce((total, column) => total + column.cards.length, 0) ?? 0,
    [board],
  );

  function addCard(columnId: string) {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    socket.emit(
      "card:create",
      {
        columnId,
        title: `Interview demo card ${new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        description: "Created from the live Socket.io board demo.",
      },
      (response: { ok: boolean; error?: string }) => {
        if (!response.ok) {
          setStatus("error");
          setStatusText(response.error ?? "Card create failed");
        }
      },
    );
  }

  function moveCard(card: BoardCard, direction: 1 | -1) {
    const socket = socketRef.current;

    if (!socket || !board) {
      return;
    }

    const currentColumnIndex = board.columns.findIndex(
      (column) => column.id === card.columnId,
    );
    const nextColumn = board.columns[currentColumnIndex + direction];

    if (!nextColumn) {
      return;
    }

    const nextPosition =
      (nextColumn.cards.at(-1)?.position ?? nextColumn.position) + 1000;

    socket.emit("card:update", {
      cardId: card.id,
      columnId: nextColumn.id,
      position: nextPosition,
    });
  }

  const activeUsers = presence.length > 0 ? presence : user ? [user] : [];
  const workspaceName = workspace?.name ?? "Product Launch";
  const boardTitle = board?.title ?? "Real-time delivery board";

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Workspace navigation">
        <div className={styles.brand}>
          <div className={styles.brandMark}>L</div>
          <div>
            <strong>LiveBoard</strong>
            <span>Team workspace</span>
          </div>
        </div>

        <nav className={styles.nav}>
          <a className={styles.navActive} href="#board">
            <GitBranch size={18} /> Boards
          </a>
          <a href="#activity">
            <Activity size={18} /> Activity
          </a>
          <a href="#team">
            <Users size={18} /> Team
          </a>
          <a href="#security">
            <ShieldCheck size={18} /> Access
          </a>
        </nav>

        <div className={styles.statusPanel}>
          <div className={styles.statusRow}>
            <Wifi size={16} />
            <span>{statusText}</span>
          </div>
          <div className={styles.statusRow}>
            <Database size={16} />
            <span>Redis adapter ready</span>
          </div>
          <div className={styles.statusRow}>
            <Lock size={16} />
            <span>{user ? `${user.name} signed in` : "JWT session loading"}</span>
          </div>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.eyebrow}>{workspaceName}</p>
            <h1>{boardTitle}</h1>
          </div>

          <div className={styles.tools}>
            <label className={styles.search}>
              <Search size={17} />
              <input
                aria-label="Search tasks"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search cards"
                value={search}
              />
            </label>
            <button className={styles.iconButton} aria-label="Notifications">
              <Bell size={18} />
            </button>
            <button className={styles.primaryButton}>
              <Plus size={18} /> Invite
            </button>
          </div>
        </header>

        <section className={styles.metrics} aria-label="Board metrics">
          <div>
            <span>Online now</span>
            <strong>{activeUsers.length}</strong>
          </div>
          <div>
            <span>Cards synced</span>
            <strong>{totalCards}</strong>
          </div>
          <div>
            <span>Members</span>
            <strong>{workspace?.memberCount ?? board?.workspace.members.length ?? 0}</strong>
          </div>
          <div>
            <span>Socket state</span>
            <strong>{status === "connected" ? "Live" : "Sync"}</strong>
          </div>
        </section>

        <section className={styles.boardWrap} id="board">
          <div className={styles.boardHeader}>
            <div className={styles.presence}>
              {activeUsers.slice(0, 4).map((person) => (
                <span key={person.id}>{initials(person.name)}</span>
              ))}
              {activeUsers.length > 4 ? <em>+{activeUsers.length - 4}</em> : null}
            </div>
            <div className={styles.liveBadge}>
              <Radio size={15} /> {status === "connected" ? "Live updates" : "Connecting"}
            </div>
          </div>

          <div className={styles.board}>
            {filteredColumns.map((column) => (
              <section className={styles.column} key={column.id}>
                <header>
                  <div>
                    <h2>{column.title}</h2>
                    <span>{column.cards.length} cards</span>
                  </div>
                  <button aria-label={`More options for ${column.title}`}>
                    <MoreHorizontal size={17} />
                  </button>
                </header>

                <div className={styles.cardList}>
                  {column.cards.map((card, cardIndex) => (
                    <article className={styles.taskCard} key={card.id}>
                      <div className={styles.cardTop}>
                        <GripVertical size={16} />
                        <span
                          className={`${styles.tag} ${
                            styles[tagTones[cardIndex % tagTones.length]]
                          }`}
                        >
                          {card.assignee ? "Assigned" : "Open"}
                        </span>
                      </div>
                      <h3>{card.title}</h3>
                      <p>{card.description ?? "No description yet."}</p>
                      <footer>
                        <span className={styles.avatar}>
                          {initials(card.assignee?.name ?? user?.name ?? "LiveBoard")}
                        </span>
                        <div>
                          <MessageSquare size={15} /> {card.assignee ? 1 : 0}
                        </div>
                      </footer>
                      <footer>
                        <button
                          className={styles.iconButton}
                          aria-label={`Move ${card.title} left`}
                          disabled={column.id === board?.columns[0]?.id}
                          onClick={() => moveCard(card, -1)}
                        >
                          {"<"}
                        </button>
                        <button
                          className={styles.iconButton}
                          aria-label={`Move ${card.title} right`}
                          disabled={column.id === board?.columns.at(-1)?.id}
                          onClick={() => moveCard(card, 1)}
                        >
                          {">"}
                        </button>
                      </footer>
                    </article>
                  ))}
                </div>

                <button className={styles.addCard} onClick={() => addCard(column.id)}>
                  <Plus size={16} /> Add card
                </button>
              </section>
            ))}
          </div>
        </section>

        <section className={styles.lowerGrid}>
          <div className={styles.panel} id="activity">
            <div className={styles.panelTitle}>
              <h2>Activity stream</h2>
              <Clock3 size={18} />
            </div>
            {(board?.activities ?? []).slice(0, 3).map((event) => (
              <div className={styles.event} key={event.id}>
                <Circle size={10} />
                <span>{formatEvent(event)}</span>
              </div>
            ))}
          </div>

          <div className={styles.panel} id="security">
            <div className={styles.panelTitle}>
              <h2>Portfolio proof points</h2>
              <Sparkles size={18} />
            </div>
            {[
              "Socket.io rooms with Redis pub/sub",
              "PostgreSQL schema with ordered cards",
              "Role-based workspace permissions",
              "Docker Compose and CI-ready tests",
            ].map((item) => (
              <div className={styles.checkItem} key={item}>
                <Check size={16} />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className={styles.panel} id="team">
            <div className={styles.panelTitle}>
              <h2>Upcoming sprint</h2>
              <CalendarDays size={18} />
            </div>
            <p className={styles.sprintText}>
              Demo account loads real board data, joins an authenticated Socket.io room,
              updates presence, and broadcasts card changes across clients.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
