import { Router } from "express";
import { z } from "zod";
import { SavedImage } from "../models/SavedImage";
import { CollectionItem } from "../models/CollectionItem";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

const router = Router();

const saveSchema = z.object({
  pixabayId: z.string().trim().min(1),
  imageUrl: z.string().trim().url(),
  previewUrl: z.string().trim().url(),
  tags: z.string().trim().optional().default(""),
});

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

router.use(requireAuth);

/** GET /api/saves — list current user's saved images */
router.get("/", async (req: AuthedRequest, res) => {
  const saves = await SavedImage.find({ ownerId: req.auth!.userId }).sort({
    createdAt: -1,
  });
  res.json({ saves: saves.map(publicSave) });
});

/** POST /api/saves — upsert a Pixabay image into the user's library */
router.post("/", async (req: AuthedRequest, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid input", details: parsed.error.flatten() });
    return;
  }

  const { pixabayId, imageUrl, previewUrl, tags } = parsed.data;
  const ownerId = req.auth!.userId;

  const save = await SavedImage.findOneAndUpdate(
    { ownerId, pixabayId },
    { $set: { imageUrl, previewUrl, tags } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({ save: publicSave(save) });
});

/** DELETE /api/saves/:id — remove from library if not used in a collection */
router.delete("/:id", async (req: AuthedRequest, res) => {
  const save = await SavedImage.findOne({
    _id: req.params.id,
    ownerId: req.auth!.userId,
  });
  if (!save) {
    res.status(404).json({ error: "save not found" });
    return;
  }

  const inUse = await CollectionItem.exists({ savedImageId: save._id });
  if (inUse) {
    res.status(409).json({
      error: "image is still in a collection; remove it from boards first",
    });
    return;
  }

  await save.deleteOne();
  res.json({ ok: true });
});

export default router;
