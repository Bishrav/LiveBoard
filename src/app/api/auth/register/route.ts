import { Prisma } from "@prisma/client";
import { errorResponse, handleRouteError, jsonResponse } from "@/lib/api";
import { hashPassword, signAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = registerSchema.safeParse(await request.json());

    if (!parsed.success) {
      return errorResponse("Invalid registration details", 422);
    }

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
      },
      select: { id: true, name: true, email: true },
    });

    return jsonResponse(
      {
        user,
        token: signAuthToken(user),
      },
      201,
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return errorResponse("Email is already registered", 409);
    }

    return handleRouteError(error);
  }
}
