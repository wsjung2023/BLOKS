/**
 * BLOKS MCP Tool Registry
 *
 * BLOKS 전체 사업 영역을 커버하는 AI 툴 모음.
 * 각 툴은 AI가 작업 중 필요할 때 직접 호출합니다.
 *
 * 사업 영역:
 *  - 웹/인터넷: web_search, fetch_url
 *  - 미디어 제작: generate_image, generate_video, generate_qr
 *  - 프로그램 개발: execute_code, search_npm, search_github, search_docs
 *  - SAP/ABAP: search_sap_notes, abap_pattern, bapi_search, sap_transaction_info
 *  - 데이터/금융: calculate, exchange_rate, parse_data
 *  - 법률/컴플라이언스: search_korean_law
 *  - 마케팅: hashtag_research
 *  - 커뮤니케이션: send_email
 *  - 유틸리티: get_current_datetime
 */

import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { searchWeb } from "./search.js";
import { generateImage } from "./image.js";
import { generateVideo } from "./video.js";

// ── Tool interface ────────────────────────────────────────────────────────────

export interface BloksTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
  execute(input: Record<string, unknown>): Promise<string>;
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

async function safeFetch(url: string, options?: RequestInit): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), ...options });
  return res.text();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  웹/인터넷
// ═══════════════════════════════════════════════════════════════════════════════

const webSearchTool: BloksTool = {
  name: "web_search",
  description: "인터넷에서 최신 정보를 검색합니다. 시장 조사, 경쟁사 분석, 트렌드, 통계, 최신 뉴스를 찾을 때 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "검색어" },
      num_results: { type: "string", description: "결과 수", enum: ["3", "5", "8"] },
    },
    required: ["query"],
  },
  async execute(input) {
    const query = String(input["query"] ?? "");
    const num = parseInt(String(input["num_results"] ?? "5"), 10);
    const result = await searchWeb(query, num);
    if (result.results.length === 0) return `"${query}" 검색 결과 없음.`;
    return result.results.map((r, i) => `[${i + 1}] ${r.title}\n출처: ${r.url}\n${r.snippet}`).join("\n\n");
  },
};

const fetchUrlTool: BloksTool = {
  name: "fetch_url",
  description: "특정 웹페이지의 내용을 가져옵니다. 경쟁사 사이트, 뉴스, 문서 참조에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "가져올 URL" },
    },
    required: ["url"],
  },
  async execute(input) {
    const url = String(input["url"] ?? "");
    try {
      const text = await safeFetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; BLOKS-AI/1.0)" } });
      const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000);
      return `[${url}]\n${clean}`;
    } catch {
      return `URL 접근 실패: ${url}`;
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  유틸리티
// ═══════════════════════════════════════════════════════════════════════════════

const getDatetimeTool: BloksTool = {
  name: "get_current_datetime",
  description: "현재 날짜/시간을 반환합니다. 보고서, 일정, 쿠폰 유효기간 설정에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      format: { type: "string", description: "형식", enum: ["full", "date", "year_month"] },
    },
    required: [],
  },
  async execute(input) {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const fmt = String(input["format"] ?? "full");
    if (fmt === "date") return kst.toISOString().slice(0, 10);
    if (fmt === "year_month") return kst.toISOString().slice(0, 7);
    return `${kst.toISOString().slice(0, 10)} (${["일","월","화","수","목","금","토"][kst.getDay()]}요일)`;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  미디어 제작
// ═══════════════════════════════════════════════════════════════════════════════

const generateImageTool: BloksTool = {
  name: "generate_image",
  description: "AI로 이미지를 생성합니다. 광고 배너, 포스터, 쿠폰, 제품 이미지 제작에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "영어로 이미지를 상세히 설명하세요." },
      style: { type: "string", description: "스타일", enum: ["photorealistic", "illustration", "minimalist", "vintage", "bold"] },
    },
    required: ["prompt"],
  },
  async execute(input) {
    const prompt = String(input["prompt"] ?? "");
    const style = String(input["style"] ?? "");
    const full = style ? `${prompt}, ${style} style` : prompt;
    const result = await generateImage({ prompt: full });
    if (!result.ok) return `이미지 생성 실패: ${result.errorCode}`;
    const src = result.imageUrl ?? `data:${result.mimeType};base64,${result.imageBase64}`;
    return `![generated](${src})\n> ${result.provider} / ${result.modelUsed}`;
  },
};

