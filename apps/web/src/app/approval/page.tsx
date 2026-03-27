import AppShell from "@/components/layout/AppShell";

export const metadata = {
  title: "결재 센터 — BLOKS",
};

export default function ApprovalPage() {
  return (
    <AppShell activeNav="approval">
      <section className="p-6 text-gray-200">
        <h1 className="text-xl font-semibold mb-2">결재 센터</h1>
        <p className="text-sm text-gray-400">대기 중인 결재 건을 확인하고 승인/반려할 수 있는 화면입니다.</p>
      </section>
    </AppShell>
  );
}
