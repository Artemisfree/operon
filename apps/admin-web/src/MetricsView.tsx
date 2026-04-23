import { useCallback, useEffect, useState } from 'react';

import { getMetrics, type MetricsSnapshot } from './api';

type Props = {
  token: string;
  onOpenChats: () => void;
  onOpenOrders: () => void;
  onOpenBehavior?: () => void;
  onLogout: () => void;
};

export function MetricsView({
  token,
  onOpenChats,
  onOpenOrders,
  onOpenBehavior,
  onLogout,
}: Props) {
  const [data, setData] = useState<MetricsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getMetrics(token));
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Не удалось загрузить метрики.',
      );
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
          <div className="admin-header-actions">
            <button type="button" onClick={onOpenChats}>
              Диалоги
            </button>
            <button type="button" onClick={onOpenOrders}>
              Заказы
            </button>
            {onOpenBehavior ? (
              <button type="button" onClick={onOpenBehavior}>
                Поведение AI
              </button>
            ) : null}
            <button type="button" onClick={onLogout}>
              Выйти
            </button>
          </div>
        </header>
        <p className="admin-metrics-hint">Обновление каждые 8 с и по кнопке.</p>
        <button type="button" className="admin-metrics-refresh" onClick={() => void load()}>
          Обновить сейчас
        </button>
      </aside>

      <section className="admin-main admin-metrics-main">
        {!data ? (
          <div className="admin-empty">Загрузка…</div>
        ) : (
          <div className="admin-metrics-grid">
            <article className="admin-metric-card">
              <h2>Заказов всего</h2>
              <p className="admin-metric-value">{data.ordersTotal}</p>
            </article>
            <article className="admin-metric-card">
              <h2>Доставлено</h2>
              <p className="admin-metric-value">{data.ordersDelivered}</p>
              <p className="admin-metric-sub">доля {data.deliveredPct}%</p>
            </article>
            <article className="admin-metric-card">
              <h2>Диалогов</h2>
              <p className="admin-metric-value">{data.conversationsTotal}</p>
            </article>
            <article className="admin-metric-card">
              <h2>С ответом оператора</h2>
              <p className="admin-metric-value">{data.conversationsWithOperatorReply}</p>
              <p className="admin-metric-sub">handoff {data.handoffPct}%</p>
            </article>
            <article className="admin-metric-card">
              <h2>Review отправлено</h2>
              <p className="admin-metric-value">{data.reviewRequestsSent}</p>
            </article>
          </div>
        )}
        {error ? <p className="admin-error">{error}</p> : null}
      </section>
    </main>
  );
}
