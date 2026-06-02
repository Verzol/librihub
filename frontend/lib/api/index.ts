import { apiFetch } from "./client";
import type {
  AdminBook,
  AdminLog,
  AdminUser,
  Book,
  BookInput,
  Category,
  CategorySummary,
  CommunityLeaderboard,
  CourierProfile,
  Delivery,
  DeliveryTask,
  LoginInput,
  PointBalance,
  PointLedger,
  RegisterInput,
  RegisterResponse,
  Review,
  ReviewType,
  TokenResponse,
  Transaction,
  TransactionType,
  DeliveryMethod,
  User,
  PublicUserSummary
} from "./types";

export const authApi = {
  register: (input: RegisterInput) => apiFetch<RegisterResponse>("/api/v1/auth/register", { method: "POST", body: input }),
  login: (input: LoginInput) => apiFetch<TokenResponse>("/api/v1/auth/login", { method: "POST", body: input }),
  me: (token: string) => apiFetch<User>("/api/v1/users/me", { token }),
  summary: (token: string, userId: number) => apiFetch<PublicUserSummary>(`/api/v1/users/${userId}/summary`, { token }),
  updateProfile: (token: string, input: Partial<RegisterInput>) =>
    apiFetch<User>("/api/v1/users/me/profile", { token, method: "PATCH", body: input }),
  registerCourier: (token: string, input: Partial<CourierProfile> & { delivery_area: string }) =>
    apiFetch<User>("/api/v1/users/me/courier-profile", { token, method: "POST", body: input })
};

export const booksApi = {
  categories: () => apiFetch<Category[]>("/api/v1/categories"),
  categorySummary: () => apiFetch<CategorySummary[]>("/api/v1/categories/summary"),
  leaderboard: () => apiFetch<CommunityLeaderboard>("/api/v1/community/leaderboard"),
  list: (token: string | null, params = "") => apiFetch<Book[]>(`/api/v1/books${params}`, { token }),
  detail: (token: string | null, id: number) => apiFetch<Book>(`/api/v1/books/${id}`, { token }),
  create: (token: string, input: BookInput) => apiFetch<Book>("/api/v1/books", { token, method: "POST", body: input }),
  update: (token: string, id: number, input: Partial<BookInput>) =>
    apiFetch<Book>(`/api/v1/books/${id}`, { token, method: "PATCH", body: input }),
  remove: (token: string, id: number) => apiFetch<Book>(`/api/v1/books/${id}`, { token, method: "DELETE" }),
  publish: (token: string, id: number) => apiFetch<Book>(`/api/v1/books/${id}/publish`, { token, method: "POST" }),
  uploadCover: (token: string, id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<{ book: Book; cover_image_url: string }>(`/api/v1/books/${id}/cover`, { token, method: "POST", formData });
  }
};

export const transactionsApi = {
  list: (token: string, role?: "owner" | "requester") =>
    apiFetch<Transaction[]>(`/api/v1/transactions/me${role ? `?role=${role}` : ""}`, { token }),
  create: (
    token: string,
    input: {
      book_id: number;
      transaction_type: TransactionType;
      delivery_method: DeliveryMethod;
      borrow_duration_days?: number | null;
      receiver_address?: string | null;
      receiver_lat?: number | null;
      receiver_lng?: number | null;
    }
  ) =>
    apiFetch<Transaction>("/api/v1/transactions", { token, method: "POST", body: input }),
  action: (
    token: string,
    id: number,
    action: "accept" | "reject" | "cancel" | "confirm" | "confirm-receipt" | "return" | "confirm-return",
    body?: unknown
  ) =>
    apiFetch<Transaction>(`/api/v1/transactions/${id}/${action}`, {
      token,
      method: "POST",
      body
    })
};

export const pointsApi = {
  balance: (token: string) => apiFetch<PointBalance>("/api/v1/points/me", { token }),
  ledger: (token: string) => apiFetch<PointLedger[]>("/api/v1/points/me/ledger", { token })
};

export const deliveriesApi = {
  available: (token: string) => apiFetch<DeliveryTask[]>("/api/v1/deliveries/available", { token }),
  mine: (token: string) => apiFetch<Delivery[]>("/api/v1/deliveries/me", { token }),
  accept: (token: string, transactionId: number, input: { expected_delivery_at?: string | null }) =>
    apiFetch<Delivery>(`/api/v1/deliveries/transactions/${transactionId}/accept`, { token, method: "POST", body: input }),
  action: (token: string, id: number, action: "pickup" | "delivered" | "failed") =>
    apiFetch<Delivery>(`/api/v1/deliveries/${id}/${action}`, { token, method: "POST" })
};

export const reviewsApi = {
  create: (token: string, input: { transaction_id: number; reviewee_user_id: number; rating_score: number; review_content?: string | null; review_type: ReviewType }) =>
    apiFetch<Review>("/api/v1/reviews", { token, method: "POST", body: input }),
  forUser: (token: string, userId: number) => apiFetch<Review[]>(`/api/v1/users/${userId}/reviews`, { token }),
  forBook: (token: string, bookId: number) => apiFetch<Review[]>(`/api/v1/books/${bookId}/reviews`, { token })
};

export const adminApi = {
  users: (token: string) => apiFetch<AdminUser[]>("/api/v1/admin/users", { token }),
  lock: (token: string, id: number) => apiFetch<AdminUser>(`/api/v1/admin/users/${id}/lock`, { token, method: "POST" }),
  unlock: (token: string, id: number) => apiFetch<AdminUser>(`/api/v1/admin/users/${id}/unlock`, { token, method: "POST" }),
  adjustPoints: (token: string, id: number, input: { point_change: number; reason: string }) =>
    apiFetch<unknown>(`/api/v1/admin/users/${id}/point-adjustments`, { token, method: "POST", body: input }),
  hideBook: (token: string, id: number) => apiFetch<AdminBook>(`/api/v1/admin/books/${id}/hide`, { token, method: "POST" }),
  restoreBook: (token: string, id: number) => apiFetch<AdminBook>(`/api/v1/admin/books/${id}/restore`, { token, method: "POST" }),
  cancelTransaction: (token: string, id: number) => apiFetch<unknown>(`/api/v1/admin/transactions/${id}/cancel`, { token, method: "POST" }),
  courierApplications: (token: string) => apiFetch<CourierProfile[]>("/api/v1/admin/courier-applications", { token }),
  reviewCourier: (token: string, id: number, decision: "approve" | "reject", review_note?: string) =>
    apiFetch<CourierProfile>(`/api/v1/admin/courier-applications/${id}/${decision}`, { token, method: "POST", body: { review_note } }),
  activityLogs: (token: string) => apiFetch<AdminLog[]>("/api/v1/admin/activity-logs", { token }),
  adminActions: (token: string) => apiFetch<AdminLog[]>("/api/v1/admin/admin-actions", { token })
};
