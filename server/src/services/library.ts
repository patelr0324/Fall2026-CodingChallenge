import { Collection } from "../models/Collection";
import { CollectionItem } from "../models/CollectionItem";
import { SavedImage } from "../models/SavedImage";

/** Ensure the user has a single system Library board; migrate orphan saves into it. */
export async function ensureLibrary(userId: string) {
  let library = await Collection.findOne({ ownerId: userId, isLibrary: true });

  if (!library) {
    library = await Collection.create({
      ownerId: userId,
      title: "Library",
      visibility: "private",
      isLibrary: true,
    });

    const saves = await SavedImage.find({ ownerId: userId });
    let order = 0;
    for (const save of saves) {
      const inAny = await CollectionItem.exists({ savedImageId: save._id });
      if (inAny) continue;
      await CollectionItem.create({
        collectionId: library._id,
        savedImageId: save._id,
        order: order++,
      });
    }
  }

  return library;
}
