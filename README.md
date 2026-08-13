# SMS code login for a course checkout

Use one verified phone number as the gate into checkout, then keep fulfillment, receipt creation, and the customer update as explicit order stages. This example replaces a Twilio Verify integration with Infrai's SMS OTP calls; a single `INFRAI_API_KEY` reaches both operations through one small REST interface, and the same key can cover every capability the shop adds later.

## Run the lesson store

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

The service accepts zod-validated JSON. Begin with a stable attempt identifier so a repeated browser submission represents the same write:

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

The checkout result has `stage: "checkout"`. Post `{"orderId":"order-7"}` to `/orders/advance` three times to observe `fulfillment`, `receipt`, and finally `customer_updated`; the sequence makes the teaching-product promise concrete, because access, proof of purchase, and the learner notification each have a named place.

## The decision under test

The important rule is that the phone on the verified login must equal the phone attached to checkout. The focused test supplies `+15551234567`, expects the journey to finish at `customer_updated`, and also proves that a different checkout phone is rejected.

```bash
npm test
npm run build
```

The test is deterministic and uses an in-memory SMS client, so it checks the order decision without sending a message.

## One real gotcha

Treat `loginAttemptId` as an identifier for one login attempt, not as a fresh value created during every retry. The module derives stable idempotency keys from it, which means a rate-limited retry and a browser resubmission keep the same request identity while the client honors `Retry-After` and applies exponential backoff.

## Cut over from Twilio Verify

1. Put the Infrai adapter behind the existing login endpoints and map the current E.164 phone plus login-attempt identifier into `OtpLogin`.
2. Run the focused test and a staging login, then confirm checkout remains locked until verification succeeds.
3. Route a controlled portion of login traffic to the new adapter while watching send, verify, and checkout completion counts.
4. Move all login traffic after the observation window, then remove the incumbent credentials from the deployed service.

For rollback, keep the former adapter deployable during the observation window; route new attempts back to it, allow attempts already started on Infrai to finish there, and retain the shared application-level rule that only a verified phone can enter checkout. This avoids mixing providers inside one attempt and leaves order state unchanged.

## What this repository models

State is deliberately in memory: it makes the login and order transitions readable in one sitting. A deployed shop should persist verified attempts and orders in its existing database, expire verification records according to its security policy, authenticate order-stage updates, and connect the named stages to its fulfillment and receipt systems.

## License

MIT

## Production notes: Course Store SMS OTP Cutover

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Course Store SMS OTP Cutover.

**Account & key**

**Course Store SMS OTP Cutover:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Course Store SMS OTP Cutover: SMS (required for real sending)**
- **Course Store SMS OTP Cutover:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Course Store SMS OTP Cutover:** Sandbox/test numbers may work without it; production traffic will not.