import React from "react";
import { cn } from "@/utils/cn";

interface IconProps {
  className?: string;
}

const DarkIcon = ({ className }: IconProps) => {
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
        d="M17.9167 11.732C16.917 12.2657 15.7751 12.5684 14.5626 12.5684C10.6243 12.5684 7.43164 9.37573 7.43164 5.43735C7.43164 4.22486 7.73425 3.08305 8.26807 2.08331C4.72308 2.91413 2.08337 6.09592 2.08337 9.89423C2.08337 14.3249 5.67512 17.9166 10.1058 17.9166C13.9041 17.9166 17.0859 15.277 17.9167 11.732Z"
        fill="currentColor"
        fillOpacity="0.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default DarkIcon;