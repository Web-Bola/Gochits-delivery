// Sends a push notification to the customer when an order changes status.
// Trigger: Supabase "Database Webhook" on table public.orders, event UPDATE, with the header
//   Authorization: Bearer <WEBHOOK_SECRET>
// Secrets (set once with `supabase secrets set WEBHOOK_SECRET=...`, never committed):
//   WEBHOOK_SECRET. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to the function by Supabase itself.
// NOT YET DEPLOYED OR TESTED against a real device: needs the EAS project id in the app and a real phone.
import { createClient } from 'npm:@supabase/supabase-js@2';

const TEXT: Record<string, string> = {
  accepted: 'რესტორანმა მიიღო შენი შეკვეთა',
  preparing: 'შენი შეკვეთა მზადდება',
  ready_for_pickup: 'შეკვეთა მზადაა',
  out_for_delivery: 'კურიერი გზაშია',
  delivered: 'შეკვეთა მიტანილია. გაგემრიელოს!',
  rejected: 'რესტორანმა ვერ მიიღო შეკვეთა',
  cancelled: 'შეკვეთა გაუქმდა',
};

const ok = () => new Response('ok');

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('forbidden', { status: 403 });

  const { record, old_record } = await req.json();
  if (!record || record.status === old_record?.status) return ok();
  const body = TEXT[record.status as string];
  if (!body || !record.customer_id) return ok();

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: tokens, error } = await sb.from('push_tokens').select('token').eq('user_id', record.customer_id);
  if (error || !tokens?.length) return ok();

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(tokens.map((t: { token: string }) => ({
      to: t.token, title: "Gochit's", body, sound: 'default', channelId: 'orders', data: { orderId: record.id, number: record.number },
    }))),
  });
  return ok();
});
