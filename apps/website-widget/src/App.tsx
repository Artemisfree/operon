import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  fetchConversationMessages,
  postChatMessage,
  type WidgetMessage,
} from './api';

const CUSTOMER_NAME_STORAGE_KEY = 'operon-widget-customer-name';

export function App() {
  const [isOpen, setIsOpen] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [text, setText] = useState('');
  const [customerName, setCustomerName] = useState(
    () => localStorage.getItem(CUSTOMER_NAME_STORAGE_KEY) ?? '',
  );
  const [handoffState, setHandoffState] = useState<'ai' | 'operator'>('ai');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(CUSTOMER_NAME_STORAGE_KEY, customerName);
  }, [customerName]);

  useEffect(() => {
    if (!conversationId || !isOpen) {
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      try {
        const response = await fetchConversationMessages(conversationId);

        if (!cancelled) {
          setMessages(response.messages);
          setHandoffState(response.handoff_state);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Не удалось обновить историю сообщений.',
          );
        }
      }
    };

    void loadMessages();
    const intervalId = window.setInterval(() => {
      void loadMessages();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [conversationId, isOpen]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.role !== 'tool'),
    [messages],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextText = text.trim();

    if (!nextText) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await postChatMessage({
        conversationId: conversationId ?? undefined,
        text: nextText,
        customerName: customerName.trim() || undefined,
      });

      setConversationId(response.conversation_id);
      setHandoffState(response.handoff_state);
      setText('');

      const messagesResponse = await fetchConversationMessages(
        response.conversation_id,
      );
      setMessages(messagesResponse.messages);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Не удалось отправить сообщение.',
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="widget-shell">
      {!isOpen ? (
        <button
          className="widget-launcher"
          type="button"
          onClick={() => setIsOpen(true)}
        >
          Открыть чат
        </button>
      ) : (
        <section className="widget-panel">
          <header className="widget-header">
            <div>
              <p className="widget-eyebrow">Operon</p>
              <h1>Чат заказа</h1>
            </div>
            <button
              className="widget-close"
              type="button"
              onClick={() => setIsOpen(false)}
            >
              Закрыть
            </button>
          </header>

          <label className="widget-name">
            <span>Ваше имя</span>
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Например, Иван"
            />
          </label>

          <div className={`widget-banner widget-banner-${handoffState}`}>
            {handoffState === 'operator'
              ? 'Диалог передан оператору. AI не отвечает автоматически.'
              : 'AI-агент доступен для оформления заказа.'}
          </div>

          <div className="widget-messages">
            {visibleMessages.length === 0 ? (
              <div className="widget-empty">
                Напишите, что хотите заказать, и укажите адрес и телефон.
              </div>
            ) : (
              visibleMessages.map((message) => (
                <article
                  key={message.id}
                  className={`widget-message widget-message-${message.role}`}
                >
                  <p>{message.content}</p>
                </article>
              ))
            )}
          </div>

          <form className="widget-form" onSubmit={handleSubmit}>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Например: Хочу заказать 2 капучино..."
              rows={3}
            />
            <button disabled={isSending} type="submit">
              {isSending ? 'Отправка...' : 'Отправить'}
            </button>
          </form>

          {error ? <p className="widget-error">{error}</p> : null}
        </section>
      )}
    </div>
  );
}
