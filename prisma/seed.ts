import bcrypt from "bcryptjs";
import { ActivityType, PrismaClient, WorkspaceRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("LiveBoardDemo123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@liveboard.dev" },
    update: {},
    create: {
      name: "Bishrav Shiwakoti",
      email: "admin@liveboard.dev",
      passwordHash,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: "member@liveboard.dev" },
    update: {},
    create: {
      name: "Demo Member",
      email: "member@liveboard.dev",
      passwordHash,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "product-launch" },
    update: {},
    create: {
      name: "Product Launch",
      slug: "product-launch",
      ownerId: admin.id,
      members: {
        create: [
          { userId: admin.id, role: WorkspaceRole.OWNER },
          { userId: member.id, role: WorkspaceRole.MEMBER },
        ],
      },
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: admin.id,
      },
    },
    update: { role: WorkspaceRole.OWNER },
    create: {
      workspaceId: workspace.id,
      userId: admin.id,
      role: WorkspaceRole.OWNER,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: member.id,
      },
    },
    update: { role: WorkspaceRole.MEMBER },
    create: {
      workspaceId: workspace.id,
      userId: member.id,
      role: WorkspaceRole.MEMBER,
    },
  });

  const existingBoard = await prisma.board.findFirst({
    where: {
      workspaceId: workspace.id,
      title: "Real-time delivery board",
    },
    select: { id: true },
  });

  if (existingBoard) {
    return;
  }

  const board = await prisma.board.create({
    data: {
      workspaceId: workspace.id,
      title: "Real-time delivery board",
      columns: {
        create: [
          {
            title: "Backlog",
            position: 1000,
            cards: {
              create: [
                {
                  title: "Workspace invite flow",
                  description: "API route and email token workflow.",
                  position: 1000,
                  assigneeId: admin.id,
                },
                {
                  title: "Board activity stream",
                  description: "Persist movement events for audit history.",
                  position: 2000,
                  assigneeId: member.id,
                },
              ],
            },
          },
          {
            title: "In Progress",
            position: 2000,
            cards: {
              create: [
                {
                  title: "Socket room broadcasting",
                  description: "Board-specific realtime rooms.",
                  position: 1000,
                  assigneeId: admin.id,
                },
                {
                  title: "Drag order persistence",
                  description: "Optimistic UI with rollback.",
                  position: 2000,
                  assigneeId: admin.id,
                },
              ],
            },
          },
          { title: "Review", position: 3000 },
          { title: "Done", position: 4000 },
        ],
      },
    },
  });

  await prisma.activityEvent.create({
    data: {
      boardId: board.id,
      actorId: admin.id,
      type: ActivityType.BOARD_CREATED,
      metadata: { title: board.title },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
