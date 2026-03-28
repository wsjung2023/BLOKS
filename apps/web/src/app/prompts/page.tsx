import AppShell from "@/components/layout/AppShell";

export const metadata = {
  title: "프롬프트 콘솔 — BLOKS",
};

export default function PromptsPage() {
  return (
    <AppShell activeNav="prompts">
      <section className="p-6 text-gray-200">
        <h1 className="text-xl font-semibold mb-2">프롬프트 콘솔</h1>
        <p className="text-sm text-gray-400">에이전트 프롬프트 템플릿을 확인하고 관리할 수 있는 화면입니다.</p>
      </section>
    </AppShell>
  );
}
