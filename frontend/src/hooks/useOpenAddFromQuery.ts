import { useState } from "react";
import { useSearchParams } from "react-router-dom";

function useOpenAddFromQuery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [manualOpen, setManualOpen] = useState(false);
  const openFromQuery = searchParams.get("add") === "1";
  const showAdd = manualOpen || openFromQuery;

  function setShowAdd(next: boolean) {
    setManualOpen(next);

    if (!next && openFromQuery) {
      const params = new URLSearchParams(searchParams);
      params.delete("add");
      setSearchParams(params, { replace: true });
    }
  }

  return { showAdd, setShowAdd };
}

export default useOpenAddFromQuery;
