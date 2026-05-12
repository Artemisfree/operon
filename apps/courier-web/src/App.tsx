import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { listJobs, markDelivered, uploadProof, type CourierJob } from './api';
import { clearToken, loadToken, storeToken } from './auth';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Новый',
  confirmed: 'Подтверждён',
  preparing: 'Готовится',
  ready_for_dispatch: 'Готов к выдаче',
  on_the_way: 'В пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'on_the_way', label: 'В пути' },
  { id: 'delivered', label: 'Доставлены' },
  { id: 'cancelled', label: 'Отменены' },
] as const;

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getOrderNumber(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unsupported file read result'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

export function App() {
  const [token, setToken] = useState<string | null>(() => loadToken());
  const [draftToken, setDraftToken] = useState('');
  const [jobs, setJobs] = useState<CourierJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]['id']>(
    'all',
  );
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const next = await listJobs(token);
      setJobs(next);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Не удалось загрузить доставки.',
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

  const handleSaveToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draftToken.trim();
    if (!next) {
      return;
    }

    storeToken(next);
    setToken(next);
    setDraftToken('');
  };

  const stats = useMemo(
    () => ({
      total: jobs.length,
      active: jobs.filter((job) => job.order.status === 'on_the_way').length,
      delivered: jobs.filter((job) => job.order.status === 'delivered').length,
      withProof: jobs.filter((job) => job.hasProofPhoto).length,
      revenue: jobs.reduce((sum, job) => sum + job.order.totalAmount, 0),
    }),
    [jobs],
  );

  const filteredJobs = useMemo(
    () =>
      activeFilter === 'all'
        ? jobs
        : jobs.filter((job) => job.order.status === activeFilter),
    [activeFilter, jobs],
  );

  if (!token) {
    return (
      <main className="courier-shell courier-auth-shell">
        <form className="courier-auth-card" onSubmit={handleSaveToken}>
          <p className="courier-eyebrow">Operon</p>
          <h1>Курьер</h1>
          <p className="courier-hint">
            Вставьте API-токен курьера (выдаётся администратором; в dev см. seed{' '}
            <code>courier-dev-token</code>).
          </p>
          <label>
            <span>Токен</span>
            <input
              value={draftToken}
              onChange={(event) => setDraftToken(event.target.value)}
              autoComplete="off"
            />
          </label>
          <button type="submit">Сохранить</button>
          {error ? <p className="courier-error">{error}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="courier-shell">
      <header className="courier-header">
        <div>
          <p className="courier-eyebrow">Operon</p>
          <h1>Мои доставки</h1>
          <p className="courier-subtitle">
            Текущие задания, состав заказов и история статусов.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearToken();
            setToken(null);
            setJobs([]);
          }}
        >
          Сменить токен
        </button>
      </header>

      <section className="courier-summary" aria-label="Сводка доставок">
        <div>
          <span>{stats.active}</span>
          <p>в пути</p>
        </div>
        <div>
          <span>{stats.delivered}</span>
          <p>доставлены</p>
        </div>
        <div>
          <span>{stats.withProof}</span>
          <p>с фото</p>
        </div>
        <div>
          <span>{formatMoney(stats.revenue)}</span>
          <p>сумма заказов</p>
        </div>
      </section>

      <nav className="courier-filters" aria-label="Фильтр доставок">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={activeFilter === filter.id ? 'is-active' : ''}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </nav>

      <div className="courier-list">
        {filteredJobs.length === 0 ? (
          <p className="courier-empty">Активных доставок нет.</p>
        ) : (
          filteredJobs.map((job) => (
            <article
              key={job.id}
              className={`courier-card courier-card-${job.order.status}`}
            >
              <div className="courier-card-top">
                <div>
                  <p className="courier-order-id">Заказ #{getOrderNumber(job.order.id)}</p>
                  <strong>{job.order.customerName}</strong>
                </div>
                <span className={`courier-pill courier-pill-${job.order.status}`}>
                  {STATUS_LABEL[job.order.status] ?? job.order.status}
                </span>
              </div>

              <dl className="courier-details">
                <div>
                  <dt>Телефон</dt>
                  <dd>
                    <a href={`tel:${job.order.customerPhone}`}>
                      {job.order.customerPhone}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Адрес</dt>
                  <dd>{job.order.deliveryAddress}</dd>
                </div>
                <div>
                  <dt>Сумма</dt>
                  <dd>{formatMoney(job.order.totalAmount)}</dd>
                </div>
                <div>
                  <dt>Назначено</dt>
                  <dd>{formatDateTime(job.assignedAt)}</dd>
                </div>
                <div>
                  <dt>Доставлено</dt>
                  <dd>{formatDateTime(job.deliveredAt)}</dd>
                </div>
                <div>
                  <dt>Фото</dt>
                  <dd>{job.hasProofPhoto ? 'прикреплено' : 'не загружено'}</dd>
                </div>
              </dl>

              {job.order.comment ? (
                <p className="courier-comment">Комментарий: {job.order.comment}</p>
              ) : null}

              <section className="courier-items" aria-label="Состав заказа">
                <h2>Состав</h2>
                <ul>
                  {job.order.items.map((item) => (
                    <li key={item.id}>
                      <span>{item.product.name}</span>
                      <strong>
                        {item.quantity} × {formatMoney(item.unitPrice)}
                      </strong>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="courier-timeline" aria-label="История статусов">
                <h2>История</h2>
                <ol>
                  {job.order.statusHistory.slice(-4).map((event) => (
                    <li key={event.id}>
                      <span>{formatDateTime(event.createdAt)}</span>
                      <strong>{STATUS_LABEL[event.status] ?? event.status}</strong>
                      {event.note ? <p>{event.note}</p> : null}
                    </li>
                  ))}
                </ol>
              </section>

              {job.order.status === 'on_the_way' ? (
                <div className="courier-actions">
                  <label className="courier-file">
                    <span>Фото подтверждения</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) {
                          return;
                        }

                        try {
                          setBusyJobId(job.id);
                          const base64 = await readFileAsBase64(file);
                          await uploadProof(token, job.id, base64);
                          await load();
                        } catch (proofError) {
                          setError(
                            proofError instanceof Error
                              ? proofError.message
                              : 'Не удалось загрузить фото.',
                          );
                        } finally {
                          setBusyJobId(null);
                          event.target.value = '';
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setBusyJobId(job.id);
                        await markDelivered(token, job.id);
                        await load();
                      } catch (deliverError) {
                        setError(
                          deliverError instanceof Error
                            ? deliverError.message
                            : 'Не удалось закрыть доставку.',
                        );
                      } finally {
                        setBusyJobId(null);
                      }
                    }}
                    disabled={busyJobId === job.id}
                  >
                    {busyJobId === job.id ? 'Обновляем...' : 'Доставлено'}
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      {error ? <p className="courier-error courier-error-toast">{error}</p> : null}
    </main>
  );
}
