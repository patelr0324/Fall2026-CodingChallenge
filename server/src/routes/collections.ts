import { Router } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { Collection } from "../models/Collection";
import { CollectionItem } from "../models/CollectionItem";
import { SavedImage } from "../models/SavedImage";
import { User } from "../models/User";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { ensureLibrary } from "../services/library";

const router = Router();

const createSchema = z.object({
  title: z.string().trim().min(1).max(80),
  visibility: z.enum(["private", "public"]).optional().default("private"),
});

const patchSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  visibility: z.enum(["private", "public"]).optional(),
});

const addItemSchema = z.union([
  z.object({
    savedImageId: z.string().trim().min(1),
  }),
  z.object({
    pixabayId: z.string().trim().min(1),
    imageUrl: z.string().trim().url(),
    previewUrl: z.string().trim().url(),
    tags: z.string().trim().optional().default(""),
  }),
]);

const moveSchema = z.object({
  toCollectionId: z.string().trim().min(1),
});

const collaboratorSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/),
});

function makeShareSlug(): string {
  return crypto.randomBytes(6).toString("base64url");
}

async function loadCollaborators(
  collaboratorIds: { toString(): string }[] | undefined
) {
  const ids = (collaboratorIds ?? []).map((id) => id.toString());
  if (ids.length === 0) return [] as { id: string; username: string }[];
  const users = await User.find({ _id: { $in: ids } }).select("username");
  return users.map((u) => ({
    id: u._id.toString(),
    username: u.username,
  }));
}

function publicCollection(doc: {
  _id: { toString(): string };
  ownerId: { toString(): string };
  title: string;
  visibility: string;
  isLibrary?: boolean | null;
  shareSlug?: string | null;
  collaboratorIds?: { toString(): string }[];
}) {
  return {
    id: doc._id.toString(),
    ownerId: doc.ownerId.toString(),
    title: doc.title,
    visibility: doc.visibility,
    isLibrary: Boolean(doc.isLibrary),
    shareSlug: doc.shareSlug ?? null,
    collaboratorIds: (doc.collaboratorIds ?? []).map((id) => id.toString()),
  };
}

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

function isObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

function paramId(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

async function findAccessibleCollection(collectionId: string, userId: string) {
  if (!isObjectId(collectionId)) return null;
  return Collection.findOne({
    _id: collectionId,
    $or: [{ ownerId: userId }, { collaboratorIds: userId }],
  });
}

function isOwner(
  collection: { ownerId: { toString(): string } },
  userId: string
): boolean {
  return collection.ownerId.toString() === userId;
}

async function resolveSavedImage(
  userId: string,
  data: z.infer<typeof addItemSchema>
) {
  if ("savedImageId" in data) {
    if (!isObjectId(data.savedImageId)) return null;
    return SavedImage.findOne({ _id: data.savedImageId, ownerId: userId });
  }

  const { pixabayId, imageUrl, previewUrl, tags } = data;
  return SavedImage.findOneAndUpdate(
    { ownerId: userId, pixabayId },
    { $set: { imageUrl, previewUrl, tags } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function addImageToCollection(
  collection: { _id: mongoose.Types.ObjectId },
  save: {
    _id: mongoose.Types.ObjectId;
    pixabayId: string;
    imageUrl: string;
    previewUrl: string;
    tags?: string | null;
  }
) {
  const existing = await CollectionItem.findOne({
    collectionId: collection._id,
    savedImageId: save._id,
  });
  if (existing) {
    return { conflict: true as const };
  }

  const last = await CollectionItem.findOne({ collectionId: collection._id })
    .sort({ order: -1 })
    .select("order");
  const order = (last?.order ?? -1) + 1;

  const item = await CollectionItem.create({
    collectionId: collection._id,
    savedImageId: save._id,
    order,
  });

  return {
    conflict: false as const,
    item: {
      itemId: item._id.toString(),
      order: item.order,
      savedImage: publicSave(save),
    },
  };
}

router.use(requireAuth);

/** GET /api/collections — ensures Library exists; library listed first */
router.get("/", async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  await ensureLibrary(userId);

  const collections = await Collection.find({
    $or: [{ ownerId: userId }, { collaboratorIds: userId }],
  }).sort({ isLibrary: -1, updatedAt: -1 });

  res.json({ collections: collections.map(publicCollection) });
});

/** POST /api/collections — create a normal board (not Library) */
router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid input", details: parsed.error.flatten() });
    return;
  }

  if (parsed.data.title.trim().toLowerCase() === "library") {
    res.status(400).json({ error: "library is reserved — use save to library instead" });
    return;
  }

  await ensureLibrary(req.auth!.userId);

  const collection = await Collection.create({
    ownerId: req.auth!.userId,
    title: parsed.data.title,
    visibility: parsed.data.visibility,
    isLibrary: false,
  });

  res.status(201).json({ collection: publicCollection(collection) });
});

