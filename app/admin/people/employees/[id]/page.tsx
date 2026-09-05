"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Mail, 
  MapPin, 
  Phone, 
  Calendar, 
  Briefcase, 
  ShieldAlert, 
  Award,
  HardDrive, 
  FileText, 
  Activity as ActivityIcon, 
  Download,
  Info
} from "lucide-react";
import { cn } from "@/utils/cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";

// Employee Database (matching the list page)
const employeesDatabase = [
  {
    id: "EMP001",
    name: "John Cena",
    email: "john.cena@organization.com",
    avatar: "JC",
    department: "Engineering",
    designation: "Frontend Engineer",
    type: "Full-time",
    joinDate: "12 Jun 2024",
    status: "Active",
    phone: "+1 (555) 019-2831",
    address: "123 Ring Road, Los Angeles, CA",
    dob: "23 Apr 1990",
    gender: "Male",
    emergencyContact: "Elizabeth Cena (Spouse) - +1 (555) 019-2832",
    manager: "Bruce Banner",
    location: "HQ - Los Angeles",
  },
  {
    id: "EMP002",
    name: "Sarah Mills",
    email: "sarah.mills@organization.com",
    avatar: "SM",
    department: "HR",
    designation: "HR Generalist",
    type: "Full-time",
    joinDate: "05 Jan 2024",
    status: "Active",
    phone: "+1 (555) 014-9988",
    address: "456 Oak Avenue, San Francisco, CA",
    dob: "14 Jul 1993",
    gender: "Female",
    emergencyContact: "James Mills (Father) - +1 (555) 014-9989",
    manager: "Bruce Banner",
    location: "Remote - California",
  },
  {
    id: "EMP003",
    name: "Mark Lou",
    email: "mark.lou@organization.com",
    avatar: "ML",
    department: "Sales",
    designation: "Sales Executive",
    type: "Full-time",
    joinDate: "20 Mar 2025",
    status: "On Leave",
    phone: "+1 (555) 015-3344",
    address: "789 Pine Street, Seattle, WA",
    dob: "30 Nov 1988",
    gender: "Male",
    emergencyContact: "Linda Lou (Mother) - +1 (555) 015-3345",
    manager: "William Vance",
    location: "HQ - Seattle Office",
  },
  {
    id: "EMP004",
    name: "Kimi Nowa",
    email: "kimi.nowa@organization.com",
    avatar: "KN",
    department: "Marketing",
    designation: "Marketing Specialist",
    type: "Part-time",
    joinDate: "15 Sep 2024",
    status: "Active",
    phone: "+1 (555) 017-6622",
    address: "101 Cherry Lane, New York, NY",
    dob: "08 Oct 1995",
    gender: "Female",
    emergencyContact: "Kenji Nowa (Brother) - +1 (555) 017-6623",
    manager: "Emma Watson",
    location: "NYC Co-working",
  },
  {
    id: "EMP005",
    name: "William Vance",
    email: "william.vance@organization.com",
    avatar: "WV",
    department: "Finance",
    designation: "Financial Analyst",
    type: "Full-time",
    joinDate: "01 Feb 2023",
    status: "Active",
    phone: "+1 (555) 018-7711",
    address: "202 Maple Boulevard, Chicago, IL",
    dob: "17 Sep 1985",
    gender: "Male",
    emergencyContact: "Patricia Vance (Spouse) - +1 (555) 018-7712",
    manager: "Bruce Banner",
    location: "HQ - Los Angeles",
  },
  {
    id: "EMP006",
    name: "David Smith",
    email: "david.smith@organization.com",
    avatar: "DS",
    department: "Engineering",
    designation: "Backend Architect",
    type: "Full-time",
    joinDate: "10 Oct 2022",
    status: "Active",
    phone: "+1 (555) 011-2233",
    address: "303 Birch Court, Boston, MA",
    dob: "02 Jun 1982",
    gender: "Male",
    emergencyContact: "Mary Smith (Mother) - +1 (555) 011-2234",
    manager: "Bruce Banner",
    location: "HQ - Los Angeles",
  },
  {
    id: "EMP007",
    name: "Emma Watson",
    email: "emma.watson@organization.com",
    avatar: "EW",
    department: "Marketing",
    designation: "SEO Lead",
    type: "Contractor",
    joinDate: "18 Aug 2025",
    status: "Inactive",
    phone: "+1 (555) 012-3344",
    address: "404 Cedar Way, Austin, TX",
    dob: "15 Apr 1991",
    gender: "Female",
    emergencyContact: "Chris Watson (Brother) - +1 (555) 012-3345",
    manager: "Bruce Banner",
    location: "Remote - Texas",
  },
  {
    id: "EMP008",
    name: "Alex Mercer",
    email: "alex.mercer@organization.com",
    avatar: "AM",
    department: "Engineering",
    designation: "QA Engineer",
    type: "Intern",
    joinDate: "01 Dec 2025",
    status: "Active",
    phone: "+1 (555) 013-4455",
    address: "505 Elm Drive, Denver, CO",
    dob: "20 May 1999",
    gender: "Male",
    emergencyContact: "Richard Mercer (Father) - +1 (555) 013-4456",
    manager: "John Cena",
    location: "Denver Office",
  },
  {
    id: "EMP009",
    name: "Clara Oswald",
    email: "clara.oswald@organization.com",
    avatar: "CO",
    department: "HR",
    designation: "Recruiting Coordinator",
    type: "Full-time",
    joinDate: "14 Jul 2024",
    status: "On Leave",
    phone: "+1 (555) 016-5566",
    address: "606 Walnut Lane, Miami, FL",
    dob: "23 Nov 1994",
    gender: "Female",
    emergencyContact: "Danny Oswald (Spouse) - +1 (555) 016-5567",
    manager: "Sarah Mills",
    location: "HQ - Miami",
  },
  {
    id: "EMP010",
    name: "Bruce Banner",
    email: "bruce.banner@organization.com",
    avatar: "BB",
    department: "Engineering",
    designation: "R&D Specialist",
    type: "Full-time",
    joinDate: "30 May 2021",
    status: "Active",
    phone: "+1 (555) 019-9900",
    address: "707 Shadow Creek, New York, NY",
    dob: "18 Dec 1978",
    gender: "Male",
    emergencyContact: "Betty Banner (Spouse) - +1 (555) 019-9901",
    manager: "Board Directors",
    location: "Remote - New York",
  },
];

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Overview");

  const empId = params.id as string;
  const dbEmployee = employeesDatabase.find((emp) => emp.id === empId);
  const [employee, setEmployee] = useState(dbEmployee);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [draftProfile, setDraftProfile] = useState({
    phone: dbEmployee?.phone ?? "",
    address: dbEmployee?.address ?? "",
    designation: dbEmployee?.designation ?? "",
    location: dbEmployee?.location ?? "",
  });

  const handleDownload = (label: string) => {
    toast.success("Download started", { description: `${label} saved locally.` });
  };

  const handleSaveProfile = () => {
    if (!employee) return;
    setEmployee({
      ...employee,
      phone: draftProfile.phone.trim(),
      address: draftProfile.address.trim(),
      designation: draftProfile.designation.trim(),
      location: draftProfile.location.trim(),
    });
    setIsEditOpen(false);
    toast.success("Profile updated", { description: `${employee.name}'s details saved.` });
  };

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <h2 className="text-xl font-bold text-zinc-950">Employee Not Found</h2>
        <p className="text-zinc-500 max-w-sm">The employee ID you entered does not exist or has been removed.</p>
        <button 
          onClick={() => router.push("/admin/people/employees")}
          className="cursor-pointer px-4 py-2 bg-zinc-950 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors"
        >
          Back to Employees List
        </button>
      </div>
    );
  }

  // Tabs List
  const tabs = [
    "Overview",
    "Attendance",
    "Leave",
    "Payroll",
    "Performance",
    "Assets",
    "Documents",
    "Activity",
  ];

  // Status Badge Class Helper
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
      case "On Leave":
        return "bg-amber-50 text-amber-700 border border-amber-200/50";
      case "Inactive":
      default:
        return "bg-zinc-50 text-zinc-500 border border-zinc-200";
    }
  };

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/admin/people/employees")}
          className="cursor-pointer flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 font-semibold transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Employees
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setDraftProfile({
                phone: employee.phone,
                address: employee.address,
                designation: employee.designation,
                location: employee.location,
              });
              setIsEditOpen(true);
            }}
            className="cursor-pointer px-3.5 py-1.5 border border-border bg-surface hover:bg-surface-hover hover:border-border-strong text-zinc-700 text-sm font-semibold rounded-lg shadow-2xs active:scale-[0.98] transition-[transform,background-color,border-color] duration-150 ease-out"
          >
            Edit Profile
          </button>
        </div>
      </div>

      {/* Profile Header Banner */}
      <div className="border border-border rounded-xl p-6 bg-surface flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5">
        <PersonAvatar
          name={employee.name}
          size={80}
        />
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <h2 className="text-2xl font-medium text-zinc-950 leading-tight">{employee.name}</h2>
            <span className={cn("whitespace-nowrap inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold self-center sm:self-auto", getStatusBadgeClass(employee.status))}>
              {employee.status}
            </span>
          </div>
          <p className="text-sm font-medium text-zinc-500">
            {employee.designation} &bull; {employee.department}
          </p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-2 text-xs text-zinc-500 font-semibold">
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {employee.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" />
              {employee.phone}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {employee.location}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border flex items-center gap-6 overflow-x-auto select-none scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "cursor-pointer pb-3 text-sm font-semibold border-b-2 transition-all shrink-0 focus:outline-none",
              activeTab === tab 
                ? "border-zinc-950 text-zinc-950" 
                : "border-transparent text-zinc-400 hover:text-zinc-800"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="min-h-[400px]">
        {/* OVERVIEW PANEL */}
        {activeTab === "Overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Details */}
            <div className="border border-border rounded-xl p-6 bg-surface flex flex-col gap-4">
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2 pb-3 border-b border-border">
                Personal Information
              </h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                <div>
                  <span className="text-xs text-zinc-400 font-semibold block uppercase">Phone Number</span>
                  <span className="text-zinc-800 font-medium">{employee.phone}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-400 font-semibold block uppercase">Email Address</span>
                  <span className="text-zinc-800 font-medium truncate block">{employee.email}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-400 font-semibold block uppercase">Date of Birth</span>
                  <span className="text-zinc-800 font-medium">{employee.dob}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-400 font-semibold block uppercase">Gender</span>
                  <span className="text-zinc-800 font-medium">{employee.gender}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-zinc-400 font-semibold block uppercase">Home Address</span>
                  <span className="text-zinc-800 font-medium">{employee.address}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-zinc-400 font-semibold block uppercase">Emergency Contact</span>
                  <span className="text-zinc-800 font-medium">{employee.emergencyContact}</span>
                </div>
              </div>
            </div>

            {/* Job Details */}
            <div className="border border-border rounded-xl p-6 bg-surface flex flex-col gap-4">
              <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2 pb-3 border-b border-border">
                Job Information
              </h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                <div>
                  <span className="text-xs text-zinc-400 font-semibold block uppercase">Employee ID</span>
                  <span className="text-zinc-800 font-medium">{employee.id}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-400 font-semibold block uppercase">Employment Type</span>
                  <span className="text-zinc-800 font-medium">{employee.type}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-400 font-semibold block uppercase">Department</span>
                  <span className="text-zinc-800 font-medium">{employee.department}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-400 font-semibold block uppercase">Job Title</span>
                  <span className="text-zinc-800 font-medium">{employee.designation}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-400 font-semibold block uppercase">Date of Joining</span>
                  <span className="text-zinc-800 font-medium">{employee.joinDate}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-400 font-semibold block uppercase">Direct Manager</span>
                  <span className="text-zinc-800 font-medium">{employee.manager}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-zinc-400 font-semibold block uppercase">Work Location</span>
                  <span className="text-zinc-800 font-medium">{employee.location}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ATTENDANCE PANEL */}
        {activeTab === "Attendance" && (
          <div className="flex flex-col gap-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Present Days", value: "22 days", color: "text-emerald-600" },
                { label: "Absent Days", value: "1 days", color: "text-red-500" },
                { label: "On Leave", value: "2 days", color: "text-amber-500" },
                { label: "Late In", value: "0 days", color: "text-zinc-500" },
              ].map((stat, idx) => (
                <div key={idx} className="border border-border rounded-xl p-5 bg-surface">
                  <span className="text-xs font-semibold text-zinc-400 uppercase">{stat.label}</span>
                  <p className={cn("text-xl font-bold mt-2", stat.color)}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Attendance List */}
            <div className="border border-border rounded-xl bg-surface overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-zinc-50/80 border-b border-border text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6">Punch In</th>
                    <th className="py-3 px-6">Punch Out</th>
                    <th className="py-3 px-6">Total Hours</th>
                    <th className="py-3 px-6 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-zinc-700 font-medium">
                  {[
                    { date: "17 Jul 2026", in: "09:00 AM", out: "05:00 PM", hours: "8.0 hrs", status: "On Time" },
                    { date: "16 Jul 2026", in: "09:05 AM", out: "05:12 PM", hours: "8.1 hrs", status: "On Time" },
                    { date: "15 Jul 2026", in: "09:00 AM", out: "05:00 PM", hours: "8.0 hrs", status: "On Time" },
                    { date: "14 Jul 2026", in: "--:--", out: "--:--", hours: "0.0 hrs", status: "On Leave" },
                    { date: "13 Jul 2026", in: "09:00 AM", out: "05:00 PM", hours: "8.0 hrs", status: "On Time" },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/40">
                      <td className="py-4 px-6">{row.date}</td>
                      <td className="py-4 px-6 text-zinc-500">{row.in}</td>
                      <td className="py-4 px-6 text-zinc-500">{row.out}</td>
                      <td className="py-4 px-6 text-zinc-500">{row.hours}</td>
                      <td className="py-4 px-6">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-semibold",
                          row.status === "On Time" 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50" 
                            : "bg-amber-50 text-amber-700 border border-amber-200/50"
                        )}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LEAVE PANEL */}
        {activeTab === "Leave" && (
          <div className="flex flex-col gap-6">
            {/* Leave Balance Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Annual Leave", balance: "15 / 20 days", desc: "5 days taken" },
                { label: "Sick Leave", balance: "8 / 10 days", desc: "2 days taken" },
                { label: "Casual Leave", balance: "6 / 12 days", desc: "6 days taken" },
              ].map((card, idx) => (
                <div key={idx} className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-zinc-400 uppercase">{card.label}</span>
                    <p className="text-xl font-bold text-zinc-950 mt-2">{card.balance}</p>
                  </div>
                  <span className="text-xs text-zinc-400 font-medium mt-3 block">{card.desc}</span>
                </div>
              ))}
            </div>

            {/* Leave History List */}
            <div className="border border-border rounded-xl bg-surface overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-zinc-50/80 border-b border-border text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    <th className="py-3 px-6">Leave Type</th>
                    <th className="py-3 px-6">Duration</th>
                    <th className="py-3 px-6">Reason</th>
                    <th className="py-3 px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-zinc-700 font-medium">
                  {[
                    { type: "Sick Leave", duration: "14 Jul 2026 - 15 Jul 2026 (2 days)", reason: "Medical checkup and rest", status: "Approved" },
                    { type: "Casual Leave", duration: "01 May 2026 - 02 May 2026 (2 days)", reason: "Family event", status: "Approved" },
                    { type: "Annual Leave", duration: "10 Dec 2025 - 15 Dec 2025 (5 days)", reason: "Winter vacations", status: "Approved" },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/40">
                      <td className="py-4 px-6">{row.type}</td>
                      <td className="py-4 px-6 text-zinc-500">{row.duration}</td>
                      <td className="py-4 px-6 text-zinc-400 truncate max-w-xs">{row.reason}</td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAYROLL PANEL */}
        {activeTab === "Payroll" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Salary Structure Info */}
            <div className="lg:col-span-5 border border-border rounded-xl p-6 bg-surface flex flex-col gap-4">
              <h3 className="text-base font-bold text-zinc-950 pb-3 border-b border-border">
                Salary Structure
              </h3>
              <div className="flex flex-col gap-3.5 text-sm font-medium">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Base Salary</span>
                  <span className="text-zinc-950 font-bold">$7,500.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">HRA Allowance</span>
                  <span className="text-zinc-950">$500.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Medical Allowance</span>
                  <span className="text-zinc-950">$250.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">PF Contribution</span>
                  <span className="text-red-500">-$350.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Professional Tax</span>
                  <span className="text-red-500">-$150.00</span>
                </div>
                <hr className="border-border my-1" />
                <div className="flex items-center justify-between text-base font-bold pt-1">
                  <span className="text-zinc-900">Net Take-home</span>
                  <span className="text-zinc-950">$7,750.00</span>
                </div>
              </div>
            </div>

            {/* Payslips List */}
            <div className="lg:col-span-7 border border-border rounded-xl p-6 bg-surface flex flex-col gap-4">
              <h3 className="text-base font-bold text-zinc-950 pb-3 border-b border-border">
                Pay Slips
              </h3>
              <div className="flex flex-col divide-y divide-border">
                {[
                  { month: "June 2026", date: "Paid on 30 Jun 2026", amount: "$7,750.00" },
                  { month: "May 2026", date: "Paid on 31 May 2026", amount: "$7,750.00" },
                  { month: "April 2026", date: "Paid on 30 Apr 2026", amount: "$7,750.00" },
                  { month: "March 2026", date: "Paid on 31 Mar 2026", amount: "$7,750.00" },
                ].map((slip, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-zinc-950">{slip.month}</span>
                      <span className="text-xs text-zinc-400 font-semibold">{slip.date}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold text-zinc-950">{slip.amount}</span>
                      <button
                        type="button"
                        onClick={() => handleDownload(`${slip.month} payslip`)}
                        className="cursor-pointer p-1.5 rounded-lg border border-border hover:border-border-strong bg-surface hover:bg-surface-hover text-zinc-500 hover:text-zinc-900 active:scale-95 transition-[transform,background-color,border-color,color] duration-150 ease-out"
                      >
                        <Download className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PERFORMANCE PANEL */}
        {activeTab === "Performance" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Reviews Score */}
            <div className="lg:col-span-5 border border-border rounded-xl p-6 bg-surface flex flex-col gap-4">
              <h3 className="text-base font-bold text-zinc-950 pb-3 border-b border-border">
                Performance Rating
              </h3>
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="size-24 rounded-full border-4 border-zinc-950 flex flex-col items-center justify-center font-bold text-zinc-950">
                  <span className="text-3xl leading-none">4.8</span>
                  <span className="text-[10px] uppercase font-semibold text-zinc-400 mt-1">out of 5</span>
                </div>
                <h4 className="text-sm font-semibold text-zinc-900 mt-4">Exceeds Expectations</h4>
                <p className="text-xs text-zinc-400 mt-1.5 max-w-[200px] leading-relaxed">
                  Consistently delivers high-quality code and assists junior engineers.
                </p>
              </div>
            </div>

            {/* Performance Goals */}
            <div className="lg:col-span-7 border border-border rounded-xl p-6 bg-surface flex flex-col gap-4">
              <h3 className="text-base font-bold text-zinc-950 pb-3 border-b border-border">
                Current Goals
              </h3>
              <div className="flex flex-col gap-4">
                {[
                  { title: "Refactor core dashboard to use Shadcn Charts", progress: 100, due: "30 Jun 2026" },
                  { title: "Improve LCP and Web Vitals by 15%", progress: 65, due: "15 Aug 2026" },
                  { title: "Mentor junior frontend developers", progress: 40, due: "30 Sep 2026" },
                ].map((goal, idx) => (
                  <div key={idx} className="flex flex-col gap-2 border border-border rounded-lg p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-semibold text-zinc-900 leading-tight">{goal.title}</span>
                      <span className="text-xs text-zinc-400 font-semibold shrink-0 uppercase">Due {goal.due}</span>
                    </div>
                    <div className="flex items-center gap-3.5 mt-1">
                      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-zinc-950 rounded-full" 
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-zinc-800 shrink-0 min-w-[30px] text-right">
                        {goal.progress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ASSETS PANEL */}
        {activeTab === "Assets" && (
          <div className="border border-border rounded-xl bg-surface overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-border text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Asset Name</th>
                  <th className="py-3 px-6">Serial Number</th>
                  <th className="py-3 px-6">Assigned Date</th>
                  <th className="py-3 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-zinc-700 font-medium">
                {[
                  { name: 'MacBook Pro 16" (M3 Max, 36GB)', sn: "APL992831201A", date: "12 Jun 2024", status: "Active" },
                  { name: 'Dell UltraSharp 27" 4K Monitor', sn: "DEL0012938120B", date: "12 Jun 2024", status: "Active" },
                  { name: "Apple Magic Keyboard & Mouse", sn: "APL00928131B", date: "15 Jun 2024", status: "Active" },
                ].map((asset, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/40">
                    <td className="py-4 px-6 font-semibold text-zinc-900">{asset.name}</td>
                    <td className="py-4 px-6 text-zinc-500">{asset.sn}</td>
                    <td className="py-4 px-6 text-zinc-400">{asset.date}</td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                        {asset.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* DOCUMENTS PANEL */}
        {activeTab === "Documents" && (
          <div className="border border-border rounded-xl bg-surface overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-border text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Document Name</th>
                  <th className="py-3 px-6">File Size</th>
                  <th className="py-3 px-6">Uploaded Date</th>
                  <th className="py-3 px-6 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-zinc-700 font-medium">
                {[
                  { name: "Employment_Agreement_Signed.pdf", size: "2.4 MB", date: "12 Jun 2024" },
                  { name: "W4_Tax_Form_2026.pdf", size: "1.1 MB", date: "10 Jan 2026" },
                  { name: "Passport_Scan_Copy.pdf", size: "3.8 MB", date: "12 Jun 2024" },
                  { name: "Resume_CV_Cena.pdf", size: "850 KB", date: "05 Jun 2024" },
                ].map((doc, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/40">
                    <td className="py-4 px-6 font-semibold text-zinc-900 flex items-center gap-2">
                      <FileText className="size-4 text-zinc-400 shrink-0" />
                      {doc.name}
                    </td>
                    <td className="py-4 px-6 text-zinc-500">{doc.size}</td>
                    <td className="py-4 px-6 text-zinc-400">{doc.date}</td>
                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => handleDownload(doc.name)}
                        className="cursor-pointer p-1.5 rounded-lg border border-border hover:border-border-strong bg-surface hover:bg-surface-hover text-zinc-500 hover:text-zinc-900 active:scale-95 transition-[transform,background-color,border-color,color] duration-150 ease-out"
                      >
                        <Download className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ACTIVITY PANEL */}
        {activeTab === "Activity" && (
          <div className="border border-border rounded-xl bg-surface overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-border text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Timestamp</th>
                  <th className="py-3 px-6">Activity Description</th>
                  <th className="py-3 px-6">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-zinc-700 font-medium">
                {[
                  { time: "18 Jul 2026, 02:40 PM", desc: "Profile details updated (Address field)", user: "James Gordon (HR Lead)" },
                  { time: "14 Jul 2026, 09:00 AM", desc: "Leave request for 2 days auto-logged", user: "HRMS System" },
                  { time: "30 Jun 2026, 11:15 AM", desc: "Salary slips for June 2026 generated and sent", user: "Payroll Admin" },
                  { time: "15 Jun 2024, 10:00 AM", desc: "Assigned Asset: Apple Magic Keyboard & Mouse", user: "Inventory Manager" },
                  { time: "12 Jun 2024, 09:30 AM", desc: "Employee profile created, onboarding documents uploaded", user: "Sarah Mills (HR Generalist)" },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/40">
                    <td className="py-4 px-6 text-zinc-400">{row.time}</td>
                    <td className="py-4 px-6 text-zinc-900 font-semibold">{row.desc}</td>
                    <td className="py-4 px-6 text-zinc-500">{row.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Profile"
        description={employee.name}
      >
        <div className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Designation
            <input
              value={draftProfile.designation}
              onChange={(e) =>
                setDraftProfile((current) => ({
                  ...current,
                  designation: e.target.value,
                }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Phone
            <input
              value={draftProfile.phone}
              onChange={(e) =>
                setDraftProfile((current) => ({
                  ...current,
                  phone: e.target.value,
                }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Location
            <input
              value={draftProfile.location}
              onChange={(e) =>
                setDraftProfile((current) => ({
                  ...current,
                  location: e.target.value,
                }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Address
            <textarea
              value={draftProfile.address}
              onChange={(e) =>
                setDraftProfile((current) => ({
                  ...current,
                  address: e.target.value,
                }))
              }
              rows={2}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong resize-none"
            />
          </label>
          <button
            type="button"
            onClick={handleSaveProfile}
            className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            Save Changes
          </button>
        </div>
      </Modal>
    </div>
  );
}
