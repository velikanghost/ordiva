import type { RequestHandler } from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import type { AppConfig } from "../config.js";
import { ARC_TESTNET_CAIP2 } from "../config.js";

export interface PaymentGate {
  require(price: string): RequestHandler;
}

export function createCirclePaymentGate(config: AppConfig): PaymentGate {
  const gateway = createGatewayMiddleware({
    sellerAddress: config.ARC_ADAPTER_SELLER_ADDRESS,
    facilitatorUrl: config.CIRCLE_GATEWAY_FACILITATOR_URL,
    networks: [ARC_TESTNET_CAIP2],
    description: "Ordiva conventional API adapter"
  });

  return {
    require: (price) => gateway.require(price)
  };
}
