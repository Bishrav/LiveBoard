# API Route Overview

LiveBoard uses REST endpoints for durable state changes and Socket.io events for real-time fanout.

## Auth

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a user and return a JWT session. |
| `POST` | `/api/auth/login` | Verify credentials and return a JWT session. |
| `GET` | `/api/auth/me` | Return the current user from the bearer token. |

## Workspaces

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/workspaces` | List workspaces for the authenticated user. |
| `POST` | `/api/workspaces` | Create a workspace and assign owner role. |
| `GET` | `/api/workspaces/:workspaceId` | Return workspace details and member role. |
| `POST` | `/api/workspaces/:workspaceId/invites` | Invite a member by email and role. |
| `POST` | `/api/invites/:token/accept` | Accept a workspace invitation. |

Invite creation requires an owner/admin workspace role. Invite acceptance requires a logged-in user whose email matches the invite email.

## Boards, Columns, Cards

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/boards/:boardId` | Return board, columns, cards, and members. |
| `POST` | `/api/workspaces/:workspaceId/boards` | Create a board. |
| `POST` | `/api/boards/:boardId/columns` | Create a column. |
| `PATCH` | `/api/columns/:columnId` | Rename or reorder a column. |
| `POST` | `/api/columns/:columnId/cards` | Create a card in a column. |
| `PATCH` | `/api/cards/:cardId` | Update title, description, assignee, or position. |
| `DELETE` | `/api/cards/:cardId` | Archive or delete a card. |

All board, column, and card routes require workspace membership. Board creation, column creation, and card mutations write activity events for later realtime fanout.

## Phase 4 Status

Implemented:

- JWT registration, login, and current-user lookup.
- Workspace list, creation, and detail lookup.
- Board creation and board detail lookup.
- Column creation/update.
- Card creation/update/move/delete.
- Workspace invite creation and acceptance.
- Prisma schema and demo seed data.
- Custom Socket.io server wrapper for Next.js App Router.
- JWT-authenticated Socket.io connections.
- Board room join/leave permission checks.
- Presence snapshots for active board users.
- Card create, update, move, and delete socket events.
- Redis socket adapter when `REDIS_URL` is configured.
- Unit tests for shared utility logic.
- API integration tests for auth, board access, and card movement persistence.
- Socket.io integration tests for rooms, presence, realtime broadcasts, and database persistence.
- GitHub Actions CI with PostgreSQL and Redis services.

Pending for later phases:

- Deployment health check endpoint.

## Realtime Events

| Event | Direction | Payload |
| --- | --- | --- |
| `board:join` | client to server | `{ boardId }` |
| `board:leave` | client to server | `{ boardId }` |
| `presence:snapshot` | server to client | `{ boardId, users }` |
| `board:user-joined` | server to client | `{ boardId, user }` |
| `board:user-left` | server to client | `{ boardId, user }` |
| `card:create` | client to server | `{ columnId, title, description?, assigneeId? }` |
| `card:update` | client to server | `{ cardId, title?, description?, assigneeId?, columnId?, position? }` |
| `card:delete` | client to server | `{ cardId }` |
| `card:created` | server to client | `{ boardId, card, actor }` |
| `card:updated` | server to client | `{ boardId, card, actor }` |
| `card:moved` | server to client | `{ boardId, card, actor, fromColumnId, toColumnId }` |
| `card:deleted` | server to client | `{ boardId, cardId, columnId, actor }` |

## Health

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check API, database, and Redis availability. |
