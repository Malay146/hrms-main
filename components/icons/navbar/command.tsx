import React from "react";
import { cn } from "@/utils/cn";

interface IconProps {
  className?: string;
}

const CommandIcon = ({ className }: IconProps) => {
  return (
    <svg
      className={cn(className)}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M11.25 6.75V11.25H6.75V6.75H11.25Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path
        d="M11.25 11.25H13.5C14.7427 11.25 15.75 12.2573 15.75 13.5C15.75 14.7427 14.7427 15.75 13.5 15.75C12.2573 15.75 11.25 14.7427 11.25 13.5V11.25Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path
        d="M6.75 11.2515H4.5C3.25736 11.2515 2.25 12.2588 2.25 13.5015C2.25 14.7441 3.25736 15.7515 4.5 15.7515C5.74264 15.7515 6.75 14.7441 6.75 13.5015V11.2515Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path
        d="M11.25 6.75V4.5C11.25 3.25736 12.2573 2.25 13.5 2.25C14.7427 2.25 15.75 3.25736 15.75 4.5C15.75 5.74264 14.7427 6.75 13.5 6.75H11.25Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path
        d="M6.75 6.75V4.5C6.75 3.25736 5.74264 2.25 4.5 2.25C3.25736 2.25 2.25 3.25736 2.25 4.5C2.25 5.74264 3.25736 6.75 4.5 6.75H6.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default CommandIcon;