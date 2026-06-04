export type AccountStatus = "PENDING" | "ACTIVE" | "LOCKED" | "INACTIVE";
export type UserRole = "USER" | "MEMBER" | "COURIER" | "ADMIN";
export type MembershipStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "INACTIVE";
export type CourierStatus = "PENDING" | "AVAILABLE" | "BUSY" | "SUSPENDED" | "INACTIVE";
export type BookCondition = "NEW" | "GOOD" | "FAIR" | "WORN";
export type ExchangeMode = "PERMANENT_EXCHANGE" | "BORROW_RETURN" | "BOTH";
export type BookStatus =
  | "AVAILABLE"
  | "PENDING_TRANSACTION"
  | "BORROWED"
  | "EXCHANGED"
  | "UNLISTED"
  | "REMOVED";
export type TransactionType = "PERMANENT_EXCHANGE" | "BORROW_RETURN";
export type DeliveryMethod = "DIRECT_CONTACT" | "FREE_COURIER";
export type TransactionStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DELIVERING"
  | "BORROWING"
  | "RETURN_PENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";
export type DeliveryStatus = "PENDING" | "ASSIGNED" | "PICKED_UP" | "DELIVERED" | "FAILED" | "CANCELLED";
export type ReviewType = "OWNER_REVIEW" | "REQUESTER_REVIEW" | "COURIER_REVIEW";

export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type RegisterInput = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  student_code: string;
  address: string;
};

export type LoginInput = {
  login: string;
  password: string;
};

export type MemberProfile = {
  member_id: number;
  user_id: number;
  student_code: string;
  address: string;
  membership_status: MembershipStatus;
  registered_at: string;
};

export type CourierProfile = {
  courier_id: number;
  user_id: number;
  delivery_area: string;
  courier_status: CourierStatus;
  successful_delivery_count: number;
  contact_name: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  vehicle_type: string | null;
  document_url: string | null;
  application_note: string | null;
  reviewed_by_admin_id: number | null;
  reviewed_at: string | null;
  review_note: string | null;
  registered_at: string;
};

export type User = {
  user_id: number;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  current_points: number;
  account_status: AccountStatus;
  created_at: string;
  updated_at: string;
  member_profile: MemberProfile | null;
  courier_profile: CourierProfile | null;
};

export type PublicUserSummary = {
  user_id: number;
  full_name: string;
  role: UserRole;
  current_points: number;
  account_status: AccountStatus;
  membership_status: MembershipStatus | null;
  courier_status: CourierStatus | null;
  joined_at: string;
};

export type UserNotification = {
  activity_id: number;
  activity_type: string;
  activity_description: string;
  created_at: string;
};

export type RegisterResponse = {
  user: User;
  access_token: string;
  token_type: string;
};

