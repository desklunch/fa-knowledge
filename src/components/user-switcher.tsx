"use client";

import { ChevronDown, Check } from "lucide-react";

import type { User } from "@/db/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserSwitcherProps = {
  currentUserId: string;
  selectedPageId: string | null;
  users: User[];
};

export function UserSwitcher({
  currentUserId,
  selectedPageId,
  users,
}: UserSwitcherProps) {
  const currentUser = users.find((user) => user.id === currentUserId) ?? users[0] ?? null;

  if (!currentUser) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex w-auto items-center justify-end gap-3 border-l border-stone-300 px-3 py-4 text-left transition"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-stone-900">{currentUser.name}</p>

          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-stone-500" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Switch identity</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {users.map((user) => {
          const isActive = user.id === currentUserId;
          const params = new URLSearchParams({
            user: user.id,
          });

          if (selectedPageId) {
            params.set("page", selectedPageId);
          }

          const href = `/impersonate?${params.toString()}`;
          const handleSelect = () => {
            window.location.href = href;
          };

          return (
            <DropdownMenuItem
              key={user.id}
              onClick={handleSelect}
              onSelect={handleSelect}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-stone-900">{user.name}</p>
                <p className="truncate text-xs text-stone-500">
                  {formatUserType(user.userType)} · Level {user.permissionLevel}
                </p>
              </div>
              {isActive ? <Check className="h-4 w-4 shrink-0 text-stone-900" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatUserType(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
