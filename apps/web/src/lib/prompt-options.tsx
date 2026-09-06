export const promptOptions = (ps: any[]) =>
  ps.map((p) => (
    <option key={p.versionId} value={p.versionId}>
      {p.name} · v{p.version}
    </option>
  ));
