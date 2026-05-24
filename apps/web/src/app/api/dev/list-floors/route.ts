import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

// Dev-only — lists floor directories under public/floors/
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const floorsDir = path.join(process.cwd(), "public", "floors");
  try {
    const entries = await readdir(floorsDir, { withFileTypes: true });
    const floors = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    return NextResponse.json({ floors });
  } catch {
    return NextResponse.json({ floors: [] });
  }
}
