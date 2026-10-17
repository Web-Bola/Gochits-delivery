// Supabase Auth "Send SMS" hook -> SMS Office (smsoffice.ge).
// Supabase calls this function instead of its own SMS provider whenever a login code (OTP) must be sent.
// Secrets (Supabase -> Edge Functions -> Secrets): SMSOFFICE_KEY, SMS_SENDER (default "smsoffice"), SEND_SMS_HOOK_SECRET.
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: { http_code: 405, message: 'method_not_allowed' } });
  const payload = await req.text();
  const secret = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '');
  let event: { user: { phone?: string }; sms: { otp: string } };
  try {
    event = new Webhook(secret).verify(payload, Object.fromEntries(req.headers)) as typeof event;
  } catch {
    return json(401, { error: { http_code: 401, message: 'bad_signature' } });
  }

  // Georgian numbers only: 995 + 9 digits, no "+" (SMS Office format)
  const digits = (event.user.phone ?? '').replace(/\D/g, '');
  if (!/^995\d{9}$/.test(digits)) return json(400, { error: { http_code: 400, message: 'unsupported_phone' } });
  if (!/^\d{4,8}$/.test(event.sms.otp)) return json(400, { error: { http_code: 400, message: 'bad_code' } });

  const key = Deno.env.get('SMSOFFICE_KEY');
  if (!key) return json(500, { error: { http_code: 500, message: 'sms_not_configured' } });

  // Latin text keeps it to one SMS segment (Georgian letters would split into 70-character segments).
  const body = new URLSearchParams({
    key, destination: digits, sender: Deno.env.get('SMS_SENDER') ?? 'smsoffice',
    content: `Gochits kodi: ${event.sms.otp}`, urgent: 'true',
  });
  try {
    const res = await fetch('https://smsoffice.ge/api/v2/send/', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    const out = await res.json().catch(() => null) as { Success?: boolean; Message?: string; ErrorCode?: number } | null;
    if (!res.ok || !out?.Success) {
      console.error('smsoffice failed', res.status, out?.ErrorCode, out?.Message);
      return json(502, { error: { http_code: 502, message: 'sms_provider_failed' } });
    }
    return json(200, {});
  } catch (e) {
    console.error('smsoffice error', e);
    return json(502, { error: { http_code: 502, message: 'sms_provider_unreachable' } });
  }
});
