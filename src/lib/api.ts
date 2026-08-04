export function jsonResponse<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function handleRouteError(error: unknown) {
  console.error(error);
  return errorResponse("Internal server error", 500);
}
