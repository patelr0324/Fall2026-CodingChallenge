import mongoose, { Schema, type InferSchemaType } from "mongoose";

const friendshipSchema = new Schema(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

friendshipSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });

export type FriendshipDocument = InferSchemaType<typeof friendshipSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Friendship = mongoose.model("Friendship", friendshipSchema);
