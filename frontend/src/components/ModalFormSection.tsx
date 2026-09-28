import type { ReactNode } from "react";

interface ModalFormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

function ModalFormSection({ title, description, children }: ModalFormSectionProps) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        {description ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export default ModalFormSection;
