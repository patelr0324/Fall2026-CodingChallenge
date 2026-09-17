import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type AuthPayload = {
  userId: string;
};

export type AuthedRequest = Request & {
  auth?: AuthPayload;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }
  return secret;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing token" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthPayload;
    if (!decoded.userId) {
      res.status(401).json({ error: "invalid token" });
      return;
    }
    req.auth = { userId: decoded.userId };
    next();
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
}
