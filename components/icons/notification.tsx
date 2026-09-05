import React from "react";
import { cn } from "@/utils/cn";

interface IconProps {
  className?: string;
}

const NotificationIcon = ({ className }: IconProps) => {
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
        d="M3.88885 7.22223C3.88885 3.84755 6.62528 1.11111 9.99996 1.11111C13.3746 1.11111 16.1111 3.84755 16.1111 7.22223V11.9444C16.1111 12.712 16.7324 13.3333 17.5 13.3333C17.9602 13.3333 18.3333 13.7064 18.3333 14.1667C18.3333 14.6269 17.9602 15 17.5 15H2.49996C2.03973 15 1.66663 14.6269 1.66663 14.1667C1.66663 13.7064 2.03973 13.3333 2.49996 13.3333C3.2675 13.3333 3.88885 12.712 3.88885 11.9444V7.22223Z"
        fill="currentColor"
        fillOpacity="0.4"
      />
      <path
        d="M11.3334 16.6667H8.66779C8.50002 16.6667 8.34224 16.7422 8.23668 16.8722C8.13113 17.0022 8.09002 17.1733 8.12446 17.3367C8.31668 18.25 9.08891 18.8889 10.0011 18.8889C10.9133 18.8889 11.6856 18.25 11.8778 17.3367C11.9122 17.1733 11.8711 17.0022 11.7656 16.8722C11.66 16.7422 11.5011 16.6667 11.3334 16.6667Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default NotificationIcon;