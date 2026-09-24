import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { IconClose, IconSearch } from "../icons";

function ShopSearch({ slug, basePath }: { slug?: string; basePath?: string }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const homePath = basePath || `/shop/${slug}`;
  const isHome = location.pathname === homePath || location.pathname === `${homePath}/`;
  const [value, setValue] = useState(() => (isHome ? params.get("q") || "" : ""));

  useEffect(() => {
    if (isHome) {
      setValue(params.get("q") || "");
    }
  }, [isHome, params]);

  function go(next: string) {
    const q = next.trim();
    const target = q ? `${homePath}?q=${encodeURIComponent(q)}` : homePath;

    if (isHome) {
      navigate(target, { replace: true });
      return;
    }

    navigate(target);
  }

  return (
    <form
      className="relative mx-auto flex h-9 w-[18rem] shrink-0 items-center rounded-full bg-[#e7f6f1] ring-1 ring-teal-200/80 sm:h-10 sm:w-[24rem] md:w-28rem"
      onSubmit={(event) => {
        event.preventDefault();
        go(value);
      }}
    >
      <span className="sr-only">Search</span>
      {!value ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 sm:gap-2 sm:text-sm">
          <IconSearch className="h-4 w-4 text-teal-700" />
          Search
        </span>
      ) : (
        <span className="pointer-events-none absolute left-2.5 grid h-full place-items-center text-teal-700 sm:left-3">
          <IconSearch className="h-4 w-4" />
        </span>
      )}
      <input
        type="search"
        className={`h-full w-full bg-transparent text-sm font-medium text-slate-800 outline-none [&::-webkit-search-cancel-button]:hidden ${
          value ? "px-9 text-left sm:px-10" : "px-3 text-center"
        }`}
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          if (isHome) {
            go(next);
          }
        }}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          className="absolute right-2 grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-white hover:text-slate-700"
          onClick={() => {
            setValue("");
            go("");
          }}
        >
          <IconClose className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </form>
  );
}

export default ShopSearch;
