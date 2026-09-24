interface NoteCellProps {
  note: string | null | undefined;
}

function NoteCell({ note }: NoteCellProps) {
  const compact = String(note || "").replace(/\s+/g, " ").trim();

  if (!compact) {
    return <span className="text-slate-300">—</span>;
  }

  return (
    <span
      className="inline-block max-w-11rem truncate rounded-lg bg-slate-50 px-2 py-1 text-xs leading-5 text-slate-600"
      title={note || compact}
    >
      {compact}
    </span>
  );
}

export default NoteCell;
