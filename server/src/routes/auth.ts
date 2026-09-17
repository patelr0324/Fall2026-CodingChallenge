import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User";
import { requireAuth, signToken, type AuthedRequest } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/, "username must be letters, numbers, or underscore"),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  login: z.string().trim().min(1),
  password: z.string().min(1),
});

function publicUser(user: {
  _id: { toString(): string };
  username: string;
  email: string;
}) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
  };
}

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid input", details: parsed.error.flatten() });
    return;
  }

  const { username, email, password } = parsed.data;

  const existing = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existing) {
    res.status(409).json({ error: "username or email already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, email, passwordHash });
  const token = signToken({ userId: user._id.toString() });

  res.status(201).json({ token, user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid input" });
    return;
  }

  const login = parsed.data.login.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: login }, { username: login }],
  });

  if (!user) {
    res.status(401).json({ error: "invalid credentials" });
    return;
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "invalid credentials" });
    return;
  }

  const token = signToken({ userId: user._id.toString() });
  res.json({ token, user: publicUser(user) });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.auth!.userId).select("username email");
  if (!user) {
    res.status(404).json({ error: "user not found" });
    return;
  }
  res.json({ user: publicUser(user) });
});

export default router;
