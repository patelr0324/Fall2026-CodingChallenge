import mongoose, { Schema, type InferSchemaType } from "mongoose";

const savedImageSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pixabayId: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    previewUrl: {
      type: String,
      required: true,
      trim: true,
    },
    tags: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

savedImageSchema.index({ ownerId: 1, pixabayId: 1 }, { unique: true });

export type SavedImageDocument = InferSchemaType<typeof savedImageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SavedImage = mongoose.model("SavedImage", savedImageSchema);
