type RequestBody = BodyInit | Record<string, unknown> | undefined;
type RequestOptions = Omit<RequestInit, "body"> & { body?: RequestBody };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const serializedBody =
    body === undefined
      ? undefined
      : typeof body === "string" || body instanceof FormData
        ? body
        : JSON.stringify(body);
  const init: RequestInit = {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...(serializedBody === undefined ? {} : { body: serializedBody }),
  };
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: RequestBody) =>
    request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: RequestBody) =>
    request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string, body?: RequestBody) =>
    request<T>(path, { method: "DELETE", body }),
};
