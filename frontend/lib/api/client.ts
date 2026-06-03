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
    return translateApiMessage(String((error as ApiError).message));
  }
  return "Không thể kết nối API. Hãy thử lại.";
}

function translateApiMessage(message: string) {
  const labels: Record<string, string> = {
    "Requester has insufficient points for late return penalty.":
      "Người mượn không đủ LibriPoint để thanh toán phí trả trễ.",
    "Requester has insufficient points for settlement.":
      "Người yêu cầu không đủ LibriPoint để hoàn tất giao dịch.",
    "Free courier only supports configured campus handoff points near UET.":
      "Dịch vụ giao sách chỉ hỗ trợ các điểm giao nhận trong khuôn viên UET.",
    "Expected delivery time must be within 3 days after accepting the task.":
      "Thời gian giao dự kiến phải nằm trong vòng 3 ngày sau khi nhận nhiệm vụ."
  };
  return labels[message] ?? message;
}
