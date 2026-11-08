# Customer Service: orders from sales agents

Every order a rep submits lands in the **Orders** inbox for Customer Service (and Management) and can also be emailed to them automatically.

## What Customer Service can do
- Sign in and see **all** orders and customers (read only), the price list and stock.
- Change an order's **status** (Submitted → Confirmed → Delivered, or On Hold) and add **notes**.
- They cannot change the lines, prices, totals, customer or rep, and cannot create or delete orders.

## 1. Create the Customer Service login (one time)
1. Supabase → SQL Editor → run `010_customer_service.sql` **alone**, then run `010b_customer_service_policies.sql`.
2. Have the customer service person sign up on the app.
3. In the app: **Users → their name → Role → Customer Service → Save**.

## 2. Email each new order (optional)
1. Create a Resend account (same one as the daily digest) and get the API key.
2. In a terminal:
   `supabase functions deploy order-notify --no-verify-jwt`
   `supabase secrets set RESEND_API_KEY=<key> CS_EMAIL=customerservice@yourcompany.com APP_URL=https://<your-vercel-app>.vercel.app DIGEST_SECRET=<long random text>`
   (several addresses can be separated by commas; reuse the same DIGEST_SECRET as the digest)
3. Supabase → Database → Webhooks → Create: table `orders`, event **Insert**, type **Supabase Edge Function**, pick `order-notify`, add HTTP header `x-digest-secret` = your DIGEST_SECRET.
4. Test: place an order as a rep. The email arrives within seconds.

Until CS_EMAIL is set, nothing is emailed; the in-app inbox works regardless.
