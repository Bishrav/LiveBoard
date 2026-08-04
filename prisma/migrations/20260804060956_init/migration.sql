-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('BOARD_CREATED', 'COLUMN_CREATED', 'CARD_CREATED', 'CARD_MOVED', 'CARD_UPDATED', 'MEMBER_INVITED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boards" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "columns" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL,
    "column_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "assignee_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "boards_workspace_id_idx" ON "boards"("workspace_id");

-- CreateIndex
CREATE INDEX "columns_board_id_idx" ON "columns"("board_id");

-- CreateIndex
CREATE UNIQUE INDEX "columns_board_id_position_key" ON "columns"("board_id", "position");

-- CreateIndex
CREATE INDEX "cards_assignee_id_idx" ON "cards"("assignee_id");

-- CreateIndex
CREATE UNIQUE INDEX "cards_column_id_position_key" ON "cards"("column_id", "position");

-- CreateIndex
CREATE INDEX "invites_workspace_id_idx" ON "invites"("workspace_id");

-- CreateIndex
CREATE INDEX "invites_email_idx" ON "invites"("email");

-- CreateIndex
CREATE INDEX "activity_events_board_id_created_at_idx" ON "activity_events"("board_id", "created_at");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "columns" ADD CONSTRAINT "columns_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
