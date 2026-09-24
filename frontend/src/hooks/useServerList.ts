import { useCallback, useEffect, useRef, useState } from "react";

export const PAGE_SIZE = 5;

export interface Paged<T> {
  rows: T[];
  total: number;
}

export function useServerList<T>(
  fetcher: (q: string, page: number) => Promise<Paged<T>>,
  onError: (error: unknown) => void,
  extraKey = ""
) {
  const fetcherRef = useRef(fetcher);
  const onErrorRef = useRef(onError);
  const skipDebounce = useRef(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetcherRef.current = fetcher;
    onErrorRef.current = onError;
  }, [fetcher, onError]);

  useEffect(() => {
    if (skipDebounce.current) {
      skipDebounce.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  const loadList = useCallback(async () => {
    try {
      const result = await fetcherRef.current(query, page);
      setRows(Array.isArray(result?.rows) ? result.rows : []);
      setTotal(Number(result?.total) || 0);
    } catch (error) {
      onErrorRef.current(error);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, query, extraKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- list fetch
    setLoading(true);
    void loadList();
  }, [loadList]);

  function goToPage(nextPage: number) {
    if (nextPage === page) {
      return;
    }

    setPage(nextPage);
  }

  return {
    search,
    setSearch,
    page,
    setPage: goToPage,
    rows,
    setRows,
    total,
    loading,
    reload: loadList,
  };
}
