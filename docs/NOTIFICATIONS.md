# Email notifications (daily summary)

Reps get one email each morning with follow-ups due, unread messages and customers who stopped ordering.
Managers get a team summary: wins and accepted quotes from the last day, reps who have gone quiet, and the largest overdue balances.
Nobody gets an email on a day when they have nothing to act on.

In-app alerts (the bell in the menu) work without any of this setup. The email needs the steps below.
This part has not been run against a live project from the build environment, so check the first send.

## 1. Resend account (sends the email)
1. Create a free account at resend.com and create an **API key**.
2. For testing you can send from `onboarding@resend.dev` (it only delivers to your own address).
   For real use, add and verify your own domain in Resend (Domains) and use an address such as `growthhub@yourdomain.com`.

## 2. Deploy the function (Supabase CLI, run in the project folder)
```bash
npm i -g supabase            # or: npx supabase ...
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set RESEND_API_KEY=<key> DIGEST_FROM="PG Growth Hub <growthhub@yourdomain.com>" APP_URL=https://<your-vercel-app>.vercel.app DIGEST_SECRET=<any long random text> BIG_WIN_MONTHLY_VALUE=2000
supabase functions deploy daily-digest --no-verify-jwt
```
`DIGEST_SECRET` stops anyone else from triggering the function.

## 3. Test it
```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/daily-digest -H "x-digest-secret: <the same secret>"
```
It answers `{"sent": N, "problems": []}`.

## 4. Schedule it for 7:30 am Guam time (21:30 UTC the day before)
In the Supabase SQL Editor (enable **pg_cron** and **pg_net** under Database, Extensions first):
```sql
select cron.schedule('pg-daily-digest', '30 21 * * *', $$
  select net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/daily-digest',
    headers := jsonb_build_object('x-digest-secret', '<the same secret>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
$$);
```
To stop it: `select cron.unschedule('pg-daily-digest');`

## Text messages (SMS)
Not included. It needs a Twilio account, phone numbers for each rep and per-message fees. The same function can be extended to send through Twilio once those exist.
