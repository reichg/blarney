import type { ModularCardProps } from "@/components/type";
import type { ElementType } from "react";
import styles from "./ModularCard.module.css";

export function ModularCard<T extends ElementType = "article">({
  as,
  children,
  className,
  ...props
}: ModularCardProps<T>) {
  const Component = as ?? "article";

  return (
    <Component
      className={[styles.card, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </Component>
  );
}
