import AppShell from "@/components/layout/AppShell";

export const metadata = {
  title: "캐릭터 목록 — BLOKS",
};

export default function DirectoryPage() {
  return (
    <AppShell activeNav="directory">
      <section className="p-6 text-gray-200">
        <h1 className="text-xl font-semibold mb-2">캐릭터 목록</h1>
        <p className="text-sm text-gray-400">전체 캐릭터의 역할, 상태, 업무 부하를 확인하는 디렉터리 화면입니다.</p>
      </section>
    </AppShell>
  );
}
