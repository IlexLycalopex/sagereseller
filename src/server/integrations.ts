// Network integrations for the Pages Functions. All secrets come from Cloudflare env vars.

export interface Env {
  TURNSTILE_SECRET?: string;
  ALLOW_NO_TURNSTILE?: string; // "true" only in local dev
  ZOHO_CLIENT_ID?: string;
  ZOHO_CLIENT_SECRET?: string;
  ZOHO_REFRESH_TOKEN?: string;
  ZOHO_ACCOUNTS_URL?: string; // e.g. https://accounts.zoho.eu
  ZOHO_API_DOMAIN?: string; // e.g. https://www.zohoapis.eu
  ZOHO_SUBSOURCE_FIELD?: string; // API name of the Lead Sub-Source field
  RESEND_API_KEY?: string;
  REPORT_FROM?: string; // e.g. "Jamie Watts <guide@mail.sagereseller.com>"
  REPORT_REPLY_TO?: string;
  SALES_NOTIFY_TO?: string;
  RETRY_TOKEN?: string;
  LEAD_QUEUE?: KVNamespace;
}

export async function verifyTurnstile(env: Env, token: string, ip?: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return env.ALLOW_NO_TURNSTILE === 'true';
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

async function zohoToken(env: Env): Promise<string> {
  if (!env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET || !env.ZOHO_REFRESH_TOKEN) throw new Error('zoho_not_configured');
  const url = new URL('/oauth/v2/token', env.ZOHO_ACCOUNTS_URL ?? 'https://accounts.zoho.eu');
  url.search = new URLSearchParams({
    refresh_token: env.ZOHO_REFRESH_TOKEN,
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  }).toString();
  const res = await fetch(url, { method: 'POST' });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`zoho_token_${data.error ?? res.status}`);
  return data.access_token;
}

/** Create or update a lead, matching on email. Throws on any failure so the caller can queue. */
export async function createLead(env: Env, lead: Record<string, unknown>): Promise<void> {
  const token = await zohoToken(env);
  const res = await fetch(new URL('/crm/v6/Leads/upsert', env.ZOHO_API_DOMAIN ?? 'https://www.zohoapis.eu'), {
    method: 'POST',
    headers: { authorization: `Zoho-oauthtoken ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ data: [lead], duplicate_check_fields: ['Email'] }),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { status?: string; message?: string }[] };
  const row = data.data?.[0];
  if (!res.ok || row?.status !== 'success') throw new Error(`zoho_upsert_${res.status}_${row?.message ?? 'unknown'}`);
}

export async function queueLead(env: Env, lead: Record<string, unknown>): Promise<void> {
  if (!env.LEAD_QUEUE) {
    // No KV bound: log the full lead so it can be recovered from Cloudflare logs.
    console.error('lead_unqueued', JSON.stringify(lead));
    return;
  }
  const key = `lead:${Date.now()}:${crypto.randomUUID()}`;
  await env.LEAD_QUEUE.put(key, JSON.stringify({ lead, attempts: 0 }));
}

export async function flushQueue(env: Env): Promise<{ delivered: number; remaining: number }> {
  if (!env.LEAD_QUEUE) return { delivered: 0, remaining: 0 };
  const list = await env.LEAD_QUEUE.list({ prefix: 'lead:' });
  let delivered = 0;
  for (const k of list.keys) {
    const item = await env.LEAD_QUEUE.get<{ lead: Record<string, unknown>; attempts: number }>(k.name, 'json');
    if (!item) continue;
    try {
      await createLead(env, item.lead);
      await env.LEAD_QUEUE.delete(k.name);
      delivered++;
    } catch (err) {
      item.attempts++;
      console.error('lead_retry_failed', k.name, item.attempts, String(err));
      await env.LEAD_QUEUE.put(k.name, JSON.stringify(item));
    }
  }
  return { delivered, remaining: list.keys.length - delivered };
}

export async function sendEmail(env: Env, msg: { to: string; subject: string; html?: string; text: string }): Promise<void> {
  if (!env.RESEND_API_KEY || !env.REPORT_FROM) throw new Error('resend_not_configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.REPORT_FROM,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      reply_to: env.REPORT_REPLY_TO,
    }),
  });
  if (!res.ok) throw new Error(`resend_${res.status}_${await res.text()}`);
}
