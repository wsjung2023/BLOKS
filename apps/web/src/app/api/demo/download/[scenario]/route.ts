import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const VALID = new Set(["homepage", "ppt", "program"]);
const REPORTS_DIR = path.resolve(process.cwd(), "../../tools/demo/reports");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ scenario: string }> }
) {
  const { scenario } = await params;

  if (!VALID.has(scenario)) {
    return new Response("Unknown scenario", { status: 400 });
  }

  const file = path.join(REPORTS_DIR, `${scenario}-result.pptx`);
  if (!existsSync(file)) {
    return new Response("PPTX not yet generated. Run the scenario first.", { status: 404 });
  }

  const data = readFileSync(file);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${scenario}-result.pptx"`,
      "Cache-Control": "no-store",
    },
  });
}
