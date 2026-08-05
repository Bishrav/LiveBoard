export async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

export function bearer(token: string) {
  return {
    authorization: `Bearer ${token}`,
  };
}

export function jsonRequest(body: unknown, token?: string) {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? bearer(token) : {}),
    },
    body: JSON.stringify(body),
  });
}

export function getRequest(token?: string) {
  return new Request("http://localhost/test", {
    headers: token ? bearer(token) : undefined,
  });
}

export function patchRequest(body: unknown, token?: string) {
  return new Request("http://localhost/test", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...(token ? bearer(token) : {}),
    },
    body: JSON.stringify(body),
  });
}
