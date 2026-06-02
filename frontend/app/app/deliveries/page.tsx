"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Award,
  BookOpen,
  Check,
  Clock3,
  MapPin,
  Navigation,
  PackageCheck,
  PackageOpen,
  ShieldCheck,
  Star,
  Truck,
  X
} from "lucide-react";
import { authApi, booksApi, deliveriesApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import type { Book, Delivery, DeliveryTask, PublicUserSummary } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import {
  Alert,
  Badge,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  PageHeader,
  TextArea,
  TextInput
} from "@/components/ui";

export default function DeliveriesPage() {
  const { token, user, refreshUser } = useAuth();
  const [tasks, setTasks] = useState<DeliveryTask[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [books, setBooks] = useState<Record<number, Book>>({});
  const [usersById, setUsersById] = useState<Record<number, PublicUserSummary>>({});
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [registering, setRegistering] = useState(false);

  const profile = user?.courier_profile;
  const activeDelivery = deliveries.find((delivery) =>
    ["ASSIGNED", "PICKED_UP"].includes(delivery.delivery_status)
  );
  const selectedTask = tasks.find((task) => task.transaction_id === selectedTransactionId) ?? tasks[0];

  async function load() {
    if (!token || !profile) return;
    setError("");
    try {
      const mine = await deliveriesApi.mine(token);
      setDeliveries(mine);

      if (profile.courier_status === "AVAILABLE") {
        try {
          const available = await deliveriesApi.available(token);
          setTasks(available);
          setSelectedTransactionId((current) => current ?? available[0]?.transaction_id ?? null);
        } catch (err) {
          setTasks([]);
          setError(errorMessage(err));
        }
      } else {
        setTasks([]);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, [token, profile?.courier_status]);

  useEffect(() => {
    if (!token) return;
    const bookIds = new Set<number>();
    const userIds = new Set<number>();

    tasks.forEach((task) => {
      bookIds.add(task.book_id);
      userIds.add(task.owner_id);
      userIds.add(task.requester_id);
    });
    deliveries.forEach((delivery) => {
      if (delivery.book_id) bookIds.add(delivery.book_id);
      if (delivery.owner_id) userIds.add(delivery.owner_id);
      if (delivery.requester_id) userIds.add(delivery.requester_id);
    });

    const missingBookIds = Array.from(bookIds).filter((id) => !books[id]);
    const missingUserIds = Array.from(userIds).filter((id) => !usersById[id]);
    if (missingBookIds.length === 0 && missingUserIds.length === 0) return;

    let cancelled = false;
    Promise.all([
      Promise.all(missingBookIds.map((id) => booksApi.detail(token, id).then((book) => [id, book] as const))),
      Promise.all(missingUserIds.map((id) => authApi.summary(token, id).then((summary) => [id, summary] as const)))
    ])
      .then(([bookEntries, userEntries]) => {
        if (cancelled) return;
        if (bookEntries.length) setBooks((current) => ({ ...current, ...Object.fromEntries(bookEntries) }));
        if (userEntries.length) setUsersById((current) => ({ ...current, ...Object.fromEntries(userEntries) }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [token, tasks, deliveries, books, usersById]);

  async function registerCourier(form: HTMLFormElement) {
    if (!token) return;
    const data = new FormData(form);
    try {
      setRegistering(true);
      setError("");
      await authApi.registerCourier(token, {
        delivery_area: String(data.get("delivery_area") ?? ""),
        contact_name: String(data.get("contact_name") ?? "") || null,
        contact_phone: String(data.get("contact_phone") ?? "") || null,
        contact_address: String(data.get("contact_address") ?? "") || null,
        vehicle_type: String(data.get("vehicle_type") ?? "") || null,
        document_url: String(data.get("document_url") ?? "") || null,
        application_note: String(data.get("application_note") ?? "") || null
      });
      await refreshUser();
      setNotice("Đã gửi hồ sơ giao sách. Admin sẽ duyệt trước khi bạn nhận nhiệm vụ.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRegistering(false);
    }
  }

  async function acceptTask(form: HTMLFormElement, transactionId: number) {
    if (!token) return;
    const data = new FormData(form);
    try {
      setError("");
      setNotice("");
      await deliveriesApi.accept(token, transactionId, {
        expected_delivery_at: String(data.get("expected_delivery_at") || "") || null
      });
      await Promise.all([load(), refreshUser()]);
      setNotice("Đã nhận nhiệm vụ giao sách.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function runDeliveryAction(id: number, action: "pickup" | "delivered" | "failed") {
    if (!token) return;
    try {
      setError("");
      setNotice("");
      await deliveriesApi.action(token, id, action);
      await Promise.all([load(), refreshUser()]);
      setNotice(action === "delivered" ? "Đã giao thành công và cộng +2 LibriPoint." : "Đã cập nhật vận đơn.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  if (!profile) {
    return (
      <>
        <PageHeader
          title="Trung tâm giao sách"
          description="Đăng ký làm người giao sách để nhận nhiệm vụ từ các giao dịch dùng dịch vụ giao sách."
        />
        <CourierRegistration
          error={error}
          notice={notice}
          loading={registering}
          onSubmit={onSubmit}
          onRegister={registerCourier}
        />
      </>
    );
  }

  const completedDeliveries = deliveries.filter((delivery) => delivery.delivery_status === "DELIVERED");
  const failedDeliveries = deliveries.filter((delivery) => delivery.delivery_status === "FAILED");

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-start justify-between gap-4 max-md:flex-col">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Trung tâm giao sách</h1>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">
            Nhận nhiệm vụ, theo dõi vận đơn và cập nhật trạng thái giao sách.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 max-md:justify-start">
          <CourierStatusBadge status={profile.courier_status} />
          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm">
            <MapPin className="h-4 w-4 text-blue-700" />
            {profile.delivery_area}
          </span>
        </div>
      </div>

      {error ? <div className="mb-4"><Alert variant="error">{error}</Alert></div> : null}
      {notice ? <div className="mb-4"><Alert variant="success">{notice}</Alert></div> : null}

      {profile.courier_status === "PENDING" || profile.courier_status === "INACTIVE" ? (
        <CourierReviewState status={profile.courier_status} note={profile.review_note} area={profile.delivery_area} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <MetricCard icon={PackageCheck} label="Vận đơn hoàn thành" value={completedDeliveries.length} helper="Tổng đã giao" />
            <MetricCard icon={Star} label="Điểm thưởng" value={`+${completedDeliveries.length * 2}`} helper="Cộng ngay khi giao thành công" />
            <MetricCard icon={Award} label="Tỷ lệ thành công" value={`${successRate(deliveries)}%`} helper={`${failedDeliveries.length} thất bại`} />
            <MetricCard icon={Clock3} label="Đang xử lý" value={activeDelivery ? 1 : 0} helper="Vận đơn hiện tại" />
          </div>

          <div className="grid grid-cols-2 items-start gap-5 max-xl:grid-cols-1">
            <section className="min-w-0">
              <div className="mb-3 min-h-[56px]">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Nhiệm vụ khả dụng ({tasks.length})</h2>
                  <p className="text-sm text-slate-500">Chọn nhiệm vụ phù hợp với lộ trình của bạn.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {profile.courier_status === "BUSY" ? (
                  <EmptyState title="Bạn đang có vận đơn">
                    Hoàn tất hoặc đánh dấu thất bại vận đơn hiện tại trước khi nhận nhiệm vụ mới.
                  </EmptyState>
                ) : null}
                {profile.courier_status === "AVAILABLE" && tasks.length === 0 ? (
                  <DeliveryEmptyState
                    title="Chưa có nhiệm vụ khả dụng"
                    description="Khi chủ sách chấp nhận giao dịch dùng dịch vụ giao sách, nhiệm vụ sẽ xuất hiện tại đây."
                  />
                ) : null}
                {tasks.map((task) => (
                  <TaskCard
                    key={task.transaction_id}
                    task={task}
                    book={books[task.book_id]}
                    ownerName={usersById[task.owner_id]?.full_name}
                    requesterName={usersById[task.requester_id]?.full_name}
                    selected={selectedTask?.transaction_id === task.transaction_id && !activeDelivery}
                    onSelect={() => setSelectedTransactionId(task.transaction_id)}
                  />
                ))}
              </div>
            </section>

            <section className="min-w-0">
              <div className="mb-3 min-h-[56px]">
                <h2 className="text-lg font-bold text-slate-950">
                  {activeDelivery ? "Vận đơn đang thực hiện" : "Chi tiết nhiệm vụ"}
                </h2>
                <p className="text-sm text-slate-500">
                  {activeDelivery ? "Cập nhật tiến độ vận đơn hiện tại." : "Xem tuyến giao và thời gian dự kiến."}
                </p>
              </div>
              {activeDelivery ? (
                <ActiveDeliveryPanel
                  delivery={activeDelivery}
                  book={activeDelivery.book_id ? books[activeDelivery.book_id] : undefined}
                  ownerName={activeDelivery.owner_id ? usersById[activeDelivery.owner_id]?.full_name : undefined}
                  requesterName={activeDelivery.requester_id ? usersById[activeDelivery.requester_id]?.full_name : undefined}
                  onAction={runDeliveryAction}
                />
              ) : selectedTask ? (
                <AcceptTaskPanel
                  task={selectedTask}
                  book={books[selectedTask.book_id]}
                  ownerName={usersById[selectedTask.owner_id]?.full_name}
                  requesterName={usersById[selectedTask.requester_id]?.full_name}
                  onSubmit={onSubmit}
                  onAccept={acceptTask}
                />
              ) : (
                <DeliveryEmptyState
                  title="Chọn một nhiệm vụ"
                  description="Bấm vào một nhiệm vụ khả dụng để xem tuyến giao và nhập thời gian dự kiến."
                />
              )}
            </section>
          </div>

          <DeliveryHistorySection
            deliveries={completedDeliveries}
            books={books}
            usersById={usersById}
          />
        </>
      )}
    </div>
  );
}

function CourierRegistration({
  error,
  notice,
  loading,
  onSubmit,
  onRegister
}: {
  error: string;
  notice: string;
  loading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRegister: (form: HTMLFormElement) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 max-lg:grid-cols-1">
      <Card>
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-950">Đăng ký người giao sách</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Hồ sơ mới sẽ chờ admin duyệt. Sau khi được duyệt, bạn mới có thể xem và nhận nhiệm vụ.
          </p>
        </div>
        <form id="courier-form" className="grid grid-cols-2 gap-4 max-md:grid-cols-1" onSubmit={onSubmit}>
          {error ? <div className="col-span-2 max-md:col-span-1"><Alert variant="error">{error}</Alert></div> : null}
          {notice ? <div className="col-span-2 max-md:col-span-1"><Alert variant="success">{notice}</Alert></div> : null}
          <Field label="Khu vực giao">
            <TextInput name="delivery_area" placeholder="Ví dụ: Cầu Giấy, Hà Nội" required />
          </Field>
          <Field label="Loại phương tiện">
            <TextInput name="vehicle_type" placeholder="Xe máy, xe đạp..." />
          </Field>
          <Field label="Tên liên hệ">
            <TextInput name="contact_name" />
          </Field>
          <Field label="Điện thoại liên hệ">
            <TextInput name="contact_phone" />
          </Field>
          <Field label="Địa chỉ liên hệ" className="col-span-2 max-md:col-span-1">
            <TextInput name="contact_address" />
          </Field>
          <Field label="URL giấy tờ" className="col-span-2 max-md:col-span-1">
            <TextInput name="document_url" placeholder="Liên kết ảnh giấy tờ nếu có" />
          </Field>
          <Field label="Ghi chú" className="col-span-2 max-md:col-span-1">
            <TextArea name="application_note" placeholder="Khu vực quen thuộc, thời gian có thể giao..." />
          </Field>
          <div className="col-span-2 flex justify-end max-md:col-span-1">
            <ConfirmButton
              loading={loading}
              confirm="Bạn có muốn gửi hồ sơ đăng ký giao sách không?"
              onConfirm={() => {
                const form = document.getElementById("courier-form") as HTMLFormElement | null;
                if (form?.reportValidity()) void onRegister(form);
              }}
            >
              Gửi hồ sơ
            </ConfirmButton>
          </div>
        </form>
      </Card>
      <Card className="bg-blue-50">
        <ShieldCheck className="h-8 w-8 text-blue-700" />
        <h2 className="mt-4 text-lg font-bold text-slate-950">Quy tắc nhận nhiệm vụ</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
          <li>Chỉ courier đã được duyệt mới nhận nhiệm vụ.</li>
          <li>Mỗi courier chỉ xử lý một vận đơn tại một thời điểm.</li>
          <li>Giao thành công được cộng 2 LibriPoint.</li>
          <li>Giao thất bại sẽ hủy giao dịch liên quan.</li>
        </ul>
      </Card>
    </div>
  );
}

function CourierReviewState({ status, note, area }: { status: string; note: string | null; area: string }) {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <div className="flex items-start justify-between gap-4 max-sm:flex-col">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            {status === "PENDING" ? "Hồ sơ đang chờ admin duyệt" : "Hồ sơ giao sách chưa hoạt động"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Khu vực đăng ký: {area}</p>
          {note ? <p className="mt-2 text-sm leading-6 text-slate-600">Ghi chú admin: {note}</p> : null}
        </div>
        <Badge value={status} />
      </div>
    </Card>
  );
}

function TaskCard({
  task,
  book,
  ownerName,
  requesterName,
  selected,
  onSelect
}: {
  task: DeliveryTask;
  book?: Book;
  ownerName?: string;
  requesterName?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border bg-white p-4 text-left shadow-[0_8px_26px_rgba(15,23,42,0.05)] transition-all hover:border-blue-200 hover:bg-blue-50/30",
        selected && "border-blue-600 bg-blue-50 shadow-[0_0_0_3px_rgba(37,99,235,0.10)]"
      )}
    >
      <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4 max-sm:grid-cols-[48px_minmax(0,1fr)]">
        <BookThumb book={book} />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-950">{book?.title ?? `Sách #${task.book_id}`}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Lấy từ {ownerName ?? `người dùng #${task.owner_id}`} · giao cho {requesterName ?? `người dùng #${task.requester_id}`}
          </p>
          <p className="truncate text-xs leading-5 text-slate-400">
            {task.pickup_address ?? "Chưa có điểm lấy"} → {task.receiver_address}
          </p>
          <p className="text-xs leading-5 text-slate-400">Yêu cầu {formatDate(task.requested_at)}</p>
        </div>
        <span className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 max-sm:col-span-2 max-sm:w-fit">
          +2 điểm
        </span>
      </div>
    </button>
  );
}

function AcceptTaskPanel({
  task,
  book,
  ownerName,
  requesterName,
  onSubmit,
  onAccept
}: {
  task: DeliveryTask;
  book?: Book;
  ownerName?: string;
  requesterName?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAccept: (form: HTMLFormElement, transactionId: number) => Promise<void>;
}) {
  const formId = `accept-${task.transaction_id}`;
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-amber-500 px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">Nhiệm vụ #{task.transaction_id}</h3>
          <span className="text-xs font-semibold text-amber-50">+2 LibriPoint</span>
        </div>
      </div>
      <div className="p-5">
        <div className="flex gap-3 rounded-2xl bg-slate-50 p-3">
          <BookThumb book={book} />
          <div>
            <h4 className="text-sm font-bold text-slate-950">{book?.title ?? `Sách #${task.book_id}`}</h4>
            <p className="mt-1 text-xs text-slate-500">Từ {ownerName ?? "-"} đến {requesterName ?? "-"}</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
          <h4 className="text-sm font-bold text-slate-950">Tuyến giao đã chốt</h4>
          <div className="mt-3 space-y-3">
            <RoutePoint active label="Điểm lấy" value={task.pickup_address ?? "Chưa có điểm lấy"} helper={ownerName ?? "-"} />
            <RoutePoint active={false} label="Điểm giao" value={task.receiver_address} helper={requesterName ?? "-"} />
          </div>
        </div>

        <form id={formId} className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <Field label="Dự kiến giao">
            <TextInput name="expected_delivery_at" type="datetime-local" />
          </Field>
          <ConfirmButton
            confirm="Bạn có muốn nhận nhiệm vụ giao sách này không?"
            onConfirm={() => {
              const form = document.getElementById(formId) as HTMLFormElement | null;
              if (form?.reportValidity()) void onAccept(form, task.transaction_id);
            }}
          >
            <Check className="h-4 w-4" />
            Nhận nhiệm vụ
          </ConfirmButton>
        </form>
      </div>
    </Card>
  );
}

function ActiveDeliveryPanel({
  delivery,
  book,
  ownerName,
  requesterName,
  onAction
}: {
  delivery: Delivery;
  book?: Book;
  ownerName?: string;
  requesterName?: string;
  onAction: (id: number, action: "pickup" | "delivered" | "failed") => Promise<void>;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-amber-500 px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">Đang giao - Vận đơn #{delivery.delivery_id}</h3>
          <span className="text-xs font-semibold text-amber-50">Cập nhật {formatDate(delivery.assigned_at)}</span>
        </div>
      </div>
      <div className="p-5">
        <div className="mb-5">
          <h4 className="text-sm font-bold text-slate-950">Lộ trình giao</h4>
          <div className="mt-3 space-y-3">
            <RoutePoint active label="Điểm lấy" value={delivery.pickup_address} helper={ownerName ?? "-"} />
            <RoutePoint
              active={delivery.delivery_status === "PICKED_UP"}
              label="Điểm giao"
              value={delivery.receiver_address}
              helper={requesterName ?? "-"}
            />
          </div>
        </div>

        <div className="mb-5 rounded-2xl bg-slate-50 p-3">
          <div className="flex items-start gap-3">
            <BookThumb book={book} />
            <div>
              <h4 className="text-sm font-bold text-slate-950">{book?.title ?? `Giao dịch #${delivery.transaction_id}`}</h4>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Giao cho {requesterName ?? "-"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge value={delivery.delivery_status} />
                {delivery.expected_delivery_at ? <Badge value={`Dự kiến ${formatDate(delivery.expected_delivery_at)}`} /> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {delivery.delivery_status === "ASSIGNED" ? (
            <ConfirmButton confirm="Bạn xác nhận đã lấy sách?" onConfirm={() => onAction(delivery.delivery_id, "pickup")}>
              <PackageOpen className="h-4 w-4" />
              Đã lấy sách
            </ConfirmButton>
          ) : null}
          {delivery.delivery_status === "PICKED_UP" ? (
            <ConfirmButton confirm="Bạn xác nhận đã giao sách thành công?" onConfirm={() => onAction(delivery.delivery_id, "delivered")}>
              <PackageCheck className="h-4 w-4" />
              Giao thành công
            </ConfirmButton>
          ) : null}
          {["ASSIGNED", "PICKED_UP"].includes(delivery.delivery_status) ? (
            <ConfirmButton variant="danger" confirm="Đánh dấu vận đơn này giao thất bại?" onConfirm={() => onAction(delivery.delivery_id, "failed")}>
              <X className="h-4 w-4" />
              Giao thất bại
            </ConfirmButton>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function DeliveryHistorySection({
  deliveries,
  books,
  usersById
}: {
  deliveries: Delivery[];
  books: Record<number, Book>;
  usersById: Record<number, PublicUserSummary>;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3 max-sm:flex-col max-sm:items-start">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Đã giao thành công ({deliveries.length})</h2>
          <p className="text-sm text-slate-500">
            Courier được cộng +2 LibriPoint ngay khi vận đơn chuyển sang đã giao.
          </p>
        </div>
      </div>

      {deliveries.length === 0 ? (
        <DeliveryEmptyState
          title="Chưa có vận đơn hoàn thành"
          description="Các đơn bạn đã giao thành công sẽ được lưu tại đây kèm điểm thưởng đã cộng."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
          {deliveries.map((delivery) => (
            <DeliveryHistoryCard
              key={delivery.delivery_id}
              delivery={delivery}
              book={delivery.book_id ? books[delivery.book_id] : undefined}
              ownerName={delivery.owner_id ? usersById[delivery.owner_id]?.full_name : undefined}
              requesterName={delivery.requester_id ? usersById[delivery.requester_id]?.full_name : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DeliveryHistoryCard({
  delivery,
  book,
  ownerName,
  requesterName
}: {
  delivery: Delivery;
  book?: Book;
  ownerName?: string;
  requesterName?: string;
}) {
  return (
    <Card className="rounded-xl p-4 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
      <div className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-start gap-3 max-sm:grid-cols-[48px_minmax(0,1fr)]">
        <BookThumb book={book} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold text-slate-950">
              {book?.title ?? `Giao dịch #${delivery.transaction_id}`}
            </h3>
            <Badge value={delivery.delivery_status} />
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Lấy từ {ownerName ?? "-"} · giao cho {requesterName ?? "-"}
          </p>
          <p className="truncate text-xs leading-5 text-slate-400">
            {delivery.pickup_address ?? "Điểm lấy"} → {delivery.receiver_address}
          </p>
          <p className="text-xs leading-5 text-slate-400">
            Hoàn thành {formatDate(delivery.delivered_at)}
          </p>
        </div>
        <span className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 max-sm:col-span-2 max-sm:w-fit">
          +2 đã cộng
        </span>
      </div>
    </Card>
  );
}

function MetricCard({ icon: Icon, label, value, helper }: { icon: typeof Truck; label: string; value: string | number; helper: string }) {
  return (
    <Card className="rounded-xl p-4 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-bold text-slate-950">{value}</div>
          <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
          <p className="truncate text-[11px] text-slate-400">{helper}</p>
        </div>
      </div>
    </Card>
  );
}

function CourierStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs font-bold",
      status === "AVAILABLE" ? "bg-emerald-50 text-emerald-700" : status === "BUSY" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
    )}>
      <span className={cn("h-2 w-2 rounded-full", status === "AVAILABLE" ? "bg-emerald-500" : status === "BUSY" ? "bg-amber-500" : "bg-slate-400")} />
      {status === "AVAILABLE" ? "Sẵn sàng nhận nhiệm vụ" : status === "BUSY" ? "Đang giao sách" : "Tạm nghỉ"}
    </span>
  );
}

function DeliveryEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-8 text-center shadow-sm">
      <div>
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Navigation className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-bold text-slate-950">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function BookThumb({ book }: { book?: Book }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-blue-700">
      {book?.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.cover_image_url} alt={book.title} className="h-full w-full object-cover" />
      ) : (
        <BookOpen className="h-5 w-5" />
      )}
    </div>
  );
}

function RoutePoint({ active, label, value, helper }: { active: boolean; label: string; value: string | null; helper: string }) {
  return (
    <div className="flex gap-3">
      <div className={cn("mt-1 h-3 w-3 rounded-full", active ? "bg-emerald-500" : "bg-slate-300")} />
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="text-sm font-bold text-slate-950">{value ?? "Chưa có điểm giao"}</p>
        <p className="text-xs text-slate-500">{helper}</p>
      </div>
    </div>
  );
}

function successRate(deliveries: Delivery[]) {
  const terminal = deliveries.filter((delivery) => ["DELIVERED", "FAILED"].includes(delivery.delivery_status));
  if (terminal.length === 0) return 0;
  return Math.round((terminal.filter((delivery) => delivery.delivery_status === "DELIVERED").length / terminal.length) * 100);
}
