import { useState, type ReactNode } from "react";
import { IconPencil } from "./icons";

interface InlineEditProps {
  value: string;
  display?: ReactNode;
  type?: "text" | "number" | "date";
  options?: { value: string; label: string }[];
  onSave: (value: string) => void;
}

function InlineEdit({
  value,
  display,
  type = "text",
  options,
  onSave,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  function save(nextValue = draft) {
    const trimmed = nextValue.trim();
    setEditing(false);

    if (!trimmed || trimmed === String(value)) {
      return;
    }

    onSave(trimmed);
  }

  if (editing && options) {
    return (
      <select
        autoFocus
        className="rounded border border-teal-600 px-2 py-1 text-sm outline-none"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          save(event.target.value);
        }}
        onBlur={() => setEditing(false)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        className={`${type === "date" ? "w-36" : "w-28"} rounded border border-teal-600 px-2 py-1 text-sm outline-none`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            save();
          }

          if (event.key === "Escape") {
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="group inline-flex items-center gap-1 text-left"
      onClick={startEdit}
      title="Edit"
    >
      <span>{display ?? value}</span>
      <IconPencil className="h-3.5 w-3.5 text-teal-700 opacity-0 group-hover:opacity-100" />
    </button>
  );
}

export default InlineEdit;
