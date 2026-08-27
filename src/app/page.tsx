import { redirect } from "next/navigation";

// The Workspace root itself isn't a page - each project owns its own
// dashboard. With only one project so far, land straight on its dashboard;
// once more projects exist this becomes a real workspace-level chooser.
export default function WorkspaceRoot() {
  redirect("/pipeline/dashboard");
}