const generateVideoTool: BloksTool = {
  name: "generate_video",
  description: "AI로 광고/홍보 영상을 생성합니다. 릴스, 쇼츠, 유튜브 광고에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "영어로 영상 내용을 설명하세요." },
      aspect_ratio: { type: "string", description: "화면 비율", enum: ["16:9", "9:16", "1:1"] },
      duration: { type: "string", description: "길이(초)", enum: ["5", "10"] },
    },
    required: ["prompt"],
  },
  async execute(input) {
    const prompt = String(input["prompt"] ?? "");
    const ratio = String(input["aspect_ratio"] ?? "16:9") as "16:9" | "9:16" | "1:1";
    const dur = String(input["duration"] ?? "5") as "5" | "10";
    const result = await generateVideo({ prompt, aspectRatio: ratio, duration: dur, model: "kling-2.6" });
    if (!result.ok || !result.videoUrl) return `영상 생성 실패: ${result.errorCode}`;
    return `[VIDEO](${result.videoUrl})\n> ${result.provider} / ${result.modelUsed}`;
  },
};

const generateQrTool: BloksTool = {
  name: "generate_qr",
  description: "QR 코드를 생성합니다. 쿠폰, 랜딩 페이지, 이벤트 페이지 QR에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      data: { type: "string", description: "QR에 담을 내용 (URL, 텍스트 등)" },
      size: { type: "string", description: "크기(px)", enum: ["200", "300", "400"] },
    },
    required: ["data"],
  },
  async execute(input) {
    const data = String(input["data"] ?? "");
    const size = String(input["size"] ?? "300");
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
    return `![QR Code](${url})\n> QR 데이터: ${data}`;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  프로그램 개발
// ═══════════════════════════════════════════════════════════════════════════════

const executeCodeTool: BloksTool = {
  name: "execute_code",
  description: "Node.js 코드를 실행하고 결과를 반환합니다. 알고리즘 검증, 데이터 변환, 계산 테스트에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      code: { type: "string", description: "실행할 JavaScript/Node.js 코드" },
      timeout_ms: { type: "string", description: "타임아웃(ms)", enum: ["3000", "5000", "10000"] },
    },
    required: ["code"],
  },
  async execute(input) {
    const code = String(input["code"] ?? "");
    const timeout = parseInt(String(input["timeout_ms"] ?? "5000"), 10);
    const tmpFile = join(tmpdir(), `bloks_exec_${Date.now()}.mjs`);
    try {
      writeFileSync(tmpFile, code, "utf-8");
      const result = execSync(`node "${tmpFile}"`, { timeout, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
      return `실행 결과:\n${result.slice(0, 2000)}`;
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      return `오류:\n${e.stderr ?? e.message ?? String(err)}`.slice(0, 1000);
    } finally {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  },
};

const searchNpmTool: BloksTool = {
  name: "search_npm",
  description: "npm 패키지를 검색합니다. 필요한 라이브러리를 찾을 때 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "검색할 패키지 이름/키워드" },
    },
    required: ["query"],
  },
  async execute(input) {
    const query = String(input["query"] ?? "");
    try {
      const text = await safeFetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=5`);
      const data = JSON.parse(text) as { objects: Array<{ package: { name: string; version: string; description?: string; links: { npm: string } } }> };
      return data.objects.map(o =>
        `📦 ${o.package.name} v${o.package.version}\n${o.package.description ?? ""}\n${o.package.links.npm}`
      ).join("\n\n");
    } catch {
      return `npm 검색 실패: ${query}`;
    }
  },
};

const searchGithubTool: BloksTool = {
  name: "search_github",
  description: "GitHub에서 코드 예제, 레포지토리, 솔루션을 검색합니다.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "검색할 코드/기술 키워드" },
      type: { type: "string", description: "검색 유형", enum: ["repositories", "code", "both"] },
    },
    required: ["query"],
  },
  async execute(input) {
    const query = String(input["query"] ?? "");
    const result = await searchWeb(`${query} site:github.com`, 5);
    if (result.results.length === 0) return `GitHub 검색 결과 없음: ${query}`;
    return result.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n");
  },
};

const searchDocsTool: BloksTool = {
  name: "search_docs",
  description: "개발 문서를 검색합니다. MDN, React, Node.js, TypeScript 등 공식 문서 참조에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "검색할 기술/API 이름" },
      platform: { type: "string", description: "플랫폼", enum: ["mdn", "nodejs", "react", "typescript", "nextjs", "any"] },
    },
    required: ["query"],
  },
  async execute(input) {
    const query = String(input["query"] ?? "");
    const platform = String(input["platform"] ?? "any");
    const siteMap: Record<string, string> = {
      mdn: "site:developer.mozilla.org",
      nodejs: "site:nodejs.org",
      react: "site:react.dev",
      typescript: "site:typescriptlang.org",
      nextjs: "site:nextjs.org",
    };
    const site = siteMap[platform] ?? "";
    const result = await searchWeb(`${query} ${site} documentation`.trim(), 5);
    if (result.results.length === 0) return `문서 검색 결과 없음: ${query}`;
    return result.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n");
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SAP / ABAP 개발
// ═══════════════════════════════════════════════════════════════════════════════

const SAP_TCODE_DB: Record<string, string> = {
  SE38: "ABAP 에디터 — 프로그램 개발/수정",
  SE37: "Function Builder — 함수 모듈 개발",
  SE11: "Data Dictionary — 테이블/구조체/도메인 정의",
  SE16: "Data Browser — 테이블 데이터 조회",
  SE80: "Object Navigator — 개발 객체 통합 관리",
  SM30: "Table View Maintenance",
  SPRO: "Customizing — 시스템 설정",
  SU01: "User Maintenance",
  AL11: "SAP 디렉토리 파일 목록",
  SM37: "Background Job 모니터링",
  ST05: "Performance Trace — SQL 튜닝",
  SM21: "System Log",
  STMS: "Transport Management System",
  SE09: "Transport Organizer",
  WE02: "IDoc 모니터링",
  BD54: "Logical System 설정",
  PFCG: "Role Maintenance — 권한",
  SU53: "권한 체크 분석",
  VA01: "판매 오더 생성", VA02: "판매 오더 변경", VA03: "판매 오더 조회",
  MM01: "자재 마스터 생성", MM02: "자재 마스터 변경",
  ME21N: "구매 오더 생성", ME22N: "구매 오더 변경",
  FB01: "전표 입력", FB60: "벤더 인보이스 입력",
  PP01: "작업 계획 생성",
  IW31: "서비스 오더 생성", IW32: "서비스 오더 변경",
};

const sapTransactionTool: BloksTool = {
  name: "sap_transaction_info",
  description: "SAP 트랜잭션 코드(T-code)의 용도와 사용법을 조회합니다.",
  inputSchema: {
    type: "object",
    properties: {
      tcode: { type: "string", description: "SAP 트랜잭션 코드 (예: SE38, VA01)" },
    },
    required: ["tcode"],
  },
  async execute(input) {
    const tcode = String(input["tcode"] ?? "").toUpperCase().trim();
    const local = SAP_TCODE_DB[tcode];
    if (local) return `T-code ${tcode}: ${local}`;
    // 없으면 웹 검색
    const result = await searchWeb(`SAP T-code ${tcode} transaction purpose`, 3);
    if (result.results.length > 0) {
      return `T-code ${tcode} 검색 결과:\n${result.results.map(r => `${r.title}: ${r.snippet}`).join("\n")}`;
    }
    return `T-code ${tcode} 정보 없음.`;
  },
};

const ABAP_PATTERNS: Record<string, string> = {
  "select_single": `SELECT SINGLE field1 field2
  FROM ztable
  INTO ls_data
  WHERE key_field = lv_key.
IF sy-subrc = 0.
  " 처리
ENDIF.`,
  "select_loop": `SELECT field1 field2
  FROM ztable
  INTO TABLE lt_data
  WHERE condition = lv_val.
LOOP AT lt_data INTO ls_data.
  " 처리
ENDLOOP.`,
  "function_module": `FUNCTION z_my_function.
*"--------------------------------------------------------------
*"*"Local Interface:
*"  IMPORTING  VALUE(IV_PARAM) TYPE  CHAR30
*"  EXPORTING  VALUE(EV_RESULT) TYPE  CHAR100
*"  EXCEPTIONS MY_EXCEPTION
*"--------------------------------------------------------------
  " 로직
  IF iv_param IS INITIAL.
    RAISE my_exception.
  ENDIF.
  ev_result = iv_param.
ENDFUNCTION.`,
  "class": `CLASS zcl_my_class DEFINITION.
  PUBLIC SECTION.
    METHODS: constructor,
             do_something IMPORTING iv_input TYPE string
                          RETURNING VALUE(rv_result) TYPE string.
  PRIVATE SECTION.
    DATA: mv_data TYPE string.
ENDCLASS.

CLASS zcl_my_class IMPLEMENTATION.
  METHOD constructor.
  ENDMETHOD.
  METHOD do_something.
    rv_result = iv_input.
  ENDMETHOD.
ENDCLASS.`,
  "bapi_call": `DATA: ls_return TYPE bapiret2,
      lt_return TYPE TABLE OF bapiret2.

CALL FUNCTION 'BAPI_NAME'
  EXPORTING
    input_param = lv_value
  IMPORTING
    output_param = ls_output
  TABLES
    return = lt_return.

CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'
  EXPORTING
    wait = 'X'.`,
  "error_handling": `TRY.
  " 처리 로직
  CATCH cx_sy_arithmetic_error INTO DATA(lx_arith).
    MESSAGE lx_arith->get_text( ) TYPE 'E'.
  CATCH cx_root INTO DATA(lx_root).
    MESSAGE lx_root->get_text( ) TYPE 'E'.
ENDTRY.`,
  "field_symbols": `FIELD-SYMBOLS: <ls_data> TYPE any.
LOOP AT lt_data ASSIGNING <ls_data>.
  <ls_data>-field = 'value'.
ENDLOOP.`,
};

const abapPatternTool: BloksTool = {
  name: "abap_pattern",
  description: "검증된 ABAP 코드 패턴과 템플릿을 제공합니다. SELECT, LOOP, FM, Class, BAPI 호출 등.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "필요한 패턴",
        enum: ["select_single", "select_loop", "function_module", "class", "bapi_call", "error_handling", "field_symbols"],
      },
    },
    required: ["pattern"],
  },
  async execute(input) {
    const pattern = String(input["pattern"] ?? "");
    const code = ABAP_PATTERNS[pattern];
    if (!code) return `패턴 없음: ${pattern}`;
    return `ABAP 패턴 — ${pattern}:\n\`\`\`abap\n${code}\n\`\`\``;
  },
};

const COMMON_BAPIS: Record<string, string[]> = {
  "SD (판매)": ["BAPI_SALESORDER_CREATEFROMDAT2", "BAPI_SALESORDER_CHANGE", "BAPI_SALESORDER_GETLIST", "BAPI_DELIVERYPROCESSING_EXEC"],
  "MM (구매)": ["BAPI_PO_CREATE1", "BAPI_PO_CHANGE", "BAPI_PO_GETDETAIL", "BAPI_GOODSMVT_CREATE"],
  "FI (재무)": ["BAPI_ACC_DOCUMENT_POST", "BAPI_PAYMENT_DOCUMS_GET", "BAPI_GL_GETGLACCBALANCE"],
  "HR (인사)": ["BAPI_EMPLOYEE_GETDATA", "BAPI_PERSDATA_GETDETAILEDLIST", "BAPI_EMPLOYEE_ENQUEUE"],
  "PM (설비)": ["BAPI_ALM_ORDER_MAINTAIN", "BAPI_ALM_NOTIF_CREATE", "BAPI_WORKCENTER_GET_LIST"],
  "PP (생산)": ["BAPI_PRODORD_CREATE", "BAPI_PRODORD_GET_DETAIL", "BAPI_GOODSMVT_CREATE"],
};

const bapiSearchTool: BloksTool = {
  name: "bapi_search",
  description: "업무 요건에 맞는 SAP BAPI를 찾습니다. 판매, 구매, 재무, 인사 등 모듈별 BAPI를 제공합니다.",
  inputSchema: {
    type: "object",
    properties: {
      module: { type: "string", description: "SAP 모듈", enum: ["SD", "MM", "FI", "HR", "PM", "PP", "all"] },
      keyword: { type: "string", description: "기능 키워드 (예: 판매오더 생성, 전표 포스팅)" },
    },
    required: ["keyword"],
  },
  async execute(input) {
    const module = String(input["module"] ?? "all").toUpperCase();
    const keyword = String(input["keyword"] ?? "");

    let found = "";
    if (module === "all") {
      found = Object.entries(COMMON_BAPIS)
        .map(([mod, bapis]) => `【${mod}】\n${bapis.join("\n")}`)
        .join("\n\n");
    } else {
      const key = Object.keys(COMMON_BAPIS).find(k => k.startsWith(module));
      found = key ? `【${key}】\n${COMMON_BAPIS[key]!.join("\n")}` : "";
    }

    // 웹에서 추가 검색
    const webResult = await searchWeb(`SAP BAPI ${keyword} function module`, 3);
    const webInfo = webResult.results.length > 0
      ? `\n\n웹 검색 결과:\n${webResult.results.map(r => `${r.title}: ${r.snippet}`).join("\n")}`
      : "";

    return (found || "해당 모듈 BAPI 목록 없음") + webInfo;
  },
};

const searchSapNotesTool: BloksTool = {
  name: "search_sap_notes",
  description: "SAP OSS 노트, 에러 코드, 기술 가이드를 검색합니다. 오류 해결, 기능 가이드, 패치 정보 조회에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "SAP 에러 메시지, 노트 번호, 또는 기술 키워드" },
    },
    required: ["query"],
  },
  async execute(input) {
    const query = String(input["query"] ?? "");
    const result = await searchWeb(`SAP ${query} note solution site:help.sap.com OR site:launchpad.support.sap.com`, 5);
    if (result.results.length === 0) {
      const general = await searchWeb(`SAP ABAP ${query} solution fix`, 5);
      if (general.results.length === 0) return `SAP 노트 검색 결과 없음: ${query}`;
      return general.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n");
    }
    return result.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n");
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  데이터 / 금융
// ═══════════════════════════════════════════════════════════════════════════════

const calculateTool: BloksTool = {
  name: "calculate",
  description: "수학 계산을 수행합니다. 예산 산출, 통계, 비율 계산, 단위 변환에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      expression: { type: "string", description: "계산식 (예: 1000000 * 0.3, Math.round(3.14159 * 100) / 100)" },
    },
    required: ["expression"],
  },
  async execute(input) {
    const expr = String(input["expression"] ?? "").trim();
    // 안전한 수식만 허용 (숫자, 연산자, Math 함수만)
    const safe = /^[\d\s\+\-\*\/\(\)\.\,Math\.roundfloorceilloglsqrtpowabsmin max%]+$/.test(expr.replace(/Math\.\w+/g, ""));
    if (!safe) return `허용되지 않는 수식입니다. 숫자와 기본 연산자만 사용하세요.`;
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`"use strict"; const Math2 = Math; return (${expr})`)() as number;
      return `${expr} = ${result}`;
    } catch (err) {
      return `계산 오류: ${String(err)}`;
    }
  },
};

