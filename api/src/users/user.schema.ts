import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ collection: "users", timestamps: true })
export class User {
  @Prop({ type: String, required: true, unique: true, index: true })
  circleUserId!: string;

  @Prop({ type: String, required: true, enum: ["active"], default: "active" })
  status!: "active";

  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
