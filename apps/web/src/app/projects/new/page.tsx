import AppShell from "@/components/layout/AppShell";
import ProjectIntakeForm from "@/components/project/ProjectIntakeForm";

export const metadata = { title: "새 프로젝트 — BLOKS" };

export default function NewProjectPage() {
  return (
    <AppShell activeNav="projects">
      <ProjectIntakeForm />
    </AppShell>
  );
}
