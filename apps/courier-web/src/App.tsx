import { FormEvent, useCallback, useEffect, useState } from 'react';

import { listJobs, markDelivered, uploadProof, type CourierJob } from './api';
import { clearToken, loadToken, storeToken } from './auth';

const STATUS_LABEL: Record<string, string> = {
  on_the_way: 'В пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

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

      <div className="courier-list">
        {jobs.length === 0 ? (
          <p className="courier-empty">Активных доставок нет.</p>
        ) : (
          jobs.map((job) => (
            <article key={job.id} className="courier-card">
              <div className="courier-card-top">
                <strong>{job.order.customerName}</strong>
                <span className="courier-pill">
                  {STATUS_LABEL[job.order.status] ?? job.order.status}
                </span>
              </div>
              <p className="courier-phone">{job.order.customerPhone}</p>
              <p className="courier-address">{job.order.deliveryAddress}</p>
              <p className="courier-meta">
                Сумма: {job.order.totalAmount} ₽ · Назначено{' '}
                {new Date(job.assignedAt).toLocaleString('ru-RU')}
              </p>
              {job.order.comment ? (
                <p className="courier-comment">Комментарий: {job.order.comment}</p>
              ) : null}
              <p className="courier-meta">
                Фото: {job.hasProofPhoto ? 'прикреплено' : 'нет'}
              </p>

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
                          event.target.value = '';
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await markDelivered(token, job.id);
                        await load();
                      } catch (deliverError) {
                        setError(
                          deliverError instanceof Error
                            ? deliverError.message
                            : 'Не удалось закрыть доставку.',
                        );
                      }
                    }}
                  >
                    Доставлено
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
