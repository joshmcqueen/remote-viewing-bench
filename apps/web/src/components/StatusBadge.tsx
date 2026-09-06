export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status ${status.replaceAll(" ", "-")}`}>
      <i />
      {status}
    </span>
  );
}
