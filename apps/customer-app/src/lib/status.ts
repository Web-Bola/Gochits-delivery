import type { OrderStatus } from '@gochits/shared';

// Status labels are placeholders until the restaurant confirms wording (ARCHITECTURE section 5).
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'გადახდის მოლოდინში', payment_failed: 'გადახდა ვერ შესრულდა', placed: 'შეკვეთა გაიგზავნა', accepted: 'მიღებულია',
  preparing: 'მზადდება', ready_for_pickup: 'მზადაა', out_for_delivery: 'გზაშია', delivered: 'მიტანილია', cancelled: 'გაუქმებულია', rejected: 'უარყოფილია',
};
