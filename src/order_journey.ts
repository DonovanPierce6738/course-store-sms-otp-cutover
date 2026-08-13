export type OrderStage = "checkout" | "fulfillment" | "receipt" | "customer_updated";

export type StoreOrder = {
  orderId: string;
  courseTitle: string;
  learnerPhone: string;
  stage: OrderStage;
};

export type VerifiedLogin = {
  phone: string;
  loginAttemptId: string;
  verified: true;
};

const nextStage: Record<OrderStage, OrderStage | undefined> = {
  checkout: "fulfillment",
  fulfillment: "receipt",
  receipt: "customer_updated",
  customer_updated: undefined,
};

export function beginCheckout(
  login: VerifiedLogin,
  input: { orderId: string; courseTitle: string; learnerPhone: string },
): StoreOrder {
  if (login.phone !== input.learnerPhone) {
    throw new Error("The verified learner must own the checkout phone number");
  }
  return { ...input, stage: "checkout" };
}

export function advanceOrder(order: StoreOrder): StoreOrder {
  const stage = nextStage[order.stage];
  if (!stage) return order;
  return { ...order, stage };
}
