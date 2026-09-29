// POST /api/report: Turnstile check, Zoho lead, report email via Resend, sales notification.
// Leads are never lost: if Zoho fails the lead is queued in KV and retried (see retry-leads.ts).
import { validate, resultFor, zohoLead, reportEmail, leadDescription } from '../../src/server/report';
import { createLead, flushQueue, queueLead, sendEmail, verifyTurnstile, type Env } from '../../src/server/integrations';

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  if (Number(request.headers.get('content-length') ?? 0) > 20_000) return json(413, { error: 'too_large' });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'bad_json' });
  }

  const v = validate(body);
  if (!v.ok) return json(422, { error: 'invalid', fields: v.errors });
  const { req, freeMail } = v;

  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  if (!(await verifyTurnstile(env, req.turnstileToken, ip))) return json(403, { error: 'turnstile' });

  const now = new Date();
  const result = resultFor(req);
  const lead = zohoLead(req, result, freeMail, now, env.ZOHO_SUBSOURCE_FIELD ?? 'Lead_Sub_Source');

  try {
    await createLead(env, lead);
  } catch (err) {
    console.error('zoho_failed', String(err));
    await queueLead(env, lead);
  }

  const email = reportEmail(req, result);
  const tasks: Promise<unknown>[] = [
    sendEmail(env, { to: req.email, subject: email.subject, html: email.html, text: email.text }),
  ];
  if (env.SALES_NOTIFY_TO) {
    tasks.push(
      sendEmail(env, {
        to: env.SALES_NOTIFY_TO,
        subject: `New sagereseller.com report request: ${req.company} (${result.outcome})`,
        text: `${req.name}, ${req.role}, ${req.company} <${req.email}>\n\n${leadDescription(req, result, freeMail, now)}`,
      }),
    );
  }
  const sent = await Promise.allSettled(tasks);
  if (sent[0].status === 'rejected') {
    console.error('report_email_failed', String(sent[0].reason));
    return json(502, { error: 'email' });
  }

  waitUntil(flushQueue(env).catch((e) => console.error('flush_failed', String(e))));
  return json(200, { ok: true, outcome: result.outcome });
};

export const onRequest: PagesFunction = async () => json(405, { error: 'method_not_allowed' });
