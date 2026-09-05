import React from "react";
import { cn } from "@/utils/cn";

interface IconProps {
  className?: string;
}

const CollapsibleIcon = ({ className }: IconProps) => {
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
        d="M1.66675 10C1.66675 6.92572 1.66675 5.38858 2.34493 4.29898C2.59583 3.89585 2.90751 3.54522 3.26584 3.26295C4.23438 2.5 5.60072 2.5 8.33341 2.5H11.6667C14.3994 2.5 15.7657 2.5 16.7343 3.26295C17.0927 3.54522 17.4043 3.89585 17.6552 4.29898C18.3334 5.38858 18.3334 6.92572 18.3334 10C18.3334 13.0742 18.3334 14.6114 17.6552 15.701C17.4043 16.1042 17.0927 16.4547 16.7343 16.7371C15.7657 17.5 14.3994 17.5 11.6667 17.5H8.33341C5.60072 17.5 4.23438 17.5 3.26584 16.7371C2.90751 16.4547 2.59583 16.1042 2.34493 15.701C1.66675 14.6114 1.66675 13.0742 1.66675 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7.91675 2.5V17.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4.16675 5.83333H5.00008M4.16675 8.33333H5.00008"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default CollapsibleIcon;