"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SimpleDialog({
  children,
  open,
  title,
  description,
}: {
  children: ReactNode;
  open: boolean;
  title: string;
  description?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <div className="border-b border-stone-200 px-5 py-4">
          <h2 className="text-base font-semibold text-stone-950">{title}</h2>
          {description ? <p className="mt-1 text-sm text-stone-600">{description}</p> : null}
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function DialogActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-5 flex flex-wrap justify-end gap-2", className)}>{children}</div>
  );
}
