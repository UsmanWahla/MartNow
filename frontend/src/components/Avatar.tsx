import { getUserInitials } from "../auth";
import type { User } from "../auth";

interface AvatarProps {
  user: User | null;
  size?: "sm" | "lg";
}

function Avatar({ user, size = "sm" }: AvatarProps) {
  const classes =
    size === "lg"
      ? "h-16 w-16 text-xl"
      : "h-10 w-10 text-sm";

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full bg-teal-700 font-semibold text-white ${classes}`}
    >
      {getUserInitials(user)}
    </div>
  );
}

export default Avatar;
