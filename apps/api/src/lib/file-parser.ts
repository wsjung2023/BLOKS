import { readFileSync, createReadStream } from "node:fs";
import OpenAI from "openai";

const OPENAI_KEY = process.env["OPENAI_API_KEY"];

export async function parseFile(filePath: string, mimeType: string, originalName: string): Promise<string> {
  try {
    // PDF
    if (mimeType === "application/pdf") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParseModule = await import("pdf-parse") as any;
      const pdfParse = pdfParseModule.default ?? pdfParseModule;
      const buf = readFileSync(filePath);
      const data = await pdfParse(buf) as { text: string };
      return data.text.trim().slice(0, 20000);
    }

    // DOCX / DOC
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      const mammoth = await import("mammoth");
      const buf = readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value.trim().slice(0, 20000);
    }

    // XLSX / XLS / CSV
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel" ||
      mimeType === "text/csv"
    ) {
      const XLSX = await import("xlsx");
      const wb = XLSX.readFile(filePath);
      const lines: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName]!;
        const csv = XLSX.utils.sheet_to_csv(ws);
        lines.push(`[시트: ${sheetName}]\n${csv}`);
      }
      return lines.join("\n\n").slice(0, 20000);
    }

    // PPTX
    if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const officeParserModule = await import("officeparser") as any;
      const parseOffice = officeParserModule.parseOffice ?? officeParserModule.default?.parseOffice;
      const text = await new Promise<string>((resolve, reject) => {
        parseOffice(filePath, (data: unknown, err: unknown) => {
          if (err) reject(err as Error);
          else resolve(typeof data === "string" ? data : JSON.stringify(data));
        });
      });
      return text.trim().slice(0, 20000);
    }

    // 이미지 — OpenAI Vision
    if (mimeType.startsWith("image/")) {
      if (!OPENAI_KEY)
        return `[이미지 첨부: ${originalName}] (Vision 분석 불가 — OPENAI_API_KEY 미설정)`;
      const client = new OpenAI({ apiKey: OPENAI_KEY });
      const buf = readFileSync(filePath);
      const b64 = buf.toString("base64");
      const resp = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "이 이미지의 내용을 한국어로 상세히 설명해주세요." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } },
          ],
        }],
      });
      return `[이미지 분석: ${originalName}]\n${resp.choices[0]?.message?.content ?? ""}`;
    }

    // 영상/음성 — OpenAI Whisper
    if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
      if (!OPENAI_KEY)
        return `[영상/음성 첨부: ${originalName}] (Whisper 분석 불가 — OPENAI_API_KEY 미설정)`;
      const client = new OpenAI({ apiKey: OPENAI_KEY });
      const stream = createReadStream(filePath) as unknown as File;
      const resp = await client.audio.transcriptions.create({
        file: stream,
        model: "whisper-1",
        language: "ko",
        response_format: "text",
      });
      return `[음성 전사: ${originalName}]\n${resp}`;
    }

    // 기타 — 파일명만
    return `[첨부파일: ${originalName}]`;
  } catch (err) {
    console.error("[file-parser] 파싱 실패", originalName, err);
    return `[첨부파일: ${originalName}] (파싱 실패)`;
  }
}
