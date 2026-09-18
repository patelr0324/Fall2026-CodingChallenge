import { Router } from "express";
import { Collection } from "../models/Collection";
import { CollectionItem } from "../models/CollectionItem";
import { User } from "../models/User";

/** Public board views (no auth needed) */
const router = Router();

function publicSave(doc: {
  _id: { toString(): string };
  pixabayId: string;
  imageUrl: string;
  previewUrl: string;
  tags?: string | null;
}) {
  return {
    id: doc._id.toString(),
    pixabayId: doc.pixabayId,
    imageUrl: doc.imageUrl,
    previewUrl: doc.previewUrl,
    tags: doc.tags ?? "",
  };
}

/** GET /api/public/boards/:shareSlug — view a public board (no auth) */
router.get("/boards/:shareSlug", async (req, res) => {
  const slug =
    typeof req.params.shareSlug === "string" ? req.params.shareSlug.trim() : "";
  if (!slug) {
    res.status(400).json({ error: "invalid share link" });
    return;
  }

  const collection = await Collection.findOne({
    shareSlug: slug,
    visibility: "public",
  });
  if (!collection) {
    res.status(404).json({ error: "board not found or not public" });
    return;
  }

  const owner = await User.findById(collection.ownerId).select("username");
  const items = await CollectionItem.find({ collectionId: collection._id })
    .sort({ order: 1, createdAt: 1 })
    .populate("savedImageId");

  const images = items
    .map((item) => {
      const save = item.savedImageId as unknown as {
        _id: { toString(): string };
        pixabayId: string;
        imageUrl: string;
        previewUrl: string;
        tags?: string | null;
      } | null;
      if (!save || typeof save !== "object" || !("imageUrl" in save)) {
        return null;
      }
      return {
        itemId: item._id.toString(),
        order: item.order,
        savedImage: publicSave(save),
      };
    })
    .filter(Boolean);

  res.json({
    collection: {
      id: collection._id.toString(),
      title: collection.title,
      visibility: collection.visibility,
      shareSlug: collection.shareSlug ?? null,
      ownerUsername: owner?.username ?? "unknown",
    },
    items: images,
  });
});

export default router;
