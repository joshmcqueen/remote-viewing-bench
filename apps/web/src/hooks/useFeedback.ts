import { useState } from "react";
export function useFeedback() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return { error, setError, notice, setNotice, busy, action };
}
export type Feedback = ReturnType<typeof useFeedback>;
