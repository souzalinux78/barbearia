import { PropsWithChildren } from "react";

type CardProps = PropsWithChildren<{
  title?: string;
  className?: string;
}>;

export const Card = ({ title, className, children }: CardProps) => (
  <section className={`rounded-2xl border border-white/10 bg-graphite/80 p-4 shadow-lg ${className ?? ""}`}>
    {title ? <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">{title}</h3> : null}
    {children}
  </section>
);
