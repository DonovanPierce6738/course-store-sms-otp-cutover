import assert from "node:assert/strict";
import test from "node:test";
import type { SmsOtpClient } from "../src/infrai_sms.js";
import { OtpLogin } from "../src/otp_login.js";
import { advanceOrder, beginCheckout } from "../src/order_journey.js";

test("a verified learner can check out and complete the order journey", async () => {
  const calls: string[] = [];
  const sms: SmsOtpClient = {
    otp: async () => { calls.push("code_sent"); return {}; },
    verify: async () => { calls.push("code_verified"); return {}; },
  };
  const login = new OtpLogin(sms);
  const attempt = { phone: "+15551234567", loginAttemptId: "lesson-42", code: "482731" };

  await login.send(attempt);
  const verified = await login.verify(attempt);
  let order = beginCheckout(verified, {
    orderId: "order-7",
    courseTitle: "Practical TypeScript",
    learnerPhone: attempt.phone,
  });
  order = advanceOrder(order);
  order = advanceOrder(order);
  order = advanceOrder(order);

  assert.deepEqual(calls, ["code_sent", "code_verified"]);
  assert.equal(order.stage, "customer_updated");
  assert.throws(() => beginCheckout(verified, { ...order, learnerPhone: "+15557654321" }));
});
