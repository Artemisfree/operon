import { FormEvent, useEffect, useState } from 'react';

import {
  getConversation,
  listConversations,
  login,
  postOperatorMessage,
  startHandoff,
  stopHandoff,
  type ConversationDetails,
  type ConversationListItem,
} from './api';
import { clearToken, loadToken, storeToken } from './auth';
import { MetricsView } from './MetricsView';
import { OrdersView } from './OrdersView';
import { BehaviorView } from './BehaviorView';
import { AdminNav } from './AdminNav';
import { LogoutButton } from './LogoutButton';

export function App() {
  const [view, setView] = useState<'chats' | 'orders' | 'metrics' | 'behavior'>(
    'chats',
  );
  const [token, setToken] = useState<string | null>(() => loadToken());
  const [email, setEmail] = useState('admin@operon.local');
  const [password, setPassword] = useState('admin12345');
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<ConversationDetails | null>(null);
  const [operatorText, setOperatorText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const data = await listConversations(token);
        if (!cancelled) {
          setConversations(data);
          if (!selectedId && data[0]) {
            setSelectedId(data[0].id);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Не удалось загрузить диалоги.',
          );
        }
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [token, selectedId]);

  useEffect(() => {
    if (!token || !selectedId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const data = await getConversation(token, selectedId);
        if (!cancelled) {
          setDetails(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Не удалось загрузить диалог.',
          );
        }
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [token, selectedId]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const response = await login(email, password);
      storeToken(response.accessToken);
      setToken(response.accessToken);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Не удалось выполнить login.',
      );
    }
  };

  const withReload = async (action: () => Promise<unknown>) => {
    if (!token || !selectedId) {
      return;
    }

    await action();
    setDetails(await getConversation(token, selectedId));
    setConversations(await listConversations(token));
  };

  const handleLogout = () => {
    clearToken();
    setToken(null);
    setDetails(null);
    setSelectedId(null);
    setView('chats');
  };

  if (!token) {
    return (
      <main className="admin-shell admin-auth-shell">
        <form className="admin-auth-card" onSubmit={handleLogin}>
          <p className="admin-eyebrow">Operon Admin</p>
          <h1>Вход оператора</h1>
          <label>
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit">Войти</button>
          {error ? <p className="admin-error">{error}</p> : null}
        </form>
      </main>
    );
  }

  if (view === 'orders') {
    return (
      <main className="admin-shell">
        <OrdersView
          token={token}
          activeView="orders"
          onOpenChats={() => setView('chats')}
          onOpenMetrics={() => setView('metrics')}
          onOpenBehavior={() => setView('behavior')}
          onLogout={handleLogout}
        />
      </main>
    );
  }

  if (view === 'metrics') {
    return (
      <MetricsView
        token={token}
        activeView="metrics"
        onOpenChats={() => setView('chats')}
        onOpenOrders={() => setView('orders')}
        onOpenBehavior={() => setView('behavior')}
        onLogout={handleLogout}
      />
    );
  }

  if (view === 'behavior') {
    return (
      <main className="admin-shell admin-shell-behavior">
        <BehaviorView
          token={token}
          activeView="behavior"
          onOpenChats={() => setView('chats')}
          onOpenOrders={() => setView('orders')}
          onOpenMetrics={() => setView('metrics')}
          onLogout={handleLogout}
        />
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <header className="admin-sidebar-header">
          <div>
            <p className="admin-eyebrow">Operon</p>
            <h1>Диалоги</h1>
          </div>
          <LogoutButton onLogout={handleLogout} />
        </header>
        <AdminNav
          active="chats"
          onOpenChats={() => setView('chats')}
          onOpenOrders={() => setView('orders')}
          onOpenMetrics={() => setView('metrics')}
          onOpenBehavior={() => setView('behavior')}
        />

        <div className="admin-conversation-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`admin-conversation-item ${
                conversation.id === selectedId ? 'admin-conversation-item-active' : ''
              }`}
              type="button"
              onClick={() => setSelectedId(conversation.id)}
            >
              <div className="admin-conversation-topline">
                <strong>{conversation.customerName || 'Без имени'}</strong>
                <span className={`admin-badge admin-badge-${conversation.handoffState}`}>
                  {conversation.handoffState}
                </span>
              </div>
              <p>{conversation.lastMessage?.content || 'Сообщений пока нет'}</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="admin-main">
        {!details ? (
          <div className="admin-empty">Выберите диалог.</div>
        ) : (
          <>
            <header className="admin-main-header">
              <div>
                <h2>{details.customerName || 'Без имени'}</h2>
                <p>{details.customerPhone || 'Телефон не указан'}</p>
              </div>
              <div className="admin-actions">
                {details.handoffState === 'ai' ? (
                  <button
                    type="button"
                    onClick={() =>
                      withReload(() => startHandoff(token, details.id))
                    }
                  >
                    Перехватить чат
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => withReload(() => stopHandoff(token, details.id))}
                  >
                    Вернуть AI
                  </button>
                )}
              </div>
            </header>

            <div className="admin-message-list">
              {details.messages.map((message) => (
                <article
                  key={message.id}
                  className={`admin-message admin-message-${message.role}`}
                >
                  <span>{message.role}</span>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>

            <form
              className="admin-reply-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const nextText = operatorText.trim();
                if (!nextText || !details) {
                  return;
                }

                try {
                  await withReload(() =>
                    postOperatorMessage(token, details.id, nextText),
                  );
                  setOperatorText('');
                } catch (sendError) {
                  setError(
                    sendError instanceof Error
                      ? sendError.message
                      : 'Не удалось отправить сообщение оператора.',
                  );
                }
              }}
            >
              <textarea
                rows={3}
                value={operatorText}
                onChange={(event) => setOperatorText(event.target.value)}
                placeholder="Ответ оператора..."
              />
              <button type="submit">Отправить ответ</button>
            </form>
          </>
        )}

        {error ? <p className="admin-error">{error}</p> : null}
      </section>
    </main>
  );
}
