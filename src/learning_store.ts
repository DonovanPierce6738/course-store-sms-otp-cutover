import { createServer } from "node:http";
import { ZodError, z } from "zod";
import { smsOtpClient } from "./infrai_sms.js";
import { OtpLogin, requestCodeBody, verifyCodeBody } from "./otp_login.js";
import { advanceOrder, beginCheckout } from "./order_journey.js";

const checkoutBody = z.object({
  orderId: z.string().min(1),
  courseTitle: z.string().min(1),
  learnerPhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  loginAttemptId: z.string().min(8),
}).strict();

const logins = new Map<string, { phone: string; loginAttemptId: string; verified: true }>();
const orders = new Map<string, ReturnType<typeof beginCheckout>>();
const otp = new OtpLogin(smsOtpClient);

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method !== "POST") return json(response, 405, { error: "POST required" });
    const body = await readJson(request);

    if (request.url === "/login/code") {
      const input = requestCodeBody.parse(body);
      await otp.send(input);
      return json(response, 202, { loginAttemptId: input.loginAttemptId, codeSent: true });
    }
    if (request.url === "/login/verify") {
      const login = await otp.verify(verifyCodeBody.parse(body));
      logins.set(login.loginAttemptId, login);
      return json(response, 200, login);
    }
    if (request.url === "/orders/checkout") {
      const input = checkoutBody.parse(body);
      const login = logins.get(input.loginAttemptId);
      if (!login) return json(response, 401, { error: "Verify the login code before checkout" });
      const order = beginCheckout(login, input);
      orders.set(order.orderId, order);
      return json(response, 201, order);
    }
    if (request.url === "/orders/advance") {
      const { orderId } = z.object({ orderId: z.string().min(1) }).strict().parse(body);
      const order = orders.get(orderId);
      if (!order) return json(response, 404, { error: "Order not found" });
      const updated = advanceOrder(order);
      orders.set(orderId, updated);
      return json(response, 200, updated);
    }
    return json(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof ZodError) return json(response, 400, { error: "Invalid request body", issues: error.issues });
    return json(response, 500, { error: error instanceof Error ? error.message : "Request failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Learning store listening on http://localhost:${port}`));
