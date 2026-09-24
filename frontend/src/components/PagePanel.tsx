import type { ReactNode } from "react";

interface PagePanelProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

function PagePanel({ title, actions, children }: PagePanelProps) {
  return (
    <div className="surface-card anim-fade-up rounded-2xl p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {typeof title === "string" ? (
          <h2 className="text-lg font-semibold tracking-tight text-slate-800">{title}</h2>
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-3">{title}</div>
        )}
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export default PagePanel;
