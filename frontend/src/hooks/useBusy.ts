import { useCallback, useRef, useState } from "react";

function useBusy() {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const run = useCallback(async (task: () => Promise<void>) => {
    if (lock.current) {
      return;
    }

    lock.current = true;
    setBusy(true);

    try {
      await task();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}

export default useBusy;
