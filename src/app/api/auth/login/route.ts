import { errorResponse, handleRouteError, jsonResponse } from "@/lib/api";
import { signAuthToken, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await request.json());

    if (!parsed.success) {
      return errorResponse("Invalid login details", 422);
    }

    const userWithPassword = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, name: true, email: true, passwordHash: true },
    });

    if (
      !userWithPassword ||
      !(await verifyPassword(parsed.data.password, userWithPassword.passwordHash))
    ) {
      return errorResponse("Invalid email or password", 401);
    }

    const user = {
      id: userWithPassword.id,
      name: userWithPassword.name,
      email: userWithPassword.email,
    };

    return jsonResponse({
      user,
      token: signAuthToken(user),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
