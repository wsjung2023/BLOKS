// World page — main isometric company view wrapped in AppShell
import AppShell from "@/components/layout/AppShell";
import IsometricWorldCanvas from "@/components/world/IsometricWorldCanvas";
import { WorldHelp } from "@/components/layout/AppHelp";

export const metadata = {
  title: "월드 — BLOKS",
};

export default function WorldPage() {
  return (
    <AppShell activeNav="world" helpContent={<WorldHelp />}>
      <IsometricWorldCanvas />
    </AppShell>
  );
}
