"use client";

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
import styles from "./page.module.css";

const columns = [
  {
    title: "Backlog",
    count: 4,
    cards: [
      {
        title: "Workspace invite flow",
        meta: "API + email token",
        tag: "Auth",
        owner: "BS",
        tone: "blue",
      },
      {
        title: "Board activity stream",
        meta: "Persist movement events",
        tag: "Audit",
        owner: "SK",
        tone: "green",
      },
    ],
  },
  {
    title: "In Progress",
    count: 3,
    cards: [
      {
        title: "Socket room broadcasting",
        meta: "Redis pub/sub fanout",
        tag: "Realtime",
        owner: "AR",
        tone: "red",
      },
      {
        title: "Drag order persistence",
        meta: "Optimistic UI + rollback",
        tag: "Board",
        owner: "BS",
        tone: "gold",
      },
    ],
  },
  {
    title: "Review",
    count: 2,
    cards: [
      {
        title: "Role permission matrix",
        meta: "Owner, admin, member",
        tag: "RBAC",
        owner: "NJ",
        tone: "blue",
      },
    ],
  },
  {
    title: "Done",
    count: 8,
    cards: [
      {
        title: "JWT protected routes",
        meta: "Access middleware",
        tag: "Security",
        owner: "BS",
        tone: "green",
      },
    ],
  },
];

const events = [
  "Bishrav moved Socket room broadcasting to In Progress",
  "Anita joined Product Launch board",
  "Redis worker delivered 128 board events today",
];

export default function Home() {
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
            <span>Socket connected</span>
          </div>
          <div className={styles.statusRow}>
            <Database size={16} />
            <span>Redis sync active</span>
          </div>
          <div className={styles.statusRow}>
            <Lock size={16} />
            <span>JWT session valid</span>
          </div>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.eyebrow}>Product Launch</p>
            <h1>Real-time delivery board</h1>
          </div>

          <div className={styles.tools}>
            <label className={styles.search}>
              <Search size={17} />
              <input aria-label="Search tasks" placeholder="Search cards" />
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
            <strong>6</strong>
          </div>
          <div>
            <span>Cards synced</span>
            <strong>247</strong>
          </div>
          <div>
            <span>Avg latency</span>
            <strong>42ms</strong>
          </div>
          <div>
            <span>Open invites</span>
            <strong>3</strong>
          </div>
        </section>

        <section className={styles.boardWrap} id="board">
          <div className={styles.boardHeader}>
            <div className={styles.presence}>
              {["BS", "AR", "NJ", "SM"].map((person) => (
                <span key={person}>{person}</span>
              ))}
              <em>+2</em>
            </div>
            <div className={styles.liveBadge}>
              <Radio size={15} /> Live updates
            </div>
          </div>

          <div className={styles.board}>
            {columns.map((column) => (
              <section className={styles.column} key={column.title}>
                <header>
                  <div>
                    <h2>{column.title}</h2>
                    <span>{column.count} cards</span>
                  </div>
                  <button aria-label={`More options for ${column.title}`}>
                    <MoreHorizontal size={17} />
                  </button>
                </header>

                <div className={styles.cardList}>
                  {column.cards.map((card) => (
                    <article className={styles.taskCard} key={card.title}>
                      <div className={styles.cardTop}>
                        <GripVertical size={16} />
                        <span className={`${styles.tag} ${styles[card.tone]}`}>
                          {card.tag}
                        </span>
                      </div>
                      <h3>{card.title}</h3>
                      <p>{card.meta}</p>
                      <footer>
                        <span className={styles.avatar}>{card.owner}</span>
                        <div>
                          <MessageSquare size={15} /> 4
                        </div>
                      </footer>
                    </article>
                  ))}
                </div>

                <button className={styles.addCard}>
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
            {events.map((event) => (
              <div className={styles.event} key={event}>
                <Circle size={10} />
                <span>{event}</span>
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
              Demo board seeded with two workspaces, admin/member roles, and
              real-time movement events for interview walkthroughs.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
