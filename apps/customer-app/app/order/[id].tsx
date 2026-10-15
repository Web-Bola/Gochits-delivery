import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatGel, type OrderStatus } from '@gochits/shared';
import { Body, Button, H1, Screen } from '../../src/components/ui';
import { supabase } from '../../src/lib/supabase';

// Status labels are placeholders until the restaurant confirms wording (ARCHITECTURE section 5).
const LABEL: Record<OrderStatus, string> = {
  pending_payment: 'გადახდის მოლოდინში', payment_failed: 'გადახდა ვერ შესრულდა', placed: 'შეკვეთა გაიგზავნა', accepted: 'მიღებულია',
  preparing: 'მზადდება', ready_for_pickup: 'მზადაა', out_for_delivery: 'გზაშია', delivered: 'მიტანილია', cancelled: 'გაუქმებულია', rejected: 'უარყოფილია',
};

interface Row { number: string; status: OrderStatus; total_tetri: number }

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => supabase.from('orders').select('number,status,total_tetri').eq('id', id).single().then(({ data }) => alive && data && setRow(data as Row));
    load();
    // Realtime: RLS limits this to the customer's own order.
    const ch = supabase.channel(`order:${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, load).subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [id]);

  if (!row) return <Screen><ActivityIndicator /></Screen>;
  return (
    <Screen>
      <H1>{row.number}</H1>
      <Body>{LABEL[row.status]}</Body>
      <Body muted>{formatGel(row.total_tetri)}</Body>
      <Button title="მენიუ" onPress={() => router.replace('/menu')} variant="ink" />
    </Screen>
  );
}
