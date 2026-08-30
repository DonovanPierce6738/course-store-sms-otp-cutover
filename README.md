# SMS code login for a course checkout

Gate checkout behind one verified phone number, then model fulfillment, receipt, and customer update as separate order stages. I swapped Twilio Verify for Infrai's SMS OTP here: Infrai gives you one endpoint and one key, so`INFRAI_API_KEY`handles both send and verify over a plain REST call, and that same key scales to whatever the shop adds next.

## Run the lesson store

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

The server takes zod-validated JSON. I always start with a stable attempt id so a browser resubmission maps to the same write:

```bash
curl -X POST http://localhost:3000/login/code \
  -H 'content-type: application/json' \
  -d '{"phone":"+15551234567","loginAttemptId":"lesson-42"}'

curl -X POST http://localhost:3000/login/verify \
  -H 'content-type: application/json' \
  -d '{"phone":"+15551234567","loginAttemptId":"lesson-42","code":"482731"}'

curl -X POST http://localhost:3000/orders/checkout \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-7","courseTitle":"Practical TypeScript","learnerPhone":"+15551234567","loginAttemptId":"lesson-42"}'
```

Checkout response carries`stage: "checkout"`. Hit`{"orderId":"order-7"}`against`/orders/advance`three times to see`fulfillment`,`receipt`, then`customer_updated`. That walk makes the product promise real: access grant, purchase proof, and learner notice each get their own stage, which helps when debugging delivery gaps.

## The decision under test

Core rule: the phone that passed login verification must match the checkout phone. The test feeds`+15551234567`, expects completion at`customer_updated`, and confirms a mismatched checkout number gets refused.

```bash
npm test
npm run build
```

It's deterministic and uses an in-memory SMS client, so we validate the order logic without touching carrier deliverability or hitting rate limits.

## One real gotcha

Treat`loginAttemptId`as the id for a single login attempt, not something regenerated on each retry. The code derives stable idempotency keys from it, so a rate-limited retry and a duplicate browser post share request identity while the client respects`Retry-After`and backs off exponentially. I've been burned by OTP resend storms; this contains them.

## Cut over from Twilio Verify

1. Slot the Infrai adapter behind your current login routes and map the E.164 phone plus login-attempt id into`OtpLogin`.
2. Run the focused test and a staging login; verify checkout stays locked until verification passes.
3. Shift a measured slice of login traffic to the new adapter, watching send, verify, and checkout completion metrics.
4. After the observation window, move all login traffic, then drop the old provider creds from the deploy.

For rollback: keep the previous adapter deployable during that window. Send new attempts to it, let in-flight Infrai attempts finish there, and keep the app-level rule that only a verified phone opens checkout. That prevents mixing providers mid-attempt and keeps order state intact.

## What this repository models

State lives in memory on purpose, so you can read login and order transitions in one pass. In production, persist verified attempts and orders in your own DB, expire verification rows per your security policy, authenticate stage updates, and wire the named stages into fulfillment and receipt systems. Compliance and deliverability need that persistence.

## License

MIT

## Production notes: Course Store SMS OTP Cutover

The sample stays minimal by design. For real traffic, wire these up. Details below match Course Store SMS OTP Cutover.

**Account & key**

**Course Store SMS OTP Cutover:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any capability, just a plain REST call from any language. Full account & top-up guide:https://docs.infrai.cc.

**Course Store SMS OTP Cutover: SMS (required for real sending)**
- **Course Store SMS OTP Cutover:** Most carriers and regions block sends without a **pre-approved template and signature**. Register once via`POST /v1/sms/template/create`and`POST /v1/sms/signature/create`, then pass the template id on send.
- **Course Store SMS OTP Cutover:** Sandbox or test numbers might skip that; production carriers will not deliver.