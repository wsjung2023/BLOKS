import AppShell from "@/components/layout/AppShell";

export default function PromptsPage() {
  return (
    <AppShell activeNav="prompts">
      <section style={{ padding: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.1rem" }}>Prompt Console</h1>
        <p style={{ marginTop: "0.75rem", color: "var(--color-muted)", fontSize: "0.85rem" }}>
          P2 단계에서 프롬프트 템플릿 편집기/버전 관리 UI를 연결할 예정입니다.
        </p>
      </section>
    </AppShell>
  );
}
