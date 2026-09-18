import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Friendship } from "../models/Friendship";
import { User } from "../models/User";
import { Collection } from "../models/Collection";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

/** friend graph: search, pending requests, accept/cancel, friends' public boards */
const router = Router();

const requestSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/),
});

function paramId(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function publicUser(user: {
  _id: { toString(): string };
  username: string;
}) {
  return {
    id: user._id.toString(),
    username: user.username,
  };
}

async function findRelation(userA: string, userB: string) {
  return Friendship.findOne({
    $or: [
      { requesterId: userA, recipientId: userB },
      { requesterId: userB, recipientId: userA },
    ],
  });
}

router.use(requireAuth);

/** GET /api/friends — accepted friends */
router.get("/", async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  const rows = await Friendship.find({
    status: "accepted",
    $or: [{ requesterId: userId }, { recipientId: userId }],
  });

  const friendIds = rows.map((row) =>
    row.requesterId.toString() === userId
      ? row.recipientId
      : row.requesterId
  );

  const users = await User.find({ _id: { $in: friendIds } }).select("username");
  res.json({ friends: users.map(publicUser) });
});

/** GET /api/friends/requests — pending incoming + outgoing */
router.get("/requests", async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  const [incomingRows, outgoingRows] = await Promise.all([
    Friendship.find({
      recipientId: userId,
      status: "pending",
    }).sort({ createdAt: -1 }),
    Friendship.find({
      requesterId: userId,
      status: "pending",
    }).sort({ createdAt: -1 }),
  ]);

  const relatedIds = [
    ...incomingRows.map((r) => r.requesterId),
    ...outgoingRows.map((r) => r.recipientId),
  ];
  const users = await User.find({ _id: { $in: relatedIds } }).select(
    "username"
  );
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  res.json({
    incoming: incomingRows
      .map((row) => {
        const user = byId.get(row.requesterId.toString());
        if (!user) return null;
        return {
          id: row._id.toString(),
          from: publicUser(user),
          createdAt: row.get("createdAt"),
        };
      })
      .filter(Boolean),
    outgoing: outgoingRows
      .map((row) => {
        const user = byId.get(row.recipientId.toString());
        if (!user) return null;
        return {
          id: row._id.toString(),
          to: publicUser(user),
          createdAt: row.get("createdAt"),
        };
      })
      .filter(Boolean),
  });
});

/** GET /api/friends/search?q= — find users by username prefix */
router.get("/search", async (req: AuthedRequest, res) => {
  const q =
    typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  if (q.length < 1) {
    res.json({ users: [] });
    return;
  }

  const userId = req.auth!.userId;
  const users = await User.find({
    _id: { $ne: userId },
    username: { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
  })
    .select("username")
    .limit(12);

  const relations = await Friendship.find({
    $or: [
      { requesterId: userId, recipientId: { $in: users.map((u) => u._id) } },
      { recipientId: userId, requesterId: { $in: users.map((u) => u._id) } },
    ],
  });

  const statusByUser = new Map<string, string>();
  for (const rel of relations) {
    const other =
      rel.requesterId.toString() === userId
        ? rel.recipientId.toString()
        : rel.requesterId.toString();
    if (rel.status === "accepted") statusByUser.set(other, "friends");
    else if (rel.requesterId.toString() === userId)
      statusByUser.set(other, "outgoing");
    else statusByUser.set(other, "incoming");
  }

  res.json({
    users: users.map((u) => ({
      ...publicUser(u),
      relation: statusByUser.get(u._id.toString()) ?? "none",
    })),
  });
});

/** GET /api/friends/feed — friends' public boards */
router.get("/feed", async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  const rows = await Friendship.find({
    status: "accepted",
    $or: [{ requesterId: userId }, { recipientId: userId }],
  });

  const friendIds = rows.map((row) =>
    row.requesterId.toString() === userId
      ? row.recipientId
      : row.requesterId
  );

  if (friendIds.length === 0) {
    res.json({ boards: [] });
    return;
  }

  const boards = await Collection.find({
    ownerId: { $in: friendIds },
    visibility: "public",
    isLibrary: false,
  })
    .sort({ updatedAt: -1 })
    .limit(40);

  const owners = await User.find({ _id: { $in: friendIds } }).select(
    "username"
  );
  const ownerById = new Map(
    owners.map((u) => [u._id.toString(), u.username])
  );

  res.json({
    boards: boards.map((b) => ({
      id: b._id.toString(),
      title: b.title,
      shareSlug: b.shareSlug ?? null,
      ownerUsername: ownerById.get(b.ownerId.toString()) ?? "unknown",
      updatedAt: b.get("updatedAt"),
    })),
  });
});

