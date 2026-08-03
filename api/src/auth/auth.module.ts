import { Module, type DynamicModule } from "@nestjs/common";
import type { AccountsConfig } from "../config.js";
import { UsersModule } from "../users/users.module.js";
import { WalletsModule } from "../wallets/wallets.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { AUTH_CONFIG, AUTH_FETCH } from "./auth.constants.js";
import { CircleWalletsClient } from "./circle-wallets.client.js";
import { SessionGuard } from "./session.guard.js";
import { SessionTokenService } from "./session-token.service.js";

export interface AuthModuleOptions {
  config: AccountsConfig;
  fetch?: typeof fetch;
}

@Module({})
export class AuthModule {
  static register(options: AuthModuleOptions): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      imports: [UsersModule, WalletsModule],
      controllers: [AuthController],
      providers: [
        { provide: AUTH_CONFIG, useValue: options.config },
        { provide: AUTH_FETCH, useValue: options.fetch ?? fetch },
        CircleWalletsClient,
        SessionTokenService,
        SessionGuard,
        AuthService
      ],
      exports: [SessionTokenService, SessionGuard]
    };
  }
}
