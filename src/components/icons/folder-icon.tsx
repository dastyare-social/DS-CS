import type { SVGProps } from "react";

/**
 * Folder outline — used for "attach media" on the `/os` composer, and anywhere
 * else a file-picker affordance is needed.
 *
 * Lives in `components/icons` rather than being inlined at the call site so it
 * can be shared; the API mirrors `lucide-react` (`className`, `size`), so it
 * is a drop-in replacement for any lucide icon in this codebase.
 *
 * `stroke` is `currentColor` so it inherits text colour like every other icon
 * here, and `strokeWidth` defaults to 1.5 to match the hairline weight used
 * across the app — override it with a `stroke-[Npx]` class, the same way the
 * lucide icons are restyled.
 */
export default function FolderIcon({
  size = 24,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 3H8C8.69805 3.00421 9.38286 3.19101 9.98634 3.54187C10.5898 3.89273 11.091 4.39545 11.44 5C11.797 5.60635 12.3055 6.10947 12.9156 6.46008C13.5256 6.8107 14.2164 6.99678 14.92 7H18C19.0609 7 20.0783 7.42136 20.8284 8.17151C21.5786 8.92165 22 9.93913 22 11V17C22 18.0609 21.5786 19.0782 20.8284 19.8284C20.0783 20.5785 19.0609 21 18 21H6C4.93913 21 3.92172 20.5785 3.17157 19.8284C2.42142 19.0782 2 18.0609 2 17V7C2 5.93913 2.42164 4.92165 3.17157 4.17151C3.92172 3.42136 4.93913 3 6 3Z" />
    </svg>
  );
}