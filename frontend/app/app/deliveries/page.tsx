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
import { DELIVERY_LOCATIONS } from "@/lib/delivery-locations";
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
          hero
          heroIcon={<Truck className="h-3.5 w-3.5" />}
          title="Trung tâm giao sách"
          description="Đăng ký làm người giao sách để nhận nhiệm vụ từ các giao dịch dùng dịch vụ giao sách miễn phí."
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
    <>
      <PageHeader
        hero
        heroIcon={<Truck className="h-3.5 w-3.5" />}
        title="Trung tâm giao sách"
        description="Chọn đơn phù hợp với lộ trình, xác nhận khi đã lấy sách và cập nhật ngay khi giao tới người nhận."
        heroStat={
          <>
            <p className="text-sm font-medium text-blue-200">Khu vực giao</p>
            <div className="mt-1 text-lg font-bold text-white truncate">{profile.delivery_area}</div>
            <div className="mt-3">
              <CourierStatusBadge status={profile.courier_status} />
            </div>
          </>
        }
      />
      {error ? <div className="mb-4"><Alert variant="error">{error}</Alert></div> : null}
      {notice ? <div className="mb-4"><Alert variant="success">{notice}</Alert></div> : null}

      {profile.courier_status === "PENDING" || profile.courier_status === "INACTIVE" ? (
        <div className="mb-8">
          <CourierReviewState status={profile.courier_status} note={profile.review_note} area={profile.delivery_area} />
        </div>
      ) : null}

      <section className="mb-8 grid grid-cols-4 gap-4 max-lg:grid-cols-2">
        <MetricCard icon={PackageCheck} label="Đã giao" value={completedDeliveries.length} helper="Thành công" tone="blue" />
        <MetricCard icon={Star} label="Điểm nhận" value={`+${completedDeliveries.length * 2}`} helper="Từ vận đơn" tone="amber" />
        <MetricCard icon={Award} label="Tỷ lệ" value={`${successRate(deliveries)}%`} helper="Thành công" tone="emerald" />
        <MetricCard icon={Clock3} label="Đang xử lý" value={activeDelivery ? 1 : 0} helper={activeDelivery ? "Đang giao" : "Hiện rảnh"} tone="violet" />
      </section>

      {profile.courier_status === "PENDING" || profile.courier_status === "INACTIVE" ? null : (
        <>
          <div className="grid grid-cols-2 items-start gap-5 max-xl:grid-cols-1">
            <section className="min-w-0">
              <div className="mb-3 min-h-[56px]">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Đơn có thể nhận ({tasks.length})</h2>
                  <p className="text-base text-slate-500">Ưu tiên đơn gần tuyến bạn sẽ đi để giao nhanh và đúng hẹn.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {profile.courier_status === "BUSY" ? (
                  <EmptyState title="Bạn đang trong chuyến giao sách">
                    Hãy hoàn tất việc giao sách hiện tại trước khi nhận thêm đơn mới nhé.
                  </EmptyState>
                ) : null}
                {profile.courier_status === "AVAILABLE" && tasks.length === 0 ? (
                  <DeliveryEmptyState
                    title="Hiện chưa có đơn giao mới"
                    description="Khi có người dùng cần gửi sách trong khu vực của bạn, đơn giao sẽ tự động xuất hiện tại đây."
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
                <h2 className="text-lg font-semibold text-slate-950">
                  {activeDelivery ? "Đơn đang giao" : "Chi tiết đơn giao"}
                </h2>
                <p className="text-base text-slate-500">
                  {activeDelivery ? "Cập nhật đúng từng bước để người mượn và chủ sách cùng theo dõi được." : "Xem tuyến lấy sách, điểm giao và xác nhận thời gian bạn dự kiến hoàn tất."}
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
                  description="Bấm vào một đơn ở bên trái để kiểm tra tuyến đường trước khi nhận."
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
    </>
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
  const [selectedAreaIds, setSelectedAreaIds] = useState(() => DELIVERY_LOCATIONS.map((location) => location.id));
  const selectedAreaLabels = DELIVERY_LOCATIONS
    .filter((location) => selectedAreaIds.includes(location.id))
    .map((location) => location.label);

  function toggleArea(id: string) {
    setSelectedAreaIds((current) => {
      if (current.includes(id)) {
        return current.length === 1 ? current : current.filter((item) => item !== id);
      }
      return [...current, id];
    });
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 max-lg:grid-cols-1">
      <Card>
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-950">Đăng ký người giao sách</h2>
          <p className="mt-1 text-base leading-6 text-slate-500">
            Hồ sơ mới sẽ chờ admin duyệt. Sau khi được duyệt, bạn mới có thể xem và nhận nhiệm vụ.
          </p>
        </div>
        <form id="courier-form" className="grid grid-cols-2 gap-4 max-md:grid-cols-1" onSubmit={onSubmit}>
          {error ? <div className="col-span-2 max-md:col-span-1"><Alert variant="error">{error}</Alert></div> : null}
          {notice ? <div className="col-span-2 max-md:col-span-1"><Alert variant="success">{notice}</Alert></div> : null}
          <Field label="Khu vực giao" className="col-span-2 max-md:col-span-1">
            <input type="hidden" name="delivery_area" value={selectedAreaLabels.join(", ")} />
            <div className="mt-2 grid grid-cols-2 gap-2 max-sm:grid-cols-1">
              {DELIVERY_LOCATIONS.map((location) => {
                const checked = selectedAreaIds.includes(location.id);
                return (
                  <label
                    key={location.id}
                    className={cn(
                      "flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border bg-white px-3 py-3 transition-all",
                      checked
                        ? "border-blue-500 bg-blue-50 shadow-[0_0_0_3px_rgba(59,130,246,0.10)]"
                        : "border-slate-200 hover:border-blue-200 hover:bg-slate-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleArea(location.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                    />
                    <span className="min-w-0">
                      <span className="block text-base font-semibold text-slate-900">{location.label}</span>
                      <span className="block text-sm leading-5 text-slate-500">{location.address}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-500">
              Nhiệm vụ chỉ hiện khi cả điểm lấy và điểm giao đều nằm trong khu vực bạn đã chọn.
            </p>
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
        <h2 className="mt-4 text-lg font-semibold text-slate-950">Quy tắc nhận nhiệm vụ</h2>
        <ul className="mt-3 space-y-2 text-base leading-6 text-slate-600">
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
    <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-sm">
      <div className="flex items-start justify-between gap-4 max-sm:flex-col">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {status === "PENDING" ? "Hồ sơ đang chờ admin duyệt" : "Hồ sơ giao sách chưa hoạt động"}
          </h2>
          <p className="mt-2 text-base font-medium text-slate-600">
            <MapPin className="mb-0.5 mr-1.5 inline-block h-4 w-4 text-blue-500" />
            Khu vực đăng ký: <strong className="text-slate-800">{area}</strong>
          </p>
          {note ? <p className="mt-2 text-sm text-slate-500">Ghi chú admin: {note}</p> : null}
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
        "w-full overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md",
        selected
          ? "border-blue-500 bg-blue-50/30 ring-1 ring-blue-500"
          : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
      )}
    >
      <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4 max-sm:grid-cols-[48px_minmax(0,1fr)]">
        <BookThumb book={book} />
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-slate-900">{book?.title ?? `Sách #${task.book_id}`}</h3>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Nhận từ <span className="font-semibold text-slate-800">{ownerName ?? `người dùng #${task.owner_id}`}</span> · giao cho <span className="font-semibold text-slate-800">{requesterName ?? `người dùng #${task.requester_id}`}</span>
          </p>
          <div className="mt-2 flex items-center gap-2 truncate text-sm font-medium text-slate-500">
            <MapPin className="h-3.5 w-3.5 text-blue-500" />
            <span className="truncate">{task.pickup_address ?? "Chưa có điểm lấy"} → {task.receiver_address}</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-400">Đơn tạo lúc {formatDate(task.requested_at)}</p>
        </div>
        <span className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700 max-sm:col-span-2 max-sm:w-fit">
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
      <div className="bg-slate-950 px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Đơn giao #{task.transaction_id}</h3>
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-semibold text-emerald-100">+2 LibriPoint khi giao xong</span>
        </div>
      </div>
      <div className="p-5">
        <div className="flex gap-3 rounded-2xl bg-slate-50 p-3">
          <BookThumb book={book} />
          <div>
            <h4 className="text-base font-semibold text-slate-950">{book?.title ?? `Sách #${task.book_id}`}</h4>
            <p className="mt-1 text-sm text-slate-500">Nhận từ {ownerName ?? "-"} và giao cho {requesterName ?? "-"}</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
          <h4 className="text-base font-semibold text-slate-950">Tuyến giao cần thực hiện</h4>
          <div className="mt-3 space-y-3">
            <RoutePoint active label="Điểm lấy" value={task.pickup_address ?? "Chưa có điểm lấy"} helper={ownerName ?? "-"} />
            <RoutePoint active={false} label="Điểm giao" value={task.receiver_address} helper={requesterName ?? "-"} />
          </div>
        </div>

        <form id={formId} className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <Field label="Bạn dự kiến giao xong lúc">
            <TextInput name="expected_delivery_at" type="datetime-local" />
          </Field>
          <ConfirmButton
            confirm="Bạn chắc chắn muốn nhận đơn giao sách này chứ?"
            onConfirm={() => {
              const form = document.getElementById(formId) as HTMLFormElement | null;
              if (form?.reportValidity()) void onAccept(form, task.transaction_id);
            }}
          >
            <Check className="h-4 w-4" />
            Nhận đơn giao này
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
      <div className="bg-slate-950 px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Đơn đang giao #{delivery.delivery_id}</h3>
          <span className="text-sm font-semibold text-slate-300">Nhận lúc {formatDate(delivery.assigned_at)}</span>
        </div>
      </div>
      <div className="p-5">
        <div className="mb-5">
          <h4 className="text-base font-semibold text-slate-950">Bạn đang ở bước nào?</h4>
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
              <h4 className="text-base font-semibold text-slate-950">{book?.title ?? `Giao dịch #${delivery.transaction_id}`}</h4>
              <p className="mt-1 text-sm leading-5 text-slate-500">
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
            <ConfirmButton confirm="Bạn xác nhận đã nhận sách từ chủ sách chưa?" onConfirm={() => onAction(delivery.delivery_id, "pickup")}>
              <PackageOpen className="h-4 w-4" />
              Tôi đã lấy sách
            </ConfirmButton>
          ) : null}
          {delivery.delivery_status === "PICKED_UP" ? (
            <ConfirmButton confirm="Bạn xác nhận đã giao sách tới người nhận chưa?" onConfirm={() => onAction(delivery.delivery_id, "delivered")}>
              <PackageCheck className="h-4 w-4" />
              Tôi đã giao xong
            </ConfirmButton>
          ) : null}
          {["ASSIGNED", "PICKED_UP"].includes(delivery.delivery_status) ? (
            <ConfirmButton variant="danger" confirm="Bạn muốn báo không thể giao đơn này? Giao dịch liên quan có thể bị hủy." onConfirm={() => onAction(delivery.delivery_id, "failed")}>
              <X className="h-4 w-4" />
              Không thể giao
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
          <h2 className="text-lg font-semibold text-slate-950">Đã giao thành công ({deliveries.length})</h2>
          <p className="text-base text-slate-500">
            Những đơn đã hoàn tất và điểm thưởng đã được cộng vào tài khoản của bạn.
          </p>
        </div>
      </div>

      {deliveries.length === 0 ? (
        <DeliveryEmptyState
          title="Chưa có vận đơn hoàn thành"
          description="Khi bạn giao xong đơn đầu tiên, lịch sử và điểm thưởng sẽ xuất hiện tại đây."
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
            <h3 className="truncate text-base font-semibold text-slate-950">
              {book?.title ?? `Giao dịch #${delivery.transaction_id}`}
            </h3>
            <Badge value={delivery.delivery_status} />
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            Nhận từ {ownerName ?? "-"} · giao cho {requesterName ?? "-"}
          </p>
          <p className="truncate text-sm leading-5 text-slate-400">
            {delivery.pickup_address ?? "Điểm lấy"} → {delivery.receiver_address}
          </p>
          <p className="text-sm leading-5 text-slate-400">
            Hoàn thành {formatDate(delivery.delivered_at)}
          </p>
        </div>
        <span className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 max-sm:col-span-2 max-sm:w-fit">
          +2 đã cộng
        </span>
      </div>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "blue"
}: {
  icon: typeof Truck;
  label: string;
  value: string | number;
  helper: string;
  tone?: "blue" | "amber" | "emerald" | "violet";
}) {
  const toneMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100"
  };

  return (
    <Card className="flex flex-col items-start gap-3 p-4 transition-all hover:-translate-y-1 hover:shadow-md">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset", toneMap[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 w-full">
        <div className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
          {value}
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-1">{label}</div>
        <div className="mt-2 text-xs leading-5 text-slate-500 truncate">
          {helper}
        </div>
      </div>
    </Card>
  );
}

function CourierStatusBadge({ status }: { status: string }) {
  const label =
    status === "AVAILABLE"
      ? "Sẵn sàng nhận đơn"
      : status === "BUSY"
        ? "Đang giao một đơn"
        : status === "PENDING"
          ? "Đang chờ duyệt"
          : "Tạm ngừng nhận đơn";

  return (
    <span className={cn(
      "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold",
      status === "AVAILABLE" ? "bg-emerald-50 text-emerald-700" : status === "BUSY" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
    )}>
      <span className={cn("h-2 w-2 rounded-full", status === "AVAILABLE" ? "bg-emerald-500" : status === "BUSY" ? "bg-amber-500" : "bg-slate-400")} />
      {label}
    </span>
  );
}

function DeliveryEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/85 px-6 py-8 text-center shadow-sm">
      <div>
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Navigation className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-base leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function BookThumb({ book }: { book?: Book }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
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
    <div className="flex gap-3 rounded-2xl bg-slate-50 px-3 py-3">
      <div className={cn("mt-1 h-3 w-3 rounded-full ring-4", active ? "bg-emerald-500 ring-emerald-100" : "bg-slate-300 ring-slate-100")} />
      <div>
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <p className="text-base font-semibold text-slate-950">{value ?? "Chưa có điểm giao"}</p>
        <p className="text-sm text-slate-500">{helper}</p>
      </div>
    </div>
  );
}

function successRate(deliveries: Delivery[]) {
  const terminal = deliveries.filter((delivery) => ["DELIVERED", "FAILED"].includes(delivery.delivery_status));
  if (terminal.length === 0) return 0;
  return Math.round((terminal.filter((delivery) => delivery.delivery_status === "DELIVERED").length / terminal.length) * 100);
}
