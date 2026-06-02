import type { ApiError } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type RequestOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
  formData?: FormData;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    cache: "no-store"
  });

  if (!response.ok) {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = undefined;
    }
    const message =
      typeof details === "object" && details && "detail" in details
        ? String((details as { detail: unknown }).detail)
        : `Request failed with status ${response.status}`;
    throw { status: response.status, message, details } satisfies ApiError;
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return String((error as ApiError).message);
  }
  return "Khong the ket noi API. Hay thu lai.";
}
