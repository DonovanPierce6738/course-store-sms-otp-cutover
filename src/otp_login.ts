import { createHash } from "node:crypto";
import { z } from "zod";
import type { SmsOtpClient } from "./infrai_sms.js";

export const requestCodeBody = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  loginAttemptId: z.string().min(8).max(100),
}).strict();

export const verifyCodeBody = requestCodeBody.extend({
  code: z.string().regex(/^\d{4,8}$/),
}).strict();

function requestKey(action: string, attemptId: string): string {
  return createHash("sha256").update(`${action}:${attemptId}`).digest("hex");
}

export class OtpLogin {
  private readonly sms: SmsOtpClient;

  constructor(sms: SmsOtpClient) {
    this.sms = sms;
  }

  async send(input: z.infer<typeof requestCodeBody>) {
    return this.sms.otp({
      to: input.phone,
      idempotency_key: requestKey("send", input.loginAttemptId),
    });
  }

  async verify(input: z.infer<typeof verifyCodeBody>) {
    await this.sms.verify({
      to: input.phone,
      code: input.code,
      idempotency_key: requestKey("verify", input.loginAttemptId),
    });
    return { phone: input.phone, loginAttemptId: input.loginAttemptId, verified: true as const };
  }
}
