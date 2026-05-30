import { Router } from "express";
import multer from "multer";
import { mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { getDb } from "@bloks/db";
import { parseFile } from "../lib/file-parser.js";

export const attachmentsRouter = Router();

const DATA_DIR = process.env["BLOKS_DATA_DIR"]
  ?? join(process.cwd(), ".bloks-data");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = join(DATA_DIR, "attachments");
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ext = extname(file.originalname);
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// POST /api/v1/attachments
attachmentsRouter.post("/", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ ok: false, error: { code: "NO_FILE", message: "파일이 없습니다." } });
    return;
  }

  try {
    const extracted_text = await parseFile(file.path, file.mimetype, file.originalname);

    const sb = getDb();
    const id = file.filename.replace(/\.[^.]+$/, "");
    const row = {
      id,
      filename: file.originalname,
      stored_path: file.path,
      mime_type: file.mimetype,
      size: file.size,
      extracted_text,
      created_at: new Date().toISOString(),
    };

    await sb.from("attachments").insert(row);

    res.json({
      ok: true,
      data: {
        id,
        filename: file.originalname,
        extracted_text: extracted_text.slice(0, 200),
      },
    });
  } catch (err) {
    console.error("[attachments] upload error", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "파일 처리 중 오류가 발생했습니다." } });
  }
});
