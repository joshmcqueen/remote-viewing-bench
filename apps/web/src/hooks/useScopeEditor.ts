import { useState } from "react";
import { api } from "../lib/api";
import type { Feedback } from "./useFeedback";
import type { Workspace } from "./useWorkspace";

export function useScopeEditor(
  { reloadScopes }: Pick<Workspace, "reloadScopes">,
  { action, setNotice }: Feedback,
) {
  const [editingScope, setEditingScope] = useState<any>(null);
  const deleteScope = (scope: any) => {
    if (
      !window.confirm(
        `Delete the “${scope.name}” scope? Historical runs will keep their saved scope.`,
      )
    )
      return;
    action(async () => {
      await api(`/scopes/${scope.id}`, undefined, "DELETE");
      await reloadScopes();
      if (editingScope?.id === scope.id) setEditingScope(null);
      setNotice("Project scope deleted.");
    });
  };
  const saveScope = () =>
    action(async () => {
      const saved = await api(
        editingScope.id ? `/scopes/${editingScope.id}` : "/scopes",
        {
          name: editingScope.name,
          description: editingScope.description,
        },
        editingScope.id ? "PATCH" : "POST",
      );
      await reloadScopes(saved.id);
      setEditingScope(null);
      setNotice(
        editingScope.id ? "Project scope updated." : "Project scope added.",
      );
    });

  return { editingScope, setEditingScope, deleteScope, saveScope };
}
export type ScopeEditor = ReturnType<typeof useScopeEditor>;
