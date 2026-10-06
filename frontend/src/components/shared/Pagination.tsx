import { IconChevronLeft, IconChevronRight } from "./icons";

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <div className="mt-5 flex items-center justify-end">
      <div className="inline-flex items-center overflow-hidden rounded-xl border border-(--hairline) bg-white">
        <button
          type="button"
          className="grid h-8 w-8 place-items-center text-teal-800 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-white"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <IconChevronLeft className="h-4 w-4" />
        </button>

        <span className="grid min-w-8 h-8 place-items-center border-x border-slate-200 bg-teal-700 text-sm font-semibold text-white">
          {page}
        </span>

        <button
          type="button"
          className="grid h-8 w-8 place-items-center text-teal-800 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-white"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
