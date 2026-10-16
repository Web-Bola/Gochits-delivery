/** One cart line. `key` = product + note, so the same burger with different instructions stays on separate lines. */
export interface CartLine { key: string; productId: string; name: string; unitPriceTetri: number; quantity: number; note?: string }
export type NewLine = Omit<CartLine, 'quantity' | 'key'>;

export const MAX_LINE_QTY = 50;

export function lineKey(productId: string, note?: string): string {
  const n = note?.trim();
  return n ? `${productId}#${n}` : productId;
}

/** Display-only estimate. The real subtotal, fee and total are computed by create_order() on the server. */
export function cartSubtotal(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPriceTetri * l.quantity, 0);
}

export function addLine(lines: readonly CartLine[], line: NewLine, qty = 1): CartLine[] {
  const note = line.note?.trim() || undefined;
  const key = lineKey(line.productId, note);
  const i = lines.findIndex((l) => l.key === key);
  if (i === -1) return [...lines, { ...line, note, key, quantity: Math.min(MAX_LINE_QTY, qty) }];
  return lines.map((l, j) => (j === i ? { ...l, quantity: Math.min(MAX_LINE_QTY, l.quantity + qty) } : l));
}

export function removeLine(lines: readonly CartLine[], key: string): CartLine[] {
  return lines.flatMap((l) => (l.key !== key ? [l] : l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : []));
}

/** Total pieces of one product across all its lines (used for the "x2" badge on the menu). */
export function productQuantity(lines: readonly CartLine[], productId: string): number {
  return lines.filter((l) => l.productId === productId).reduce((n, l) => n + l.quantity, 0);
}

/** Payload for create_order(). Prices are NOT sent: the server reads them from the database. */
export function toOrderItems(lines: readonly CartLine[]): { product_id: string; quantity: number; note?: string }[] {
  return lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, ...(l.note ? { note: l.note } : {}) }));
}
