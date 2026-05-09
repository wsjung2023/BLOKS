import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

// Dev-only endpoint — saves layout.json to public/floors/{floor}/
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const floor = req.nextUrl.searchParams.get("floor");
  if (!floor || !/^[a-z0-9-]+$/.test(floor)) {
    return NextResponse.json({ error: "Invalid floor" }, { status: 400 });
  }

  const body = await req.json();

  const publicDir = path.join(process.cwd(), "public", "floors", floor);
  const filePath = path.join(publicDir, "layout.json");

  await writeFile(filePath, JSON.stringify(body, null, 2), "utf-8");

  // Also save to client-assets for source of truth
  const assetsDir = path.join(process.cwd(), "..", "..", "client-assets", "world-rebuild", "floors", floor);
  try {
    await writeFile(path.join(assetsDir, "layout.json"), JSON.stringify(body, null, 2), "utf-8");
  } catch {
    // client-assets might not exist in all environments
  }

  return NextResponse.json({ ok: true, saved: filePath });
}
