export function ok(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function fail(message: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${message}`,
      },
    ],
    isError: true as const,
  };
}

export function notFound(kind: string, id: string) {
  return fail(`${kind} not found: ${id}`);
}
