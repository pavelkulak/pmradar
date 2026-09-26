import type { ReactNode } from "react";

export function GachiHero({ eyebrow, title, description, aside, children, variant = "inbox" }: {
  eyebrow: string;
  title: string;
  description: string;
  aside: ReactNode;
  children?: ReactNode;
  variant?: "inbox" | "chats";
}) {
  return <section className={`gachi-hero gachi-hero-${variant} page-heading`}>
    <div className="gachi-hero-copy">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
    </div>
    {children}
    <div className="gachi-hero-aside">{aside}</div>
  </section>;
}
