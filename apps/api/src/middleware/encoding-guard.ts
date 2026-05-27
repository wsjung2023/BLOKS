import type { Request, Response, NextFunction } from "express";

function hasGarbled(val: unknown): boolean {
  if (typeof val === "string") {
    for (let i = 0; i < val.length; i++) {
      if (val.charCodeAt(i) === 0xFFFD) return true;
    }
    return false;
  }
  if (Array.isArray(val)) return val.some(hasGarbled);
  if (val && typeof val === "object") return Object.values(val).some(hasGarbled);
  return false;
}

export function encodingGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.body && hasGarbled(req.body)) {
    res.status(400).json({
      ok: false,
      error: {
        code: "ENCODING_ERROR",
        message: "\uc694\uccad \ubcf8\ubb38\uc5d0 \uc190\uc0c1\ub41c \ubb38\uc790(U+FFFD)\uac00 \ud3ec\ud568\ub418\uc5b4 \uc788\uc2b5\ub2c8\ub2e4.",
      },
    });
    return;
  }
  next();
}
