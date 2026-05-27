import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  fetchConversationMessages,
  postChatMessage,
  type WidgetMessage,
} from './api';

const CUSTOMER_NAME_STORAGE_KEY = 'operon-widget-customer-name';
const BRAND_NAME =
  (typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('brand')) || 'Operon';
const LOCALE =
  (typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('locale')) || 'en';

export function App() {
  const [isOpen, setIsOpen] = useState(false);
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
    const publishSize = () => {
      window.parent.postMessage(
        {
          type: 'operon-widget-size',
          isOpen,
        },
        '*',
      );
    };

    publishSize();
    window.addEventListener('resize', publishSize);

    return () => {
      window.removeEventListener('resize', publishSize);
    };
  }, [isOpen]);

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
              : 'Could not refresh the conversation.',
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
        locale: LOCALE,
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
          : 'Could not send the message.',
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
          aria-label="Open chat"
        >
          AI Assistant
        </button>
      ) : (
        <section className="widget-panel">
          <header className="widget-header">
            <div>
              <p className="widget-eyebrow">Assistant</p>
              <h1>{BRAND_NAME}</h1>
            </div>
            <button
              className="widget-close"
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </header>

          <label className="widget-name">
            <span>Your name</span>
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="For example, Anna"
            />
          </label>

          <div className={`widget-banner widget-banner-${handoffState}`}>
            {handoffState === 'operator'
              ? 'A team member has joined. The assistant is paused.'
              : 'AI assistant is ready to help with your order.'}
          </div>

          <div className="widget-messages">
            {visibleMessages.length === 0 ? (
              <div className="widget-empty">
                Tell me what bouquet you need, and I will help with your order.
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
              placeholder="For example: I need a bouquet delivered today..."
              rows={3}
            />
            <button disabled={isSending} type="submit">
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </form>

          {error ? <p className="widget-error">{error}</p> : null}
        </section>
      )}
    </div>
  );
}
