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
