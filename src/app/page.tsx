"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
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

type WorkspaceMember = {
  role: string;
  user: AuthUser;
};

type BoardDetail = {
  id: string;
  title: string;
  workspace: {
    id: string;
    name: string;
    members: WorkspaceMember[];
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

type ConnectionStatus = "idle" | "loading" | "connected" | "offline" | "error";
type AuthMode = "login" | "register";
type AppView = "board" | "activity" | "team" | "access";

const sessionStorageKey = "liveboard.session";
const demoCredentials = {
  email: "admin@liveboard.dev",
  password: "LiveBoardDemo123!",
};

const tagTones = ["blue", "green", "red", "gold"] as const;

function readStoredSession() {
  try {
    const stored = window.localStorage.getItem(sessionStorageKey);

    if (!stored) {
      return null;
    }

    return JSON.parse(stored) as LoginResponse;
  } catch {
    return null;
  }
}

function writeStoredSession(session: LoginResponse) {
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

function clearStoredSession() {
  window.localStorage.removeItem(sessionStorageKey);
}

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
      : typeof event.metadata?.email === "string"
        ? event.metadata.email
        : "a card";

  return `${event.actor.name} ${event.type.toLowerCase().replaceAll("_", " ")} ${cardTitle}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [statusText, setStatusText] = useState("Sign in to open a board");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<AppView>("board");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "admin@liveboard.dev",
    password: "LiveBoardDemo123!",
  });
  const [authError, setAuthError] = useState("");
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "MEMBER",
  });
  const [inviteStatus, setInviteStatus] = useState("");
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const boardId = board?.id;

  async function loadWorkspace(nextToken: string, nextUser: AuthUser) {
    setStatus("loading");
    setStatusText("Loading workspace");
    const workspaceResponse = await fetch("/api/workspaces", {
      headers: { Authorization: `Bearer ${nextToken}` },
    });

    if (!workspaceResponse.ok) {
      throw new Error("Workspace fetch failed");
    }

    const workspaceData = (await workspaceResponse.json()) as {
      workspaces: WorkspaceSummary[];
    };
    const firstWorkspace = workspaceData.workspaces[0];

    if (!firstWorkspace) {
      throw new Error("No workspace available for this account");
    }

    const workspaceDetailResponse = await fetch(
      `/api/workspaces/${firstWorkspace.id}`,
      { headers: { Authorization: `Bearer ${nextToken}` } },
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
      throw new Error("No board available for this workspace");
    }

    const boardResponse = await fetch(`/api/boards/${firstBoard.id}`, {
      headers: { Authorization: `Bearer ${nextToken}` },
    });

    if (!boardResponse.ok) {
      throw new Error("Board fetch failed");
    }

    const boardData = (await boardResponse.json()) as BoardResponse;

    setToken(nextToken);
    setUser(nextUser);
    setWorkspace(firstWorkspace);
    setBoard({ ...boardData.board, columns: sortColumns(boardData.board.columns) });
    setStatusText("Connecting socket");
  }

  useEffect(() => {
    const storedSession = readStoredSession();

    if (!storedSession) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadWorkspace(storedSession.token, storedSession.user).catch(() => {
        clearStoredSession();
        setStatus("idle");
        setStatusText("Session expired");
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  async function authenticate(credentials: {
    name?: string;
    email: string;
    password: string;
  }) {
    setAuthError("");
    setStatus("loading");
    setStatusText(authMode === "register" ? "Creating account" : "Signing in");

    try {
      const response = await fetch(
        authMode === "register" ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        },
      );

      if (!response.ok) {
        throw new Error(authMode === "register" ? "Registration failed" : "Login failed");
      }

      const auth = (await response.json()) as LoginResponse;
      writeStoredSession(auth);
      await loadWorkspace(auth.token, auth.user);
    } catch (error) {
      setStatus("error");
      setStatusText("Authentication failed");
      setAuthError(error instanceof Error ? error.message : "Authentication failed");
    }
  }

  function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void authenticate({
      name: authMode === "register" ? authForm.name : undefined,
      email: authForm.email,
      password: authForm.password,
    });
  }

  function tryDemo() {
    setAuthMode("login");
    setAuthForm((current) => ({ ...current, ...demoCredentials }));
    void authenticate(demoCredentials);
  }

  function logout() {
    socketRef.current?.disconnect();
    socketRef.current = null;
    clearStoredSession();
    setToken(null);
    setUser(null);
    setWorkspace(null);
    setBoard(null);
    setPresence([]);
    setStatus("idle");
    setStatusText("Signed out");
  }

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
  const activeUsers = presence.length > 0 ? presence : user ? [user] : [];
  const workspaceName = workspace?.name ?? "Product Launch";
  const boardTitle = board?.title ?? "Real-time delivery board";
  const members = board?.workspace.members ?? [];

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

  function moveCardToColumn(card: BoardCard, column: BoardColumn) {
    const socket = socketRef.current;

    if (!socket || card.columnId === column.id) {
      return;
    }

    const nextPosition =
      (column.cards.at(-1)?.position ?? column.position) + 1000;

    socket.emit("card:update", {
      cardId: card.id,
      columnId: column.id,
      position: nextPosition,
    });
  }

  function findCard(cardId: string) {
    return board?.columns.flatMap((column) => column.cards).find((card) => card.id === cardId);
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !workspace) {
      return;
    }

    setInviteStatus("Creating invite");
    const response = await fetch(`/api/workspaces/${workspace.id}/invites`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(inviteForm),
    });

    if (!response.ok) {
      setInviteStatus("Invite failed. Admin or owner access is required.");
      return;
    }

    setInviteForm({ email: "", role: "MEMBER" });
    setInviteStatus("Invite created and activity event recorded.");
  }

  if (!user || !token) {
    return (
      <main className={styles.authShell}>
        <section className={styles.authPanel}>
          <div>
            <div className={styles.brand}>
              <div className={styles.brandMark}>L</div>
              <div>
                <strong>LiveBoard</strong>
                <span>Real-time team workspace</span>
              </div>
            </div>
            <h1>Sign in to your collaborative board</h1>
            <p>
              Use the seeded demo account or create an account to test the auth flow.
              Demo data is connected to PostgreSQL, Redis, and Socket.io rooms.
            </p>
          </div>

          <form className={styles.authForm} onSubmit={submitAuth}>
            <div className={styles.segmented}>
              <button
                className={authMode === "login" ? styles.segmentActive : ""}
                type="button"
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                className={authMode === "register" ? styles.segmentActive : ""}
                type="button"
                onClick={() => setAuthMode("register")}
              >
                Register
              </button>
            </div>

            {authMode === "register" ? (
              <label>
                Name
                <input
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                  value={authForm.name}
                />
              </label>
            ) : null}

            <label>
              Email
              <input
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, email: event.target.value }))
                }
                required
                type="email"
                value={authForm.email}
              />
            </label>

            <label>
              Password
              <input
                onChange={(event) =>
                  setAuthForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                required
                type="password"
                value={authForm.password}
              />
            </label>

            {authError ? <p className={styles.formError}>{authError}</p> : null}

            <button className={styles.primaryButton} type="submit">
              <Lock size={18} /> {authMode === "login" ? "Sign in" : "Create account"}
            </button>
            <button className={styles.secondaryButton} type="button" onClick={tryDemo}>
              <Sparkles size={18} /> Try demo workspace
            </button>
          </form>
        </section>
      </main>
    );
  }

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
          <button
            className={view === "board" ? styles.navActive : ""}
            onClick={() => setView("board")}
          >
            <GitBranch size={18} /> Boards
          </button>
          <button
            className={view === "activity" ? styles.navActive : ""}
            onClick={() => setView("activity")}
          >
            <Activity size={18} /> Activity
          </button>
          <button
            className={view === "team" ? styles.navActive : ""}
            onClick={() => setView("team")}
          >
            <Users size={18} /> Team
          </button>
          <button
            className={view === "access" ? styles.navActive : ""}
            onClick={() => setView("access")}
          >
            <ShieldCheck size={18} /> Access
          </button>
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
            <span>{user.name} signed in</span>
          </div>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.eyebrow}>{workspaceName}</p>
            <h1>{view === "board" ? boardTitle : view[0].toUpperCase() + view.slice(1)}</h1>
          </div>

          <div className={styles.tools}>
            {view === "board" ? (
              <label className={styles.search}>
                <Search size={17} />
                <input
                  aria-label="Search tasks"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search cards"
                  value={search}
                />
              </label>
            ) : null}
            <button className={styles.iconButton} aria-label="Notifications">
              <Bell size={18} />
            </button>
            <button className={styles.primaryButton} onClick={() => setView("access")}>
              <Plus size={18} /> Invite
            </button>
            <button className={styles.iconButton} aria-label="Logout" onClick={logout}>
              <LogOut size={18} />
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
            <strong>{workspace?.memberCount ?? members.length}</strong>
          </div>
          <div>
            <span>Socket state</span>
            <strong>{status === "connected" ? "Live" : "Sync"}</strong>
          </div>
        </section>

        {view === "board" ? (
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

                  <div
                    className={`${styles.cardList} ${
                      draggedCardId ? styles.dropReady : ""
                    }`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const cardId = event.dataTransfer.getData("text/plain");
                      const card = findCard(cardId);

                      if (card) {
                        moveCardToColumn(card, column);
                      }

                      setDraggedCardId(null);
                    }}
                  >
                    {column.cards.map((card, cardIndex) => (
                      <article
                        className={`${styles.taskCard} ${
                          draggedCardId === card.id ? styles.draggingCard : ""
                        }`}
                        draggable
                        key={card.id}
                        onDragEnd={() => setDraggedCardId(null)}
                        onDragStart={(event) => {
                          setDraggedCardId(card.id);
                          event.dataTransfer.setData("text/plain", card.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                      >
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
                            {initials(card.assignee?.name ?? user.name)}
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
        ) : null}

        {view === "activity" ? (
          <section className={styles.pageGrid}>
            <div className={styles.panelWide}>
              <div className={styles.panelTitle}>
                <h2>Activity stream</h2>
                <Clock3 size={18} />
              </div>
              {(board?.activities ?? []).map((event) => (
                <div className={styles.timelineItem} key={event.id}>
                  <Circle size={10} />
                  <div>
                    <strong>{formatEvent(event)}</strong>
                    <span>{formatDate(event.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {view === "team" ? (
          <section className={styles.pageGrid}>
            <div className={styles.panelWide}>
              <div className={styles.panelTitle}>
                <h2>Workspace members</h2>
                <Users size={18} />
              </div>
              <div className={styles.memberGrid}>
                {members.map((member) => (
                  <article className={styles.memberCard} key={member.user.id}>
                    <span className={styles.avatar}>{initials(member.user.name)}</span>
                    <div>
                      <strong>{member.user.name}</strong>
                      <span>{member.user.email}</span>
                    </div>
                    <em>{member.role.toLowerCase()}</em>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {view === "access" ? (
          <section className={styles.pageGrid}>
            <div className={styles.panelWide}>
              <div className={styles.panelTitle}>
                <h2>Invite access</h2>
                <UserPlus size={18} />
              </div>
              <form className={styles.inviteForm} onSubmit={createInvite}>
                <label>
                  Email
                  <input
                    onChange={(event) =>
                      setInviteForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                    type="email"
                    value={inviteForm.email}
                  />
                </label>
                <label>
                  Role
                  <select
                    onChange={(event) =>
                      setInviteForm((current) => ({
                        ...current,
                        role: event.target.value,
                      }))
                    }
                    value={inviteForm.role}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
                <button className={styles.primaryButton} type="submit">
                  <UserPlus size={18} /> Create invite
                </button>
              </form>
              {inviteStatus ? <p className={styles.inviteStatus}>{inviteStatus}</p> : null}
            </div>

            <div className={styles.panel}>
              <div className={styles.panelTitle}>
                <h2>Access model</h2>
                <ShieldCheck size={18} />
              </div>
              {[
                "Owners and admins can issue workspace invites",
                "Members can access private boards after acceptance",
                "Socket joins verify board membership before room access",
                "REST routes enforce workspace and board permissions",
              ].map((item) => (
                <div className={styles.checkItem} key={item}>
                  <Check size={16} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.lowerGrid}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>
              <h2>Activity preview</h2>
              <Clock3 size={18} />
            </div>
            {(board?.activities ?? []).slice(0, 3).map((event) => (
              <div className={styles.event} key={event.id}>
                <Circle size={10} />
                <span>{formatEvent(event)}</span>
              </div>
            ))}
          </div>

          <div className={styles.panel}>
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

          <div className={styles.panel}>
            <div className={styles.panelTitle}>
              <h2>Upcoming sprint</h2>
              <CalendarDays size={18} />
            </div>
            <p className={styles.sprintText}>
              This productized demo supports explicit auth, demo login, logout,
              team visibility, access invites, activity views, and realtime board
              collaboration.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
