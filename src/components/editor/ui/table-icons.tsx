"use client";

import type { LucideProps } from "lucide-react";

function BaseBorderIcon({
  children,
  ...props
}: LucideProps & { children: React.ReactNode }) {
  return (
    <svg
      fill="none"
      height="15"
      viewBox="0 0 15 15"
      width="15"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

export function BorderAllIcon(props: LucideProps) {
  return (
    <BaseBorderIcon {...props}>
      <rect x="1" y="1" width="13" height="13" rx="0.5" stroke="currentColor" />
      <path d="M7.5 1v13M1 7.5h13" stroke="currentColor" />
    </BaseBorderIcon>
  );
}

export function BorderTopIcon(props: LucideProps) {
  return (
    <BaseBorderIcon {...props}>
      <path d="M1 1.5h13" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="1" width="13" height="13" rx="0.5" stroke="currentColor" opacity="0.35" />
    </BaseBorderIcon>
  );
}

export function BorderRightIcon(props: LucideProps) {
  return (
    <BaseBorderIcon {...props}>
      <path d="M13.5 1v13" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="1" width="13" height="13" rx="0.5" stroke="currentColor" opacity="0.35" />
    </BaseBorderIcon>
  );
}

export function BorderBottomIcon(props: LucideProps) {
  return (
    <BaseBorderIcon {...props}>
      <path d="M1 13.5h13" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="1" width="13" height="13" rx="0.5" stroke="currentColor" opacity="0.35" />
    </BaseBorderIcon>
  );
}

export function BorderLeftIcon(props: LucideProps) {
  return (
    <BaseBorderIcon {...props}>
      <path d="M1.5 1v13" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="1" width="13" height="13" rx="0.5" stroke="currentColor" opacity="0.35" />
    </BaseBorderIcon>
  );
}

export function BorderNoneIcon(props: LucideProps) {
  return (
    <BaseBorderIcon {...props}>
      <rect x="1" y="1" width="13" height="13" rx="0.5" stroke="currentColor" opacity="0.35" />
      <path d="M2 13L13 2" stroke="currentColor" strokeWidth="1.5" />
    </BaseBorderIcon>
  );
}
