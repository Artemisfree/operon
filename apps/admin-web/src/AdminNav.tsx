type AdminView = 'chats' | 'orders' | 'metrics' | 'behavior';

type Props = {
  active: AdminView;
  onOpenChats: () => void;
  onOpenOrders: () => void;
  onOpenMetrics: () => void;
  onOpenBehavior: () => void;
};

const NAV_ITEMS: Array<{
  id: AdminView;
  label: string;
  shortLabel: string;
}> = [
  { id: 'chats', label: 'Диалоги', shortLabel: 'Диалоги' },
  { id: 'orders', label: 'Заказы', shortLabel: 'Заказы' },
  { id: 'metrics', label: 'Метрики', shortLabel: 'Метрики' },
  { id: 'behavior', label: 'Поведение AI', shortLabel: 'AI' },
];

export function AdminNav({
  active,
  onOpenChats,
  onOpenOrders,
  onOpenMetrics,
  onOpenBehavior,
}: Props) {
  const handlers: Record<AdminView, () => void> = {
    chats: onOpenChats,
    orders: onOpenOrders,
    metrics: onOpenMetrics,
    behavior: onOpenBehavior,
  };

  return (
    <nav className="admin-nav" aria-label="Разделы админки">
      <div className="admin-nav-segments">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === active ? 'admin-nav-item admin-nav-item-active' : 'admin-nav-item'}
            aria-current={item.id === active ? 'page' : undefined}
            onClick={handlers[item.id]}
          >
            <span className="admin-nav-label">{item.label}</span>
            <span className="admin-nav-short-label">{item.shortLabel}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
