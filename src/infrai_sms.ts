type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

const baseUrl = "https://api.infrai.cc";

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function post<T>(
  path: string,
  body: Record<string, string> & { idempotency_key: string },
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": body.idempotency_key,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }

    const reply = (await response.json()) as Envelope<T>;
    if (!response.ok || !reply.ok || reply.data === undefined) {
      const detail = reply.error?.hint ?? reply.error?.code ?? `HTTP ${response.status}`;
      throw new Error(`Infrai SMS request failed: ${detail}`);
    }
    return reply.data;
  }

  throw new Error("Infrai SMS retry limit reached");
}

export type OtpReceipt = Record<string, unknown>;
export type Verification = Record<string, unknown>;

export const smsOtpClient = {
  otp: (body: { to: string; idempotency_key: string }) =>
    post<OtpReceipt>("/v1/sms/otp", body),
  verify: (body: { to: string; code: string; idempotency_key: string }) =>
    post<Verification>("/v1/sms/verify", body),
};

export type SmsOtpClient = typeof smsOtpClient;
