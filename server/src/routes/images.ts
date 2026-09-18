import { Router } from "express";
import { z } from "zod";

/** Pixabay proxy */
const router = Router();

const PIXABAY_COLORS = [
  "grayscale",
  "transparent",
  "red",
  "orange",
  "yellow",
  "green",
  "turquoise",
  "blue",
  "lilac",
  "pink",
  "white",
  "gray",
  "black",
  "brown",
] as const;

const discoverQuery = z.object({
  q: z.string().trim().optional().default(""),
  page: z.coerce.number().int().min(1).max(50).optional().default(1),
  perPage: z.coerce.number().int().min(3).max(60).optional().default(40),
  colors: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
    )
    .pipe(z.array(z.enum(PIXABAY_COLORS)).max(PIXABAY_COLORS.length)),
  /** omit = auto (editors' picks when q empty); "true"/"false" = force */
  editorsChoice: z.enum(["true", "false"]).optional(),
});

type PixabayHit = {
  id: number;
  webformatURL: string;
  largeImageURL: string;
  previewURL: string;
  tags: string;
  user: string;
  imageWidth: number;
  imageHeight: number;
};

/** GET /api/images/discover?q=&page=&perPage=&colors=&editorsChoice= */
router.get("/discover", async (req, res) => {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) {
    res.status(500).json({ error: "PIXABAY_API_KEY is not configured" });
    return;
  }

  const parsed = discoverQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid query", details: parsed.error.flatten() });
    return;
  }

  const { q, page, perPage, colors, editorsChoice } = parsed.data;
  const params = new URLSearchParams({
    key,
    image_type: "photo",
    safesearch: "true",
    order: "popular",
    page: String(page),
    per_page: String(perPage),
  });
  if (q) params.set("q", q);
  if (colors.length > 0) params.set("colors", colors.join(","));
  // blank search → editors' picks; typed search → popular for that query
  const useEditors =
    editorsChoice === "true" || (!q && editorsChoice !== "false");
  if (useEditors) params.set("editors_choice", "true");

  try {
    const upstream = await fetch(`https://pixabay.com/api/?${params.toString()}`);
    if (!upstream.ok) {
      res.status(502).json({ error: "pixabay request failed" });
      return;
    }

    const data = (await upstream.json()) as {
      totalHits: number;
      hits: PixabayHit[];
    };

    const images = (data.hits ?? []).map((hit) => ({
      pixabayId: String(hit.id),
      imageUrl: hit.largeImageURL || hit.webformatURL,
      previewUrl: hit.webformatURL || hit.previewURL,
      tags: hit.tags ?? "",
      photographer: hit.user ?? "",
      width: hit.imageWidth,
      height: hit.imageHeight,
    }));

    const totalHits = data.totalHits ?? images.length;
    res.json({
      totalHits,
      page,
      perPage,
      hasMore: page * perPage < totalHits && images.length > 0,
      images,
    });
  } catch {
    res.status(502).json({ error: "could not reach pixabay" });
  }
});

export default router;
