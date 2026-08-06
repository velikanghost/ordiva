import { Module, type DynamicModule } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import type { AgentWalletConfig } from "../config.js";
import { WalletsModule } from "../wallets/wallets.module.js";
import { AgentFundingService } from "./agent-funding.service.js";
import { AgentWalletController } from "./agent-wallet.controller.js";
import { AgentWallet, AgentWalletSchema } from "./agent-wallet.schema.js";
import { AgentWalletService } from "./agent-wallet.service.js";
import { AGENT_WALLET_CONFIG } from "./agent-wallet.tokens.js";
import { CircleDcwClient } from "./circle-dcw.client.js";
import { CircleUcwClient } from "./circle-ucw.client.js";
import { GatewayBalanceReader } from "./gateway-balance.reader.js";

export interface AgentWalletModuleOptions {
  config: AgentWalletConfig;
}

/**
 * Registered only when `agentWalletConfigured()` holds, matching how sourcing and
 * account routes already degrade: a missing entity secret leaves the feature
 * visibly absent rather than crashing boot or half-working.
 */
@Module({})
export class AgentWalletModule {
  static register(options: AgentWalletModuleOptions): DynamicModule {
    return {
      module: AgentWalletModule,
      imports: [
        MongooseModule.forFeature([{ name: AgentWallet.name, schema: AgentWalletSchema }]),
        WalletsModule
      ],
      controllers: [AgentWalletController],
      providers: [
        { provide: AGENT_WALLET_CONFIG, useValue: options.config },
        CircleDcwClient,
        CircleUcwClient,
        GatewayBalanceReader,
        AgentWalletService,
        AgentFundingService
      ],
      exports: [AgentWalletService, CircleDcwClient]
    };
  }
}
