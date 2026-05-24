import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const { slug, data } = (await req.json()) as { slug: string; data: string };

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid slug" }, { status: 400 });
  }

  const buf = Buffer.from(data, "base64");
  const filePath = path.join(process.cwd(), "public", "assets", "characters", `${slug}.png`);
  await writeFile(filePath, buf);

  return NextResponse.json({ ok: true });
}
