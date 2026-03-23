// World page — main isometric company view wrapped in AppShell
import AppShell from "@/components/layout/AppShell";
import IsometricWorldCanvas from "@/components/world/IsometricWorldCanvas";

export const metadata = {
  title: "월드 — BLOKS",
};

export default function WorldPage() {
  return (
    <AppShell activeNav="world">
      <IsometricWorldCanvas />
    </AppShell>
  );
}
