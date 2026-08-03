import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./config.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule.register({ config }));
  await app.listen(config.PORT);
  console.log(`Ordiva API listening on :${config.PORT}`);
}

void bootstrap();
