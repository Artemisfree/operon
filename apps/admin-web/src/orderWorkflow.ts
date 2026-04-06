/** Labels and allowed admin transitions (assign courier is separate in UI for ready_for_dispatch). */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Новый',
  confirmed: 'Подтверждён',
  preparing: 'Готовится',
  ready_for_dispatch: 'К доставке',
  on_the_way: 'В пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

export function nextAdminStatuses(status: string): string[] {
  switch (status) {
    case 'pending':
      return ['confirmed', 'cancelled'];
    case 'confirmed':
      return ['preparing', 'cancelled'];
    case 'preparing':
      return ['ready_for_dispatch', 'cancelled'];
    case 'ready_for_dispatch':
      return [];
    case 'on_the_way':
      return ['delivered', 'cancelled'];
    default:
      return [];
  }
}
