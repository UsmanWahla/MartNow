import { API_URL, getUserInitials } from "../../auth";
import type { User } from "../../auth";

interface AvatarProps {
  user: User | null;
  size?: "sm" | "lg";
}

function Avatar({ user, size = "sm" }: AvatarProps) {
  const classes =
    size === "lg"
      ? "h-16 w-16 text-xl"
      : "h-10 w-10 text-sm";

  if (user?.avatar_path) {
    const src = user.avatar_path.startsWith("http")
      ? user.avatar_path
      : `${API_URL}${user.avatar_path}`;

    return (
      <img
        src={src}
        alt=""
        className={`shrink-0 rounded-full border border-white/80 bg-teal-50 object-cover ${classes}`}
      />
    );
  }

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full bg-teal-700 font-semibold text-white ${classes}`}
    >
      {getUserInitials(user)}
    </div>
  );
}

export default Avatar;
