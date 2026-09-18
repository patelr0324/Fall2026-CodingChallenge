import mongoose, { Schema, type InferSchemaType } from "mongoose";

const collectionSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    visibility: {
      type: String,
      enum: ["private", "public"],
      default: "private",
    },
    /** library board (cannot rename/delete/share; its basically quick saves) */
    isLibrary: {
      type: Boolean,
      default: false,
      index: true,
    },
    /** unique token for public URL `/b/:shareSlug` */
    shareSlug: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    collaboratorIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
  },
  { timestamps: true }
);

collectionSchema.index(
  { ownerId: 1, isLibrary: 1 },
  {
    unique: true,
    partialFilterExpression: { isLibrary: true },
  }
);

export type CollectionDocument = InferSchemaType<typeof collectionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Collection = mongoose.model("Collection", collectionSchema);