const exchangeRateTool: BloksTool = {
  name: "exchange_rate",
  description: "실시간 환율을 조회합니다. 광고비 환산, 해외 가격 비교, 재무 보고서에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      base: { type: "string", description: "기준 통화", enum: ["USD", "EUR", "JPY", "CNY", "KRW"] },
      targets: { type: "string", description: "조회할 통화 (쉼표 구분, 예: KRW,JPY,EUR)" },
    },
    required: [],
  },
  async execute(input) {
    const base = String(input["base"] ?? "USD").toUpperCase();
    const targets = String(input["targets"] ?? "KRW,JPY,EUR,CNY,GBP").split(",").map(t => t.trim().toUpperCase());
    try {
      const text = await safeFetch(`https://open.er-api.com/v6/latest/${base}`);
      const data = JSON.parse(text) as { rates: Record<string, number>; time_last_update_utc?: string };
      const lines = targets.filter(t => data.rates[t]).map(t => `${t}: ${data.rates[t]!.toLocaleString()}`);
      return `${base} 기준 환율 (${data.time_last_update_utc ?? "최신"}):\n${lines.join("\n")}`;
    } catch {
      return `환율 조회 실패 (네트워크 오류)`;
    }
  },
};

const parseDataTool: BloksTool = {
  name: "parse_data",
  description: "CSV, TSV, JSON 데이터를 파싱하고 분석합니다. 데이터 요약, 통계, 변환에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      data: { type: "string", description: "분석할 CSV/TSV/JSON 데이터 (최대 5000자)" },
      format: { type: "string", description: "데이터 형식", enum: ["csv", "tsv", "json", "auto"] },
      operation: { type: "string", description: "수행할 작업", enum: ["summary", "count", "headers", "first_rows"] },
    },
    required: ["data"],
  },
  async execute(input) {
    const raw = String(input["data"] ?? "").slice(0, 5000);
    const fmt = String(input["format"] ?? "auto");
    const op = String(input["operation"] ?? "summary");

    try {
      // JSON 시도
      if (fmt === "json" || (fmt === "auto" && raw.trim().startsWith("{"))) {
        const parsed = JSON.parse(raw);
        const keys = Array.isArray(parsed) ? Object.keys(parsed[0] ?? {}) : Object.keys(parsed);
        return `JSON 데이터\n필드: ${keys.join(", ")}\n레코드 수: ${Array.isArray(parsed) ? parsed.length : 1}`;
      }

      // CSV/TSV
      const sep = fmt === "tsv" ? "\t" : ",";
      const lines = raw.split(/\r?\n/).filter(Boolean);
      const headers = lines[0]?.split(sep) ?? [];
      const rows = lines.slice(1);

      if (op === "headers") return `컬럼 (${headers.length}개):\n${headers.join(", ")}`;
      if (op === "count") return `총 ${rows.length}행, ${headers.length}열`;
      if (op === "first_rows") return `첫 5행:\n${lines.slice(0, 6).join("\n")}`;

      return `데이터 요약:\n- 컬럼: ${headers.length}개 (${headers.slice(0, 5).join(", ")}${headers.length > 5 ? "..." : ""})\n- 행: ${rows.length}개`;
    } catch (err) {
      return `파싱 오류: ${String(err)}`;
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  법률 / 컴플라이언스
// ═══════════════════════════════════════════════════════════════════════════════

const searchKoreanLawTool: BloksTool = {
  name: "search_korean_law",
  description: "한국 법령, 고시, 판례를 검색합니다. 계약, 광고 규정, 소비자보호법, 세법 등 법적 근거 확인에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "검색할 법령명 또는 키워드" },
    },
    required: ["query"],
  },
  async execute(input) {
    const query = String(input["query"] ?? "");
    const result = await searchWeb(`${query} 법령 site:law.go.kr OR site:moleg.go.kr`, 5);
    if (result.results.length === 0) {
      const general = await searchWeb(`한국 ${query} 법률 규정 조항`, 5);
      return general.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n") || "검색 결과 없음";
    }
    return result.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n");
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  마케팅
// ═══════════════════════════════════════════════════════════════════════════════

const hashtagResearchTool: BloksTool = {
  name: "hashtag_research",
  description: "인스타그램, 틱톡, 유튜브용 해시태그를 조사합니다. 트렌드 해시태그와 경쟁사 해시태그 전략 분석에 사용하세요.",
  inputSchema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "해시태그 주제 (예: 카페, 뷰티, 맛집)" },
      platform: { type: "string", description: "플랫폼", enum: ["instagram", "tiktok", "youtube", "all"] },
    },
    required: ["topic"],
  },
  async execute(input) {
    const topic = String(input["topic"] ?? "");
    const platform = String(input["platform"] ?? "all");
    const query = `${topic} 해시태그 ${platform !== "all" ? platform : "인스타그램 틱톡"} 트렌드 2025`;
    const result = await searchWeb(query, 5);
    if (result.results.length === 0) return `해시태그 조사 결과 없음: ${topic}`;
    return result.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}`).join("\n\n");
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  커뮤니케이션
// ═══════════════════════════════════════════════════════════════════════════════

const sendEmailTool: BloksTool = {
  name: "send_email",
  description: "이메일을 발송합니다. 광고 결과물 전달, 보고서 공유, 승인 요청에 사용하세요. SMTP 설정 필요 (SMTP_HOST, SMTP_USER, SMTP_PASS).",
  inputSchema: {
    type: "object",
    properties: {
      to: { type: "string", description: "수신자 이메일" },
      subject: { type: "string", description: "제목" },
      body: { type: "string", description: "본문 내용 (텍스트 또는 HTML)" },
    },
    required: ["to", "subject", "body"],
  },
  async execute(input) {
    const to = String(input["to"] ?? "");
    const subject = String(input["subject"] ?? "");
    const body = String(input["body"] ?? "");

    const host = process.env["SMTP_HOST"];
    const user = process.env["SMTP_USER"];
    const pass = process.env["SMTP_PASS"];

    if (!host || !user || !pass) {
      return `이메일 발송 실패: SMTP 설정이 없습니다.\n.env에 SMTP_HOST, SMTP_USER, SMTP_PASS를 설정하거나 앱 설정 화면에서 입력하세요.`;
    }

    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host, port: 587, secure: false,
        auth: { user, pass },
      });
      await transporter.sendMail({ from: user, to, subject, html: body });
      return `이메일 발송 완료: ${to}`;
    } catch (err) {
      return `이메일 발송 실패: ${String(err)}`;
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Tool Registry
// ═══════════════════════════════════════════════════════════════════════════════

export const TOOL_REGISTRY: Record<string, BloksTool> = {
  // 웹/인터넷
  web_search:             webSearchTool,
  fetch_url:              fetchUrlTool,
  // 유틸리티
  get_current_datetime:   getDatetimeTool,
  // 미디어 제작
  generate_image:         generateImageTool,
  generate_video:         generateVideoTool,
  generate_qr:            generateQrTool,
  // 프로그램 개발
  execute_code:           executeCodeTool,
  search_npm:             searchNpmTool,
  search_github:          searchGithubTool,
  search_docs:            searchDocsTool,
  // SAP/ABAP
  sap_transaction_info:   sapTransactionTool,
  abap_pattern:           abapPatternTool,
  bapi_search:            bapiSearchTool,
  search_sap_notes:       searchSapNotesTool,
  // 데이터/금융
  calculate:              calculateTool,
  exchange_rate:          exchangeRateTool,
  parse_data:             parseDataTool,
  // 법률
  search_korean_law:      searchKoreanLawTool,
  // 마케팅
  hashtag_research:       hashtagResearchTool,
  // 커뮤니케이션
  send_email:             sendEmailTool,
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Task type → Tool set mapping
// ═══════════════════════════════════════════════════════════════════════════════

const TASK_TOOL_MAP: Record<string, string[]> = {
  // 리서치 & 분석
  market_research:   ["web_search", "fetch_url", "get_current_datetime", "exchange_rate"],
  research_summary:  ["web_search", "fetch_url", "get_current_datetime"],
  data_analysis:     ["web_search", "calculate", "exchange_rate", "parse_data", "get_current_datetime"],
  // 전략 & 기획
  strategy_memo:     ["web_search", "get_current_datetime", "exchange_rate"],
  project_plan:      ["web_search", "get_current_datetime", "calculate"],
  proposal_draft:    ["web_search", "get_current_datetime", "exchange_rate", "calculate"],
  planningDocument:  ["web_search", "get_current_datetime"],
  prd_draft:         ["web_search", "get_current_datetime", "search_docs"],
  // 광고 대행
  ad_banner:         ["generate_image", "web_search", "generate_qr"],
  ad_copy:           ["web_search", "hashtag_research", "get_current_datetime"],
  ad_strategy:       ["web_search", "exchange_rate", "get_current_datetime", "search_korean_law"],
  ad_video:          ["generate_video"],
  coupon_design:     ["generate_image", "generate_qr", "get_current_datetime"],
  promo_page:        ["web_search", "get_current_datetime", "generate_qr"],
  // 마케팅 콘텐츠
  marketing_copy:    ["web_search", "hashtag_research"],
  online_content:    ["web_search", "hashtag_research", "get_current_datetime"],
  // 미디어
  image_production:  ["generate_image"],
  video_production:  ["generate_video"],
  media_pipeline:    ["generate_image", "generate_video"],
  // 프로그램 개발
  code_development:  ["execute_code", "search_npm", "search_github", "search_docs", "fetch_url", "get_current_datetime"],
  web_development:   ["execute_code", "search_npm", "search_docs", "fetch_url", "get_current_datetime"],
  abap_development:  ["abap_pattern", "search_sap_notes", "bapi_search", "sap_transaction_info", "web_search"],
  // SAP
  sap_abap_spec:     ["abap_pattern", "search_sap_notes", "bapi_search", "sap_transaction_info", "web_search"],
  sap_abap_review:   ["abap_pattern", "search_sap_notes", "web_search"],
  erp_operation:     ["sap_transaction_info", "bapi_search", "web_search", "search_sap_notes"],
  sap_consulting:    ["search_sap_notes", "bapi_search", "sap_transaction_info", "web_search"],
  // 문서
  document:          ["get_current_datetime", "web_search", "calculate"],
  memo:              ["get_current_datetime"],
  // 기본값
  default:           ["web_search", "get_current_datetime"],
};

export function getToolsForTask(taskType: string): BloksTool[] {
  const names = TASK_TOOL_MAP[taskType] ?? TASK_TOOL_MAP["default"]!;
  return names.map(n => TOOL_REGISTRY[n]).filter(Boolean) as BloksTool[];
}

export function toOpenAITool(tool: BloksTool) {
  return {
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  };
}

export function toAnthropicTool(tool: BloksTool) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}
