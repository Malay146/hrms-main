"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import SearchIcon from "@/components/icons/navbar/search";
import CommandIcon from "@/components/icons/navbar/command";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useSessionUser } from "@/components/providers/session-context";
import { canAccessAdminPath, isStaffRole } from "@/lib/auth/permissions";

type CommandEntry = {
  label: string;
  href: string;
  group: string;
};

const adminCommands: CommandEntry[] = [
  { group: "Overview", label: "Dashboard", href: "/admin" },
  { group: "People", label: "Employees", href: "/admin/people/employees" },
  { group: "People", label: "Contracts", href: "/admin/people/contracts" },
  { group: "People", label: "Working Schedules", href: "/admin/people/schedules" },
  { group: "People", label: "Departments", href: "/admin/people/department" },
  { group: "People", label: "Attendance", href: "/admin/people/attendance" },
  { group: "People", label: "Time Off Requests", href: "/admin/people/leave" },
  { group: "People", label: "Allocations", href: "/admin/people/leave/allocations" },
  { group: "People", label: "Leave Types", href: "/admin/people/leave/types" },
  { group: "Payroll", label: "Payruns", href: "/admin/hr/payroll" },
  { group: "Payroll", label: "Payslips", href: "/admin/hr/payroll/payslips" },
  { group: "Payroll", label: "Structures", href: "/admin/hr/payroll/structures" },
  { group: "Payroll", label: "Rules", href: "/admin/hr/payroll/rules" },
  { group: "HR", label: "Recruitment", href: "/admin/hr/recruitment" },
  { group: "HR", label: "Performance", href: "/admin/hr/performance" },
  { group: "Workspace", label: "AI Analytics", href: "/admin/analytics" },
  { group: "Account", label: "Notifications", href: "/admin/notifications" },
  { group: "Account", label: "Settings", href: "/admin/settings" },
];

const employeeCommands: CommandEntry[] = [
  { group: "Overview", label: "Dashboard", href: "/employee" },
  { group: "Self-service", label: "My Profile", href: "/employee/profile" },
  { group: "Self-service", label: "My Attendance", href: "/employee/attendance" },
  { group: "Self-service", label: "My Leave", href: "/employee/leave" },
  { group: "Self-service", label: "My Payroll", href: "/employee/payroll" },
  { group: "Self-service", label: "My Performance", href: "/employee/performance" },
  { group: "Account", label: "Notifications", href: "/employee/notifications" },
  { group: "Account", label: "Settings", href: "/employee/settings" },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSessionUser();
  const isAdminPortal = pathname.startsWith("/admin");

  const grouped = useMemo(() => {
    const source = isAdminPortal
      ? adminCommands.filter((item) => canAccessAdminPath(user.role, item.href))
      : employeeCommands;
    const map = new Map<string, CommandEntry[]>();
    for (const item of source) {
      const rows = map.get(item.group) ?? [];
      rows.push(item);
      map.set(item.group, rows);
    }
    return [...map.entries()];
  }, [isAdminPortal, user.role]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} label="Quick search">
      <div className="flex items-center gap-2 border-b border-border px-3 h-12">
        <SearchIcon className="size-5 text-icon-secondary shrink-0" />
        <CommandInput placeholder="Find something…" />
        <div className="flex items-center gap-0.5 bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-text-secondary text-[10px] font-medium leading-none shrink-0 shadow-3xs">
          <CommandIcon className="size-4" />
          <span>K</span>
        </div>
      </div>
      <CommandList>
        <CommandEmpty>No matching pages.</CommandEmpty>
        {grouped.map(([group, items], index) => (
          <div key={group}>
            {index > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading={group}>
              {items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${item.group} ${item.label}`}
                  onSelect={() => go(item.href)}
                >
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
        {isStaffRole(user.role) ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Switch">
              <CommandItem
                value="switch portal"
                onSelect={() => go(isAdminPortal ? "/employee" : "/admin")}
              >
                {isAdminPortal ? "My self-service" : "Admin app"}
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
