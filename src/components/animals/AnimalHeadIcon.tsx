import { cn } from "@/lib/utils";

export function AnimalHeadIcon({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path d="M18 14 8 8l4 14" />
      <path d="M46 14 56 8l-4 14" />
      <path d="M20 18c4-3 8-5 12-5s8 2 12 5" />
      <path d="M18 22c-2 8-2 16 1 23 2 4 6 7 13 7s11-3 13-7c3-7 3-15 1-23" />
      <path d="M24 27c2 2 5 3 8 3s6-1 8-3" />
      <path d="M28 37c1 2 2 4 4 4s3-2 4-4" />
      <path d="M25 45c2 3 4 5 7 5s5-2 7-5" />
    </svg>
  );
}
