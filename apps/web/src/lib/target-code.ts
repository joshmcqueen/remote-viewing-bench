export function generateTargetCode() {
  const digits = Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, "0");
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}
