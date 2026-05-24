import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Dev-only endpoint — saves a base64 PNG as topdown.png (and stage-clean.png)
// under public/floors/{floor}/background/
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const floor = req.nextUrl.searchParams.get("floor");
  if (!floor || !/^[a-z0-9-]+$/.test(floor)) {
    return NextResponse.json({ error: "Invalid floor id" }, { status: 400 });
  }

  const { base64 } = await req.json() as { base64: string };
  const buffer = Buffer.from(base64, "base64");

  const bgDir = path.join(process.cwd(), "public", "floors", floor, "background");
  await mkdir(bgDir, { recursive: true });

  await Promise.all([
    writeFile(path.join(bgDir, "topdown.png"), buffer),
    writeFile(path.join(bgDir, "stage-clean.png"), buffer),
  ]);

  return NextResponse.json({ ok: true, floor });
}
