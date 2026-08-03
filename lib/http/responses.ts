export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json({ data }, init);
}

export function fail(message: string, status = 400, details?: unknown) {
  return Response.json(
    {
      error: {
        message,
        details,
      },
    },
    { status },
  );
}
