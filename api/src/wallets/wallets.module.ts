import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Wallet, WalletSchema } from "./wallet.schema.js";
import { WalletsService } from "./wallets.service.js";

@Module({
  imports: [MongooseModule.forFeature([{ name: Wallet.name, schema: WalletSchema }])],
  providers: [WalletsService],
  exports: [WalletsService]
})
export class WalletsModule {}
