import type { Dispatch, SetStateAction } from "react";
import { eligibleModel, type Model, type Preferences } from "@rv/shared";
type Props = {
  models: Model[];
  prefs: Preferences;
  search: string;
  setPrefs: Dispatch<SetStateAction<Preferences>>;
  setSearch: Dispatch<SetStateAction<string>>;
  busy: boolean;
  onRefresh: () => void;
};
export function ModelPicker({
  models,
  prefs,
  search,
  setPrefs,
  setSearch,
  busy,
  onRefresh,
}: Props) {
  return (
    <>
      <div className="row">
        <input
          aria-label="Search models"
          placeholder="Search models or providers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button disabled={busy} onClick={onRefresh}>
          ↻ Refresh
        </button>
      </div>
      <div className="model-list">
        {models
          .filter(
            (m) =>
              eligibleModel(m) &&
              (m.name + " " + m.id)
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
          .map((m) => (
            <label className="model" key={m.id}>
              <input
                type="checkbox"
                checked={prefs.models.includes(m.id)}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    models: e.target.checked
                      ? [...prefs.models, m.id]
                      : prefs.models.filter((x) => x !== m.id),
                  })
                }
              />
              <span>
                {m.name}
                <small>{m.id}</small>
              </span>
            </label>
          ))}
        {!models.length && (
          <p className="muted">
            Refresh the OpenRouter catalog to choose models.
          </p>
        )}
      </div>
      <small>
        {prefs.models.length} selected · selection saved when you start a run
      </small>
    </>
  );
}
