// Home page — redirects to /world (main isometric company view)
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/world");
}
