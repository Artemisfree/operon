import { useCallback, useEffect, useState } from 'react';

import { getMetrics, type MetricsSnapshot } from './api';
import { AdminNav } from './AdminNav';
import { LogoutButton } from './LogoutButton';

type Props = {
  token: string;
  activeView?: 'metrics';
  onOpenChats: () => void;
  onOpenOrders: () => void;
  onOpenBehavior: () => void;
  onLogout: () => void;
};

export function MetricsView({
  token,
  activeView = 'metrics',
  onOpenChats,
  onOpenOrders,
  onOpenBehavior,
  onLogout,
}: Props) {
  const [data, setData] = useState<MetricsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setData(await getMetrics(token));
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Не удалось загрузить метрики.',
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 8000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <header className="admin-sidebar-header">
          <div>
            <p className="admin-eyebrow">Operon</p>
            <h1>Метрики</h1>
          </div>
          <LogoutButton onLogout={onLogout} />
        </header>
        <AdminNav
          active={activeView}
          onOpenChats={onOpenChats}
          onOpenOrders={onOpenOrders}
          onOpenMetrics={() => undefined}
          onOpenBehavior={onOpenBehavior}
        />
      </aside>

      <section className="admin-main admin-metrics-main">
        <header className="admin-metrics-header">
          <div>
            <p className="admin-eyebrow">Dashboard</p>
            <h2>Операционные показатели</h2>
            <p className="admin-muted">Автообновление каждые 8 секунд.</p>
          </div>
          <div className="admin-page-actions">
            <button
              type="button"
              className="admin-metrics-refresh"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? 'Обновление...' : 'Обновить'}
            </button>
          </div>
        </header>
        {!data ? (
          <div className="admin-empty">Загрузка…</div>
        ) : (
          <>
            <div className="admin-metrics-grid admin-metrics-grid-primary">
              <MetricCard
                title="Заказы"
                value={data.ordersTotal}
                sub={`${data.ordersDelivered} доставлено`}
                detail={`Delivery rate ${data.deliveredPct}%`}
                progress={data.deliveredPct}
              />
              <MetricCard
                title="Диалоги"
                value={data.conversationsTotal}
                sub={`${data.conversationsWithOperatorReply} с ответом оператора`}
                detail={`Handoff ${data.handoffPct}%`}
                progress={data.handoffPct}
              />
              <MetricCard
                title="Review"
                value={data.reviewRequestsSent}
                sub="Отправлено запросов"
                detail={
                  data.ordersDelivered > 0
                    ? `${Math.round((data.reviewRequestsSent / data.ordersDelivered) * 100)}% от доставленных`
                    : 'Нет доставленных заказов'
                }
                progress={
                  data.ordersDelivered > 0
                    ? Math.round((data.reviewRequestsSent / data.ordersDelivered) * 100)
                    : 0
                }
              />
            </div>

            <div className="admin-metrics-insights">
              <section className="admin-metrics-panel">
                <h3>Воронка заказов</h3>
                <MetricRow label="Всего заказов" value={data.ordersTotal} />
                <MetricRow label="Доставлено" value={data.ordersDelivered} />
                <MetricRow label="Не доставлено / в работе" value={Math.max(data.ordersTotal - data.ordersDelivered, 0)} />
              </section>
              <section className="admin-metrics-panel">
                <h3>Нагрузка операторов</h3>
                <MetricRow label="Всего диалогов" value={data.conversationsTotal} />
                <MetricRow label="Диалогов с оператором" value={data.conversationsWithOperatorReply} />
                <MetricRow label="AI-only диалогов" value={Math.max(data.conversationsTotal - data.conversationsWithOperatorReply, 0)} />
              </section>
            </div>
          </>
        )}
        {error ? <p className="admin-error">{error}</p> : null}
      </section>
    </main>
  );
}

function MetricCard({
  title,
  value,
  sub,
  detail,
  progress,
}: {
  title: string;
  value: number;
  sub: string;
  detail: string;
  progress: number;
}) {
  const boundedProgress = Math.max(0, Math.min(progress, 100));

  return (
    <article className="admin-metric-card admin-metric-card-featured">
      <div>
        <h2>{title}</h2>
        <p className="admin-metric-value">{value}</p>
        <p className="admin-metric-sub">{sub}</p>
      </div>
      <div className="admin-metric-progress" aria-label={detail}>
        <span style={{ width: `${boundedProgress}%` }} />
      </div>
      <p className="admin-metric-detail">{detail}</p>
    </article>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
