import { useCallback, useEffect, useState } from 'react';

import {
  assignDelivery,
  listCouriers,
  listOrders,
  updateOrderStatus,
  type CourierRecord,
  type OrderRecord,
} from './api';
import { AdminNav } from './AdminNav';
import { LogoutButton } from './LogoutButton';
import { nextAdminStatuses, ORDER_STATUS_LABEL } from './orderWorkflow';

type Props = {
  token: string;
  activeView?: 'orders';
  onOpenChats: () => void;
  onOpenMetrics: () => void;
  onOpenBehavior: () => void;
  onLogout: () => void;
};

export function OrdersView({
  token,
  activeView = 'orders',
  onOpenChats,
  onOpenMetrics,
  onOpenBehavior,
  onLogout,
}: Props) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [couriers, setCouriers] = useState<CourierRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [courierPick, setCourierPick] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextOrders, nextCouriers] = await Promise.all([
        listOrders(token),
        listCouriers(token),
      ]);
      setOrders(nextOrders);
      setCouriers(nextCouriers);
      setCourierPick((previous) => previous || nextCouriers[0]?.id || '');
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Не удалось загрузить заказы.',
      );
    }
  }, [token]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  const selected = selectedId
    ? orders.find((order) => order.id === selectedId) ?? null
    : null;

  return (
    <>
      <aside className="admin-sidebar">
        <header className="admin-sidebar-header">
          <div>
            <p className="admin-eyebrow">Operon</p>
            <h1>Заказы</h1>
          </div>
          <LogoutButton onLogout={onLogout} />
        </header>
        <AdminNav
          active={activeView}
          onOpenChats={onOpenChats}
          onOpenOrders={() => undefined}
          onOpenMetrics={onOpenMetrics}
          onOpenBehavior={onOpenBehavior}
        />
        <div className="admin-conversation-list">
          {orders.map((order) => (
            <button
              key={order.id}
              type="button"
              className={`admin-conversation-item ${
                order.id === selectedId ? 'admin-conversation-item-active' : ''
              }`}
              onClick={() => setSelectedId(order.id)}
            >
              <div className="admin-conversation-topline">
                <strong>{order.customerName}</strong>
                <span className="admin-order-status-pill">
                  {ORDER_STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>
              <p className="admin-order-meta">
                {new Date(order.createdAt).toLocaleString('ru-RU')} ·{' '}
                {order.totalAmount} ₽
              </p>
            </button>
          ))}
        </div>
      </aside>

      <section className="admin-main">
        {!selected ? (
          <div className="admin-empty">Выберите заказ.</div>
        ) : (
          <>
            <header className="admin-main-header">
              <div>
                <h2>Заказ {selected.id.slice(0, 8)}…</h2>
                <p>
                  {selected.customerName} · {selected.customerPhone}
                </p>
                <p className="admin-order-address">{selected.deliveryAddress}</p>
              </div>
              <div className="admin-actions admin-order-actions">
                {nextAdminStatuses(selected.status).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={async () => {
                      try {
                        await updateOrderStatus(token, selected.id, status);
                        await load();
                      } catch (actionError) {
                        setError(
                          actionError instanceof Error
                            ? actionError.message
                            : 'Не удалось обновить статус.',
                        );
                      }
                    }}
                  >
                    → {ORDER_STATUS_LABEL[status] ?? status}
                  </button>
                ))}
              </div>
            </header>

            {selected.status === 'ready_for_dispatch' && !selected.deliveryJob ? (
              <div className="admin-assign-card">
                <h3>Назначить курьера</h3>
                <p className="admin-muted">
                  После назначения заказ перейдёт в «В пути», курьер увидит доставку в
                  своём приложении.
                </p>
                <div className="admin-assign-row">
                  <select
                    value={courierPick}
                    onChange={(event) => setCourierPick(event.target.value)}
                  >
                    {couriers.map((courier) => (
                      <option key={courier.id} value={courier.id}>
                        {courier.displayName}
                        {courier.phone ? ` · ${courier.phone}` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!courierPick}
                    onClick={async () => {
                      try {
                        await assignDelivery(token, selected.id, courierPick);
                        await load();
                      } catch (assignError) {
                        setError(
                          assignError instanceof Error
                            ? assignError.message
                            : 'Не удалось назначить курьера.',
                        );
                      }
                    }}
                  >
                    Назначить
                  </button>
                </div>
              </div>
            ) : null}

            {selected.deliveryJob ? (
              <div className="admin-delivery-info">
                <h3>Доставка</h3>
                <p>
                  Курьер: <strong>{selected.deliveryJob.courier.displayName}</strong>
                </p>
                <p className="admin-muted">
                  Назначено:{' '}
                  {new Date(selected.deliveryJob.assignedAt).toLocaleString('ru-RU')}
                </p>
                {selected.deliveryJob.deliveredAt ? (
                  <p className="admin-muted">
                    Закрыто:{' '}
                    {new Date(selected.deliveryJob.deliveredAt).toLocaleString('ru-RU')}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="admin-order-items">
              <h3>Состав</h3>
              <ul>
                {selected.items.map((line) => (
                  <li key={line.id}>
                    {line.product.name} × {line.quantity} —{' '}
                    {line.unitPrice * line.quantity} ₽
                  </li>
                ))}
              </ul>
            </div>

            <div className="admin-order-history">
              <h3>История статусов</h3>
              <ul>
                {selected.statusHistory.map((row) => (
                  <li key={row.id}>
                    <span className="admin-muted">
                      {new Date(row.createdAt).toLocaleString('ru-RU')}
                    </span>{' '}
                    — {ORDER_STATUS_LABEL[row.status] ?? row.status}
                    {row.note ? ` (${row.note})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {error ? <p className="admin-error">{error}</p> : null}
      </section>
    </>
  );
}
