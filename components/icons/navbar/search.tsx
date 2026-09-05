import React from "react";
import { cn } from "@/utils/cn";

interface IconProps {
  className?: string;
}

const SearchIcon = ({ className }: IconProps) => {
  return (
    <svg
      className={cn(className)}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.66675 8.61111C1.66675 4.77588 4.77596 1.66667 8.61119 1.66667C12.4464 1.66667 15.5556 4.77588 15.5556 8.61111C15.5556 12.4463 12.4464 15.5556 8.61119 15.5556C4.77596 15.5556 1.66675 12.4463 1.66675 8.61111Z"
        fill="currentColor"
        fillOpacity="0.4"
      />
      <path
        d="M12.897 14.0756L16.9106 18.0892C17.2361 18.4147 17.7638 18.4147 18.0892 18.0892C18.4146 17.7638 18.4146 17.2362 18.0892 16.9108L14.0755 12.897C13.7312 13.3353 13.3353 13.7312 12.897 14.0756Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default SearchIcon;