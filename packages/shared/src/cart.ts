export interface CartLine { productId: string; name: string; unitPriceTetri: number; quantity: number }

/** Display-only estimate. The real subtotal, fee and total are computed by create_order() on the server. */
export function cartSubtotal(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPriceTetri * l.quantity, 0);
}

export function addLine(lines: readonly CartLine[], line: Omit<CartLine, 'quantity'>): CartLine[] {
  const i = lines.findIndex((l) => l.productId === line.productId);
  if (i === -1) return [...lines, { ...line, quantity: 1 }];
  return lines.map((l, j) => (j === i ? { ...l, quantity: Math.min(50, l.quantity + 1) } : l));
}

export function removeLine(lines: readonly CartLine[], productId: string): CartLine[] {
  return lines.flatMap((l) => (l.productId !== productId ? [l] : l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : []));
}
