const key = process.env.OPENAI_API_KEY;
const prompts = [
  { name: "office-desk", text: "isometric pixel art top-down 45 degree view of a single office desk with glowing monitor, coffee mug, papers. Cute chibi cozy corporate game style. Soft warm lighting, clean background, game asset ready" },
  { name: "char-executive", text: "cute chibi character sprite isometric view, corporate CEO in dark suit with gold tie, tiny round head, big eyes, standing pose. Cozy office simulation game style. White background" },
  { name: "char-engineer", text: "cute chibi character sprite isometric view, software engineer with dark hoodie and headphones, tired but focused expression. Cozy game style. White background" },
];

for (const p of prompts) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-image-1", prompt: p.text, n: 1, size: "1024x1024", quality: "medium" }),
  });
  const json = await res.json();
  if (json.error) { console.error(`ERROR ${p.name}:`, json.error.message); continue; }
  const b64 = json.data[0].b64_json;
  const fs = await import("fs");
  fs.writeFileSync(`D:/Projects/BLOKS-dev/client-assets/sprites/${p.name}.png`, Buffer.from(b64, "base64"));
  console.log(`✅ ${p.name}.png saved`);
}
