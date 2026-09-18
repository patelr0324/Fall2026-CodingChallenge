import mongoose, { Schema, type InferSchemaType } from "mongoose";

const collectionItemSchema = new Schema(
  {
    collectionId: {
      type: Schema.Types.ObjectId,
      ref: "Collection",
      required: true,
      index: true,
    },
    savedImageId: {
      type: Schema.Types.ObjectId,
      ref: "SavedImage",
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

collectionItemSchema.index(
  { collectionId: 1, savedImageId: 1 },
  { unique: true }
);

export type CollectionItemDocument = InferSchemaType<
  typeof collectionItemSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const CollectionItem = mongoose.model(
  "CollectionItem",
  collectionItemSchema
);
