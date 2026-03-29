import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function getJwtSecret(): string {
  return process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"] ?? "";
}

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "이메일/비밀번호 형식이 올바르지 않습니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const founderEmail = process.env["FOUNDER_EMAIL"];
  const founderPassword = process.env["FOUNDER_PASSWORD"];
  const jwtSecret = getJwtSecret();

  if (!founderEmail || !founderPassword || !jwtSecret) {
    res.status(500).json({
      ok: false,
      error: { code: "SERVER_CONFIG_ERROR", message: "인증 환경변수가 설정되지 않았습니다." },
    });
    return;
  }

  const { email, password } = parsed.data;
  if (email !== founderEmail || password !== founderPassword) {
    res.status(401).json({
      ok: false,
      error: { code: "INVALID_CREDENTIALS", message: "이메일 또는 비밀번호가 올바르지 않습니다." },
    });
    return;
  }

  const token = jwt.sign({ sub: "founder", role: "founder" }, jwtSecret, { expiresIn: "12h" });

  res.json({
    ok: true,
    data: {
      token,
      tokenType: "Bearer",
      expiresInSec: 60 * 60 * 12,
      user: { id: "founder", role: "founder", email: founderEmail },
    },
  });
});