export type Category = {
  category_id: number;
  category_name: string;
  category_description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CategorySummary = {
  category_id: number;
  category_name: string;
  category_description: string | null;
  book_count: number;
};

export type Book = {
  book_id: number;
  owner_id: number;
  owner_full_name: string | null;
  category_id: number;
  title: string;
  author: string;
  book_description: string | null;
  publication_year: number | null;
  book_condition: BookCondition;
  exchange_mode: ExchangeMode;
  book_status: BookStatus;
  created_at: string;
  updated_at: string;
  cover_image_url: string | null;
  category: Category | null;
};

export type BookInput = {
  category_id: number;
  title: string;
  author: string;
  book_description?: string | null;
  publication_year?: number | null;
  book_condition: BookCondition;
  exchange_mode: ExchangeMode;
  cover_image_url?: string | null;
};

export type Transaction = {
  transaction_id: number;
  book_id: number;
  book_title: string | null;
  book_author: string | null;
  owner_id: number;
  owner_full_name: string | null;
  requester_id: number;
  requester_full_name: string | null;
  pickup_address: string | null;
  receiver_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  receiver_lat: number | null;
  receiver_lng: number | null;
  transaction_type: TransactionType;
  delivery_method: DeliveryMethod;
  transaction_status: TransactionStatus;
  owner_confirmed: boolean;
  requester_confirmed: boolean;
  courier_confirmed: boolean;
  borrow_duration_days: number | null;
  expected_return_at: string | null;
  borrowed_at: string | null;
  return_requested_at: string | null;
  returned_at: string | null;
  late_days: number;
  late_fee_points: number;
  requested_at: string;
  completed_at: string | null;
};

export type PointBalance = { current_points: number };
export type PointLedger = {
  ledger_id: number;
  transaction_id: number | null;
  user_id: number;
  role_in_transaction: string;
  points_before: number;
  point_change: number;
  points_after: number;
  reason: string;
  created_at: string;
};

export type DeliveryTask = {
  transaction_id: number;
  book_id: number;
  owner_id: number;
  requester_id: number;
  pickup_address: string | null;
  receiver_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  receiver_lat: number | null;
  receiver_lng: number | null;
  requested_at: string;
};

export type Delivery = {
  delivery_id: number;
  transaction_id: number;
  book_id: number | null;
  owner_id: number | null;
  requester_id: number | null;
  courier_id: number | null;
  pickup_address: string | null;
  receiver_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  receiver_lat: number | null;
  receiver_lng: number | null;
  delivery_status: DeliveryStatus;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  expected_delivery_at: string | null;
};

export type Review = {
  review_id: number;
  transaction_id: number;
  reviewer_user_id: number;
  reviewer_full_name: string | null;
  reviewee_user_id: number;
  reviewee_full_name: string | null;
  book_title: string | null;
  book_author: string | null;
  rating_score: number;
  review_content: string | null;
  review_type: ReviewType;
  created_at: string;
};

export type AdminUser = Pick<
  User,
  "user_id" | "full_name" | "email" | "phone" | "role" | "current_points" | "account_status" | "created_at" | "updated_at"
>;

export type AdminBook = Pick<
  Book,
  "book_id" | "owner_id" | "category_id" | "title" | "author" | "book_status" | "cover_image_url" | "created_at" | "updated_at"
>;

export type AdminTransaction = Pick<
  Transaction,
  | "transaction_id"
  | "book_id"
  | "book_title"
  | "book_author"
  | "owner_id"
  | "owner_full_name"
  | "requester_id"
  | "requester_full_name"
  | "transaction_type"
  | "delivery_method"
  | "transaction_status"
  | "owner_confirmed"
  | "requester_confirmed"
  | "courier_confirmed"
  | "requested_at"
  | "completed_at"
>;

export type AdminDashboardMetricPoint = {
  date: string;
  total_users: number;
  transactions_created: number;
};

export type AdminDashboardMetrics = {
  total_users: number;
  pending_courier_applications: number;
  activity_log_count: number;
  admin_action_count: number;
  chart: AdminDashboardMetricPoint[];
};

export type AdminPointAdjustmentResponse = {
  ledger_id: number;
  user_id: number;
  points_before: number;
  point_change: number;
  points_after: number;
  role_in_transaction: string;
  reason: string;
  admin_action_id: number;
};

export type AdminLog = {
  activity_id?: number;
  admin_action_id?: number;
  user_id?: number;
  admin_id?: number;
  target_user_id?: number | null;
  activity_type?: string;
  action_type?: string;
  activity_description?: string;
  action_description?: string;
  created_at: string;
};

export type TopBook = {
  book_id: number;
  title: string;
  author: string;
  cover_image_url: string | null;
  category_name: string | null;
  borrow_count: number;
};

export type TopCourier = {
  courier_id: number;
  user_id: number;
  full_name: string;
  delivery_area: string;
  courier_status: CourierStatus;
  successful_delivery_count: number;
};

export type TopPointUser = {
  user_id: number;
  full_name: string;
  current_points: number;
};

export type CommunityLeaderboard = {
  top_books: TopBook[];
  top_couriers: TopCourier[];
  top_point_users: TopPointUser[];
};