/** POST /api/collections/library/items — save into the system Library */
router.post("/library/items", async (req: AuthedRequest, res) => {
  const parsed = addItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid input", details: parsed.error.flatten() });
    return;
  }

  const library = await ensureLibrary(req.auth!.userId);
  const save = await resolveSavedImage(req.auth!.userId, parsed.data);
  if (!save) {
    res.status(404).json({ error: "save not found" });
    return;
  }

  const result = await addImageToCollection(library, save);
  if (result.conflict) {
    res.status(409).json({ error: "already in library" });
    return;
  }

  res.status(201).json({
    collection: publicCollection(library),
    item: result.item,
  });
});

/** GET /api/collections/:id — board + items with image data */
router.get("/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "invalid collection id" });
    return;
  }
  const collection = await findAccessibleCollection(id, req.auth!.userId);
  if (!collection) {
    res.status(404).json({ error: "collection not found" });
    return;
  }

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
    collection: publicCollection(collection),
    items: images,
    collaborators: await loadCollaborators(collection.collaboratorIds),
  });
});

/** POST /api/collections/:id/share — make public + ensure share slug (owner) */
router.post("/:id/share", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "invalid collection id" });
    return;
  }
  const collection = await findAccessibleCollection(id, req.auth!.userId);
  if (!collection) {
    res.status(404).json({ error: "collection not found" });
    return;
  }
  if (!isOwner(collection, req.auth!.userId)) {
    res.status(403).json({ error: "only the owner can share this collection" });
    return;
  }
  if (collection.isLibrary) {
    res.status(403).json({ error: "library cannot be shared publicly" });
    return;
  }

  collection.visibility = "public";
  if (!collection.shareSlug) {
    collection.shareSlug = makeShareSlug();
  }
  await collection.save();

  res.json({
    collection: publicCollection(collection),
    sharePath: `/b/${collection.shareSlug}`,
  });
});

/** POST /api/collections/:id/unshare — make private (owner); link stops working */
router.post("/:id/unshare", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "invalid collection id" });
    return;
  }
  const collection = await findAccessibleCollection(id, req.auth!.userId);
  if (!collection) {
    res.status(404).json({ error: "collection not found" });
    return;
  }
  if (!isOwner(collection, req.auth!.userId)) {
    res.status(403).json({ error: "only the owner can unshare this collection" });
    return;
  }

  collection.visibility = "private";
  await collection.save();

  res.json({ collection: publicCollection(collection) });
});

/** POST /api/collections/:id/collaborators — invite editor by username (owner) */
router.post("/:id/collaborators", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "invalid collection id" });
    return;
  }

  const parsed = collaboratorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid input", details: parsed.error.flatten() });
    return;
  }

  const collection = await findAccessibleCollection(id, req.auth!.userId);
  if (!collection) {
    res.status(404).json({ error: "collection not found" });
    return;
  }
  if (!isOwner(collection, req.auth!.userId)) {
    res.status(403).json({ error: "only the owner can invite collaborators" });
    return;
  }
  if (collection.isLibrary) {
    res.status(403).json({ error: "library cannot have collaborators" });
    return;
  }

  const invitee = await User.findOne({ username: parsed.data.username });
  if (!invitee) {
    res.status(404).json({ error: "user not found" });
    return;
  }
  if (invitee._id.toString() === collection.ownerId.toString()) {
    res.status(400).json({ error: "owner is already on this board" });
    return;
  }

  const already = collection.collaboratorIds.some(
    (cid) => cid.toString() === invitee._id.toString()
  );
  if (already) {
    res.status(409).json({ error: "user is already a collaborator" });
    return;
  }

  collection.collaboratorIds.push(invitee._id);
  await collection.save();

  res.status(201).json({
    collection: publicCollection(collection),
    collaborators: await loadCollaborators(collection.collaboratorIds),
  });
});

/** DELETE /api/collections/:id/collaborators/:userId — remove editor (owner) */
router.delete("/:id/collaborators/:userId", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const userId = paramId(req.params.userId);
  if (!id || !userId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const collection = await findAccessibleCollection(id, req.auth!.userId);
  if (!collection) {
    res.status(404).json({ error: "collection not found" });
    return;
  }
  if (!isOwner(collection, req.auth!.userId)) {
    res.status(403).json({ error: "only the owner can remove collaborators" });
    return;
  }

  collection.collaboratorIds = collection.collaboratorIds.filter(
    (cid) => cid.toString() !== userId
  );
  await collection.save();

  res.json({
    collection: publicCollection(collection),
    collaborators: await loadCollaborators(collection.collaboratorIds),
  });
});

