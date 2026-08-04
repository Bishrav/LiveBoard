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

## Phase 2 Status

Implemented:

- JWT registration, login, and current-user lookup.
- Workspace list, creation, and detail lookup.
- Board creation and board detail lookup.
- Column creation/update.
- Card creation/update/move/delete.
- Workspace invite creation and acceptance.
- Prisma schema and demo seed data.

Pending for later phases:

- Socket.io realtime events.
- Redis pub/sub fanout.
- Health route implementation.
- Full automated API/integration tests.

## Realtime Events

| Event | Direction | Payload |
| --- | --- | --- |
| `board:join` | client to server | `{ boardId }` |
| `presence:update` | server to client | `{ userId, name, cursor, status }` |
| `card:moved` | both | `{ cardId, fromColumnId, toColumnId, position }` |
| `card:updated` | both | `{ cardId, fields }` |
| `column:updated` | both | `{ columnId, fields }` |
| `activity:created` | server to client | `{ id, type, actor, metadata, createdAt }` |

## Health

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check API, database, and Redis availability. |
