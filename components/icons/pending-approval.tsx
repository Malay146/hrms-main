import React from "react";
import { cn } from "@/utils/cn";

interface IconProps {
  className?: string;
}

const PendingApprovalIcon = ({ className }: IconProps) => {
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
        d="M3.33325 16.6667C3.33325 10.2233 8.5562 5 14.9999 5C21.4436 5 26.6666 10.2233 26.6666 16.6667C26.6666 23.11 21.4436 28.3333 14.9999 28.3333C8.5562 28.3333 3.33325 23.11 3.33325 16.6667Z"
        fill="currentColor"
        fillOpacity="0.4"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.286 11.9528C10.7742 11.4646 11.5656 11.4646 12.0538 11.9528L15.8838 15.7828C16.372 16.2709 16.372 17.0623 15.8838 17.5505C15.3956 18.0387 14.6042 18.0387 14.116 17.5505L10.286 13.7205C9.79788 13.2324 9.79788 12.4409 10.286 11.9528Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M22.8661 3.69946C23.3543 3.21131 24.1456 3.21131 24.6338 3.69946L27.9671 7.03279C28.4553 7.52094 28.4553 8.31241 27.9671 8.80056C27.479 9.28871 26.6876 9.28871 26.1995 8.80056L22.8661 5.46722C22.378 4.97907 22.378 4.18761 22.8661 3.69946Z"
        fill="currentColor"
      />
      <path
        d="M11.25 0.833328C10.5597 0.833328 10 1.39297 10 2.08333C10 2.77368 10.5597 3.33333 11.25 3.33333H13.75V5.06616C14.1607 5.02243 14.5777 4.99999 15 4.99999C15.4223 4.99999 15.8393 5.02243 16.25 5.06616V3.33333H18.75C19.4403 3.33333 20 2.77368 20 2.08333C20 1.39297 19.4403 0.833328 18.75 0.833328H11.25Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default PendingApprovalIcon;
