import { errorResponse, handleRouteError, jsonResponse } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    return jsonResponse({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
