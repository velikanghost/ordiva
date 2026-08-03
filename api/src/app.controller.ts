import { Controller, Get } from "@nestjs/common";
import { ARC_TESTNET_CAIP2 } from "./config.js";

@Controller()
export class AppController {
  @Get("healthz")
  health() {
    return { ok: true, network: ARC_TESTNET_CAIP2 };
  }
}
