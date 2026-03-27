import AppShell from "@/components/layout/AppShell";

export const metadata = {
  title: "분석 — BLOKS",
};

export default function AnalyticsPage() {
  return (
    <AppShell activeNav="analytics">
      <section className="p-6 text-gray-200">
        <h1 className="text-xl font-semibold mb-2">분석 대시보드</h1>
        <p className="text-sm text-gray-400">비용, 처리량, 병목 지표를 통합 모니터링하는 MVP 분석 화면입니다.</p>
      </section>
    </AppShell>
  );
}
