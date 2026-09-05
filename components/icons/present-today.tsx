import React from "react";
import { cn } from "@/utils/cn";

interface IconProps {
  className?: string;
}

const PresentTodayIcon = ({ className }: IconProps) => {
  return (
    <svg
      className={cn(className)}
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.46538 22.2658C5.07716 18.6462 9.08478 16.6628 13.3506 16.6667C17.6081 16.6705 21.8629 18.3533 24.4539 22.2658C24.7081 22.6495 24.7307 23.142 24.5129 23.5475C24.2951 23.953 23.8721 24.206 23.4117 24.206H3.50756C3.04726 24.206 2.6242 23.953 2.40638 23.5475C2.18856 23.142 2.21123 22.6495 2.46538 22.2658Z"
        fill="currentColor"
        fillOpacity="0.7"
      />
      <path
        d="M13.3333 14.1667C16.5549 14.1667 19.1667 11.5532 19.1667 8.33333C19.1667 5.11348 16.5549 2.5 13.3333 2.5C10.1118 2.5 7.5 5.11348 7.5 8.33333C7.5 11.5532 10.1118 14.1667 13.3333 14.1667Z"
        fill="currentColor"
        fillOpacity="0.7"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18.4583 17.5C17.6496 17.5 16.8704 17.9877 16.5477 18.7572L13.7712 25H9.58325C8.8929 25 8.33325 25.5597 8.33325 26.25C8.33325 26.9403 8.8929 27.5 9.58325 27.5H14.5833H24.8749C25.7149 27.5 26.4518 26.9923 26.7791 26.2565L29.3709 20.437C29.9794 19.0708 28.9883 17.5 27.4683 17.5H18.4583Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default PresentTodayIcon;