import { Module, type DynamicModule } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdaptersModule, type AdaptersModuleOptions } from "./adapters/adapters.module.js";
import { AgentWalletModule } from "./agent-wallet/agent-wallet.module.js";
import { AppController } from "./app.controller.js";
import { AuthModule } from "./auth/auth.module.js";
import { accountsConfigured, agentWalletConfigured, sourcingConfigured } from "./config.js";
import { SourcingModule } from "./sourcing/sourcing.module.js";

@Module({})
export class AppModule {
  static register(options: AdaptersModuleOptions): DynamicModule {
    const imports: DynamicModule[] = [AdaptersModule.register(options)];
    if (accountsConfigured(options.config)) {
      imports.push(
        MongooseModule.forRoot(options.config.MONGODB_URI),
        AuthModule.register({ config: options.config, fetch: options.fetch })
      );
      if (sourcingConfigured(options.config)) {
        imports.push(SourcingModule.register({ config: options.config, fetch: options.fetch }));
      }
      if (agentWalletConfigured(options.config)) {
        imports.push(AgentWalletModule.register({ config: options.config }));
      }
    }

    return {
      module: AppModule,
      imports,
      controllers: [AppController]
    };
  }
}
