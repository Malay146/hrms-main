"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/utils/cn";
import Logo from "@/components/icons/logo";
import HomeIcon from "@/components/icons/sidebar/home";
import PeopleIcon from "@/components/icons/sidebar/people";
import HRIcon from "@/components/icons/sidebar/hr";
import AiIcon from "@/components/icons/sidebar/ai";
import NotificationIcon from "@/components/icons/notification";
import SettingsIcon from "@/components/icons/settings";
import DarkIcon from "@/components/icons/dark";
import LightIcon from "@/components/icons/light";
import LogoutIcon from "@/components/icons/logout";
import MyProfileIcon from "@/components/icons/my-profile";
import BookIcon from "@/components/icons/book";
import PenIcon from "@/components/icons/pen";
import CreditCardIcon from "@/components/icons/credit-card";
import { useSessionUser } from "@/components/providers/session-context";
import { canAccessAdminPath } from "@/lib/permissions";
import CollapsibleIcon from "@/components/icons/sidebar/collapsible";

// Dynamic Branch Connector SVG Component
interface BranchConnectorProps {
  count: number;
  activeChildIndex: number;
}

const BranchConnector = ({ count, activeChildIndex }: BranchConnectorProps) => {
  if (count <= 0) return null;

  const height = 32 * count - 8;
  const path =
    `M0.5 0V12 M24.5 24H8.5C4.08172 24 0.5 20.4183 0.5 16V12` +
    Array.from({ length: count - 1 }, (_, i) => {
      const y = 56 + i * 32;
      return ` M0.5 12V${y - 8}C0.5 ${y - 8 + 4.08172} 4.08172 ${y} 8.5 ${y}H24.5`;
    }).join("");

  const activePath =
    activeChildIndex >= 0
      ? `M0.5 0 V${24 + activeChildIndex * 32 - 8} C0.5 ${24 + activeChildIndex * 32 - 8 + 4.08172} 4.08172 ${24 + activeChildIndex * 32} 8.5 ${24 + activeChildIndex * 32} H24.5`
      : null;

  return (
    <svg
      width="25"
      height={height + 20}
      viewBox={`0 -20 25 ${height + 20}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute left-[-1px] top-[-20px] select-none pointer-events-none"
    >
      <path d={path} stroke="currentColor" className="text-zinc-200 dark:text-zinc-700" strokeWidth="1.5" />
      {activePath && (
        <path
          d={activePath}
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-text-primary"
        />
      )}
    </svg>
  );
};

// Sidebar Types
interface SidebarSubItem {
  label: string;
  href: string;
}

interface SidebarItemType {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  children?: SidebarSubItem[];
  isDivider?: boolean;
}

// Sidebar Navigation Configuration
const adminNavItems: SidebarItemType[] = [
  {
    label: "Dashboard",
    icon: HomeIcon,
    href: "/admin",
  },
  {
    label: "People",
    icon: PeopleIcon,
    children: [
      { label: "Employees", href: "/admin/people/employees" },
      { label: "Department", href: "/admin/people/department" },
      { label: "Attendance", href: "/admin/people/attendance" },
      { label: "Leave", href: "/admin/people/leave" },
    ],
  },
  {
    label: "HR",
    icon: HRIcon,
    children: [
      { label: "Recruitment", href: "/admin/hr/recruitment" },
      { label: "Payruns", href: "/admin/hr/payroll" },
      { label: "Payslips", href: "/admin/hr/payroll/payslips" },
      { label: "Structures", href: "/admin/hr/payroll/structures" },
      { label: "Rules", href: "/admin/hr/payroll/rules" },
      { label: "Performance", href: "/admin/hr/performance" },
    ],
  },
  {
    label: "AI Analytics",
    icon: AiIcon,
    href: "/admin/analytics",
  },
  {
    label: "divider",
    icon: () => null,
    isDivider: true,
  },
  {
    label: "Notification",
    icon: NotificationIcon,
    href: "/admin/notifications",
  },
  {
    label: "Users",
    icon: PeopleIcon,
    href: "/admin/users",
  },
  {
    label: "Settings",
    icon: SettingsIcon,
    href: "/admin/settings",
  },
];

const employeeNavItems: SidebarItemType[] = [
  {
    label: "Dashboard",
    icon: HomeIcon,
    href: "/employee",
  },
  {
    label: "My Profile",
    icon: MyProfileIcon,
    href: "/employee/profile",
  },
  {
    label: "My Attendance",
    icon: BookIcon,
    href: "/employee/attendance",
  },
  {
    label: "My Leave",
    icon: PenIcon,
    href: "/employee/leave",
  },
  {
    label: "My Payroll",
    icon: CreditCardIcon,
    href: "/employee/payroll",
  },
  {
    label: "divider",
    icon: () => null,
    isDivider: true,
  },
  {
    label: "Notification",
    icon: NotificationIcon,
    href: "/employee/notifications",
  },
  {
    label: "Settings",
    icon: SettingsIcon,
    href: "/employee/settings",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user = useSessionUser();
  const isAdminPortal = pathname.startsWith("/admin");
  const items = isAdminPortal
    ? adminNavItems
        .map((item) => {
          if (item.isDivider) return item;
          if (item.children) {
            const children = item.children.filter((child) => canAccessAdminPath(user.role, child.href));
            if (children.length === 0) return null;
            return { ...item, children };
          }
          if (item.href && !canAccessAdminPath(user.role, item.href)) return null;
          return item;
        })
        .filter((item): item is SidebarItemType => Boolean(item))
    : employeeNavItems;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    People: true, // Expanded by default as in the screenshot
    HR: true, // Expanded by default as in the screenshot
  });

  // Toggle expandable navigation section
  const toggleSection = (label: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-border transition-all duration-300 ease-in-out select-none",
        isCollapsed ? "w-[72px]" : "w-64",
      )}
    >
      {/* Sidebar Header */}
      <div
        className={cn(
          "flex items-center p-4 h-[60px] select-none",
          isCollapsed ? "justify-center" : "justify-between",
        )}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-surface shadow-xs shrink-0">
              <Logo className="w-4 h-4" />
            </div>
            <span className="text-h4 font-bold text-text-primary tracking-tight truncate">
              HRMS
            </span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg text-icon-secondary hover:text-text-primary hover:bg-surface-hover transition-colors focus:outline-none"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <CollapsibleIcon
            className={cn(
              "w-5 h-5 transition-transform duration-200",
              isCollapsed && "rotate-180",
            )}
          />
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {items.map((item, idx) => {
          if (item.isDivider) {
            return (
              <hr key={`divider-${idx}`} className="border-divider my-4 mx-1" />
            );
          }

          const Icon = item.icon;
          const isExpandable = !!item.children;
          const isExpanded = expandedSections[item.label] && !isCollapsed;
          const isItemActive =
            item.href === pathname ||
            (item.children &&
              item.children.some(
                (child) =>
                  pathname === child.href ||
                  pathname.startsWith(child.href + "/"),
              ));

          const activeChildIndex = item.children
            ? item.children.findIndex(
                (child) =>
                  pathname === child.href ||
                  pathname.startsWith(child.href + "/"),
              )
            : -1;

          // Base styling for top-level item
          const baseItemClass = cn(
            "flex items-center w-full rounded-lg text-body font-medium transition-all duration-150 group",
            isCollapsed ? "justify-center p-2.5" : "px-3 py-2 gap-3",
          );

          const activeItemClass = isItemActive
            ? "bg-text-primary text-text-inverse hover:bg-text-primary"
            : "text-text-primary hover:bg-surface-hover hover:text-text-primary";

          const iconClass = cn(
            "w-5 h-5 shrink-0 transition-colors",
            isItemActive
              ? "text-text-inverse"
              : "text-icon-secondary group-hover:text-icon-primary",
          );

          if (isExpandable && item.children) {
            return (
              <div key={item.label} className="">
                <button
                  onClick={() => !isCollapsed && toggleSection(item.label)}
                  className={cn(
                    baseItemClass,
                    activeItemClass,
                    isCollapsed && "cursor-pointer",
                  )}
                  disabled={isCollapsed}
                >
                  <Icon className={iconClass} />
                  {!isCollapsed && (
                    <span className="truncate flex-1 text-left">
                      {item.label}
                    </span>
                  )}
                </button>

                {/* Sub Menu / Inner Tabs */}
                {isExpanded && (
                  <div className="relative ml-[22px] flex flex-col pt-2">
                    {/* Reusable branches vector connector */}
                    <BranchConnector
                      count={item.children.length}
                      activeChildIndex={activeChildIndex}
                    />

                    {item.children.map((child) => {
                      const isChildActive =
                        pathname === child.href ||
                        pathname.startsWith(child.href + "/");
                      return (
                        <Link
                          key={child.label}
                          href={child.href}
                          className={cn(
                            "h-8 flex items-center pl-[32px] text-body rounded-md transition-colors duration-150",
                            isChildActive
                              ? "text-text-primary font-semibold"
                              : "text-text-secondary hover:text-text-primary hover:bg-surface-hover/50",
                          )}
                        >
                          <span className="truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Single Link Top-level items
          return (
            <Link
              key={item.label}
              href={item.href || "#"}
              className={cn(baseItemClass, activeItemClass)}
            >
              <Icon className={iconClass} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 space-y-2">
        {/* Dark Mode Toggle */}
        <div
          className={cn(
            "flex items-center justify-between text-body font-medium text-text-primary",
            isCollapsed ? "justify-center" : "px-3 py-1.5",
          )}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {isDarkMode ? (
              <DarkIcon className="w-5 h-5 shrink-0 text-icon-secondary" />
            ) : (
              <LightIcon className="w-5 h-5 shrink-0 text-icon-secondary" />
            )}
            {!isCollapsed && <span className="truncate">{isDarkMode ? "Dark mode" : "Light mode"}</span>}
          </div>
          {!isCollapsed && (
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-1",
                isDarkMode ? "bg-primary" : "bg-border-strong",
              )}
              aria-label="Toggle dark mode"
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-xs ring-0 transition duration-200 ease-in-out",
                  isDarkMode
                    ? "translate-x-4 bg-surface"
                    : "translate-x-0 bg-icon-primary",
                )}
              />
            </button>
          )}
        </div>

        {/* Logout Link */}
        <Link
          href="/logout"
          className={cn(
            "flex items-center rounded-lg text-body font-medium text-error hover:bg-error-soft/30 transition-all duration-150 group",
            isCollapsed ? "justify-center p-2.5" : "px-3 py-2 gap-3",
          )}
        >
          <LogoutIcon className="w-5 h-5 shrink-0 text-error" />
          {!isCollapsed && <span className="truncate">Logout</span>}
        </Link>
      </div>
    </aside>
  );
}
