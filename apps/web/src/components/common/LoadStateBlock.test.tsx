import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LoadStateBlock from "./LoadStateBlock";

describe("LoadStateBlock", () => {
  it("renders message and optional action", () => {
    const html = renderToStaticMarkup(
      <LoadStateBlock message="데이터 로딩 중" actionLabel="다시 시도" onAction={() => {}} />,
    );

    expect(html).toContain("데이터 로딩 중");
    expect(html).toContain("다시 시도");
  });

  it("renders error tone message", () => {
    const html = renderToStaticMarkup(<LoadStateBlock message="에러 발생" tone="error" />);
    expect(html).toContain("에러 발생");
  });
});
