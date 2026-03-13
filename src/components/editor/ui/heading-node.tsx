"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

const headingVariants = cva("relative mb-1", {
  variants: {
    variant: {
      h1: "mt-[1.6em] pb-1 text-4xl font-bold tracking-tight text-stone-950",
      h2: "mt-[1.4em] pb-px text-2xl font-semibold tracking-tight text-stone-950",
      h3: "mt-[1em] pb-px text-xl font-semibold tracking-tight text-stone-900",
    },
  },
});

function HeadingElement({
  variant = "h1",
  ...props
}: PlateElementProps & VariantProps<typeof headingVariants>) {
  const tagName = variant ?? "h1";
  const element = props.element as TElement & { id?: string };

  return (
    <PlateElement
      as={tagName}
      className={headingVariants({ variant: tagName })}
      data-heading-id={element.id}
      style={{ scrollMarginTop: "1.5rem" }}
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

export function H1Element(props: PlateElementProps) {
  return <HeadingElement variant="h1" {...props} />;
}

export function H2Element(props: PlateElementProps) {
  return <HeadingElement variant="h2" {...props} />;
}

export function H3Element(props: PlateElementProps) {
  return <HeadingElement variant="h3" {...props} />;
}
