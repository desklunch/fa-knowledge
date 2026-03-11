import type { User } from "@/db/schema";

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
  return (
    <div className="flex flex-wrap gap-1.5">
      {users.map((user) => {
        const isActive = user.id === currentUserId;
        const params = new URLSearchParams({
          user: user.id,
        });

        if (selectedPageId) {
          params.set("page", selectedPageId);
        }

        return (
          <a
            key={user.id}
            href={`/impersonate?${params.toString()}`}
            className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
            }`}
          >
            {user.name}
          </a>
        );
      })}
    </div>
  );
}
