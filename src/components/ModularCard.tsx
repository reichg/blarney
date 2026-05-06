import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
} from "react";
import styles from "./ModularCard.module.css";

type ModularCardOwnProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
};

type ModularCardProps<T extends ElementType> = ModularCardOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof ModularCardOwnProps<T>>;

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