/** PATCH /api/collections/:id — rename / visibility (owner only; library title locked) */
router.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid input", details: parsed.error.flatten() });
    return;
  }

  const id = paramId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "invalid collection id" });
    return;
  }
  const collection = await findAccessibleCollection(id, req.auth!.userId);
  if (!collection) {
    res.status(404).json({ error: "collection not found" });
    return;
  }
  if (!isOwner(collection, req.auth!.userId)) {
    res.status(403).json({ error: "only the owner can update this collection" });
    return;
  }

  if (collection.isLibrary && parsed.data.title !== undefined) {
    res.status(403).json({ error: "library cannot be renamed" });
    return;
  }

  if (
    parsed.data.title !== undefined &&
    parsed.data.title.trim().toLowerCase() === "library"
  ) {
    res.status(400).json({ error: "library is a reserved name" });
    return;
  }

  if (parsed.data.title !== undefined) collection.title = parsed.data.title;
  if (parsed.data.visibility !== undefined) {
    collection.visibility = parsed.data.visibility;
  }
  await collection.save();

  res.json({ collection: publicCollection(collection) });
});

/** DELETE /api/collections/:id — delete board (library cannot be deleted) */
router.delete("/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "invalid collection id" });
    return;
  }
  const collection = await findAccessibleCollection(id, req.auth!.userId);
  if (!collection) {
    res.status(404).json({ error: "collection not found" });
    return;
  }
  if (!isOwner(collection, req.auth!.userId)) {
    res.status(403).json({ error: "only the owner can delete this collection" });
    return;
  }
  if (collection.isLibrary) {
    res.status(403).json({ error: "library cannot be deleted" });
    return;
  }

  await CollectionItem.deleteMany({ collectionId: collection._id });
  await collection.deleteOne();
  res.json({ ok: true });
});

/** POST /api/collections/:id/items — add image */
router.post("/:id/items", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "invalid collection id" });
    return;
  }
  const collection = await findAccessibleCollection(id, req.auth!.userId);
  if (!collection) {
    res.status(404).json({ error: "collection not found" });
    return;
  }

  const parsed = addItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid input", details: parsed.error.flatten() });
    return;
  }

  const save = await resolveSavedImage(req.auth!.userId, parsed.data);
  if (!save) {
    res.status(404).json({ error: "save not found" });
    return;
  }

  const result = await addImageToCollection(collection, save);
  if (result.conflict) {
    res.status(409).json({ error: "image already in this collection" });
    return;
  }

  res.status(201).json({ item: result.item });
});

/** POST /api/collections/:id/items/:savedImageId/move — move to another board */
router.post("/:id/items/:savedImageId/move", async (req: AuthedRequest, res) => {
  const fromId = paramId(req.params.id);
  const savedImageId = paramId(req.params.savedImageId);
  if (!fromId || !savedImageId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const parsed = moveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid input", details: parsed.error.flatten() });
    return;
  }

  const toId = parsed.data.toCollectionId;
  if (fromId === toId) {
    res.status(400).json({ error: "already on that board" });
    return;
  }

  const from = await findAccessibleCollection(fromId, req.auth!.userId);
  const to = await findAccessibleCollection(toId, req.auth!.userId);
  if (!from || !to) {
    res.status(404).json({ error: "collection not found" });
    return;
  }

  if (!isObjectId(savedImageId)) {
    res.status(400).json({ error: "invalid savedImageId" });
    return;
  }

  const existing = await CollectionItem.findOne({
    collectionId: from._id,
    savedImageId,
  });
  if (!existing) {
    res.status(404).json({ error: "item not found in collection" });
    return;
  }

  const alreadyThere = await CollectionItem.findOne({
    collectionId: to._id,
    savedImageId,
  });
  if (alreadyThere) {
    res.status(409).json({ error: "image already in the target collection" });
    return;
  }

  const last = await CollectionItem.findOne({ collectionId: to._id })
    .sort({ order: -1 })
    .select("order");
  const order = (last?.order ?? -1) + 1;

  await CollectionItem.create({
    collectionId: to._id,
    savedImageId,
    order,
  });
  await existing.deleteOne();

  const save = await SavedImage.findById(savedImageId);
  res.json({
    ok: true,
    fromCollectionId: fromId,
    toCollectionId: toId,
    savedImage: save ? publicSave(save) : null,
  });
});

/** DELETE /api/collections/:id/items/:savedImageId — remove from board */
router.delete("/:id/items/:savedImageId", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  const savedImageId = paramId(req.params.savedImageId);
  if (!id || !savedImageId) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const collection = await findAccessibleCollection(id, req.auth!.userId);
  if (!collection) {
    res.status(404).json({ error: "collection not found" });
    return;
  }

  if (!isObjectId(savedImageId)) {
    res.status(400).json({ error: "invalid savedImageId" });
    return;
  }

  const deleted = await CollectionItem.findOneAndDelete({
    collectionId: collection._id,
    savedImageId,
  });
  if (!deleted) {
    res.status(404).json({ error: "item not found in collection" });
    return;
  }

  res.json({ ok: true });
});

export default router;