/** POST /api/friends/request — send friend request by username */
router.post("/request", async (req: AuthedRequest, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid username" });
    return;
  }

  const userId = req.auth!.userId;
  const target = await User.findOne({ username: parsed.data.username });
  if (!target) {
    res.status(404).json({ error: "user not found" });
    return;
  }
  if (target._id.toString() === userId) {
    res.status(400).json({ error: "cannot friend yourself" });
    return;
  }

  const existing = await findRelation(userId, target._id.toString());
  if (existing) {
    if (existing.status === "accepted") {
      res.status(409).json({ error: "already friends" });
      return;
    }
    if (existing.requesterId.toString() === userId) {
      res.status(409).json({ error: "request already sent" });
      return;
    }
    // they already requested you — accept instead
    existing.status = "accepted";
    await existing.save();
    res.json({
      friendship: {
        id: existing._id.toString(),
        status: "accepted",
        user: publicUser(target),
      },
    });
    return;
  }

  const friendship = await Friendship.create({
    requesterId: userId,
    recipientId: target._id,
    status: "pending",
  });

  res.status(201).json({
    friendship: {
      id: friendship._id.toString(),
      status: "pending",
      user: publicUser(target),
    },
  });
});

/** POST /api/friends/requests/:id/accept */
router.post("/requests/:id/accept", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: "invalid request id" });
    return;
  }

  const row = await Friendship.findOne({
    _id: id,
    recipientId: req.auth!.userId,
    status: "pending",
  });
  if (!row) {
    res.status(404).json({ error: "request not found" });
    return;
  }

  row.status = "accepted";
  await row.save();

  const from = await User.findById(row.requesterId).select("username");
  res.json({
    friendship: {
      id: row._id.toString(),
      status: "accepted",
      user: from ? publicUser(from) : null,
    },
  });
});

/** POST /api/friends/requests/:id/reject */
router.post("/requests/:id/reject", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: "invalid request id" });
    return;
  }

  const deleted = await Friendship.findOneAndDelete({
    _id: id,
    recipientId: req.auth!.userId,
    status: "pending",
  });
  if (!deleted) {
    res.status(404).json({ error: "request not found" });
    return;
  }

  res.json({ ok: true });
});

/** POST /api/friends/requests/:id/cancel — cancel your outgoing request */
router.post("/requests/:id/cancel", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: "invalid request id" });
    return;
  }

  const deleted = await Friendship.findOneAndDelete({
    _id: id,
    requesterId: req.auth!.userId,
    status: "pending",
  });
  if (!deleted) {
    res.status(404).json({ error: "request not found" });
    return;
  }

  res.json({ ok: true });
});

/** DELETE /api/friends/:userId — unfriend */
router.delete("/:userId", async (req: AuthedRequest, res) => {
  const otherId = paramId(req.params.userId);
  if (!otherId || !mongoose.Types.ObjectId.isValid(otherId)) {
    res.status(400).json({ error: "invalid user id" });
    return;
  }

  const userId = req.auth!.userId;
  const deleted = await Friendship.findOneAndDelete({
    status: "accepted",
    $or: [
      { requesterId: userId, recipientId: otherId },
      { requesterId: otherId, recipientId: userId },
    ],
  });

  if (!deleted) {
    res.status(404).json({ error: "friendship not found" });
    return;
  }

  res.json({ ok: true });
});

export default router;
