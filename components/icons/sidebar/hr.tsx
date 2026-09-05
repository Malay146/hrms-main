import React from "react";
import { cn } from "@/utils/cn";

interface IconProps {
  className?: string;
}

const HRIcon = ({ className }: IconProps) => {
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
        d="M2.5 6.66663C2.5 5.74615 3.24619 4.99996 4.16667 4.99996H15.8333C16.7538 4.99996 17.5 5.74615 17.5 6.66663V15.8333C17.5 16.7538 16.7538 17.5 15.8333 17.5H4.16667C3.24619 17.5 2.5 16.7538 2.5 15.8333V6.66663Z"
        fill="currentColor"
        fillOpacity="0.4"
      />
      <path
        d="M13.3333 4.99996V2.5C13.3333 1.57948 12.5871 0.833298 11.6667 0.833298H8.33333C7.41285 0.833298 6.66667 1.57948 6.66667 2.5V4.99996H13.3333ZM7.5 4.99996V2.5C7.5 2.03976 7.8731 1.66663 8.33333 1.66663H11.6667C12.1269 1.66663 12.5 2.03976 12.5 2.5V4.99996H7.5Z"
        fill="currentColor"
      />
      <path
        d="M2.5 10H17.5V11.6666H2.5V10ZM9.16667 9.16663H10.8333C11.2936 9.16663 11.6667 9.53972 11.6667 9.99996V11.6666C11.6667 12.1269 11.2936 12.5 10.8333 12.5H9.16667C8.70643 12.5 8.33333 12.1269 8.33333 11.6666V9.99996C8.33333 9.53972 8.70643 9.16663 9.16667 9.16663Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default HRIcon;
