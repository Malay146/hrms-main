"use client";

import React from "react";
import {
  Mail,
  Phone,
  MapPin,
  Calendar as CalendarIcon,
  ShieldCheck,
} from "lucide-react";

export default function EmployeeProfilePage() {
  const profile = {
    name: "William Joseph",
    avatar: "WJ",
    role: "HR Specialist",
    department: "Human Resources",
    email: "william.joseph@organization.com",
    phone: "+91 98765 43210",
    location: "Mumbai Office, IN",
    joinDate: "12 Mar 2024",
    status: "Active",
  };

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6 text-left">
      <div className="flex flex-col">
        <h1 className="text-h1 font-medium">My Profile</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          View your registered personal details and employment files.
        </p>
      </div>

      <div className="border border-border rounded-xl p-6 bg-surface flex flex-col sm:flex-row items-center sm:items-start gap-6 select-none mt-2">
        <div className="size-20 rounded-full bg-zinc-150 border border-zinc-300 text-zinc-800 font-bold text-2xl flex items-center justify-center shrink-0">
          {profile.avatar}
        </div>
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-950 leading-tight">
              {profile.name}
            </h2>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-full text-[10px] font-bold self-start">
              {profile.status}
            </span>
          </div>
          <p className="text-sm font-semibold text-zinc-500">
            {profile.role} &bull; {profile.department}
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-semibold text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {profile.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" />
              {profile.phone}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {profile.location}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="size-3.5" />
              Joined {profile.joinDate}
            </span>
          </div>
        </div>
      </div>

      {/* Employment Details Section */}
      <div className="border border-border rounded-xl p-5 bg-surface mt-2 flex flex-col gap-4">
        <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
          <ShieldCheck className="size-4 text-zinc-400" />
          Employment Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-zinc-500">
          <div className="flex flex-col gap-1">
            <span>Employee ID</span>
            <span className="text-zinc-900 font-bold text-sm">
              EMP-2024-001
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span>Manager Name</span>
            <span className="text-zinc-900 font-bold text-sm">
              Bruce Banner
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span>Employment Type</span>
            <span className="text-zinc-900 font-bold text-sm">
              Full-Time Contract
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
