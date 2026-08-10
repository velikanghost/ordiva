import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { User, type UserDocument } from "./user.schema.js";

export interface UserView {
  id: string;
  circleUserId: string;
  email: string;
  status: "active";
}

function toView(user: UserDocument): UserView {
  return {
    id: user._id.toString(),
    circleUserId: user.circleUserId,
    email: user.email,
    status: user.status
  };
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly users: Model<UserDocument>) {}

  async upsertVerifiedIdentity(circleUserId: string, email: string): Promise<UserView> {
    const user = await this.users.findOneAndUpdate(
      { circleUserId },
      {
        $set: { status: "active", email },
        $setOnInsert: { circleUserId }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    if (!user) throw new Error("MongoDB did not return the upserted user");
    return toView(user);
  }

  async getById(id: string): Promise<UserView> {
    const user = await this.users.findById(id).exec();
    if (!user) throw new NotFoundException("User not found");
    return toView(user);
  }
}
