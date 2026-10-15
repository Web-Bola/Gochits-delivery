export const ORDER_STATUSES = [
  'pending_payment', 'payment_failed', 'placed', 'accepted', 'preparing',
  'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'rejected',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Mirrors transition_order() in supabase/migrations/0002_functions.sql. */
export const STAFF_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: [],
  payment_failed: [],
  placed: ['accepted', 'rejected'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
  rejected: [],
};

export function canStaffTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STAFF_TRANSITIONS[from].includes(to);
}

export const TERMINAL_STATUSES: readonly OrderStatus[] = ['delivered', 'cancelled', 'rejected', 'payment_failed'];
