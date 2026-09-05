"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Clock, 
  Calendar as CalendarIcon, 
  CheckSquare, 
  Megaphone, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Trash2, 
  HelpCircle,
  TrendingUp
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from "recharts";
import { cn } from "@/utils/cn";
import CustomCalendarIcon from "@/components/icons/calendar";
import ShiftClockIcon from "@/components/icons/late";

// Mock Weekly Hours Chart
const weeklyHoursData = [
  { day: "Mon", hours: 8.0 },
  { day: "Tue", hours: 8.5 },
  { day: "Wed", hours: 8.1 },
  { day: "Thu", hours: 8.2 },
  { day: "Fri", hours: 7.8 },
];

const initialTasks = [
  { id: "task-1", text: "Submit self-evaluation review", completed: false },
  { id: "task-2", text: "Choose medical insurance options", completed: true },
  { id: "task-3", text: "Review candidate Alice Smith portfolio", completed: false },
];

export default function EmployeeDashboard() {
  const [mounted, setMounted] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(true);
  const [workedHours, setWorkedHours] = useState("08:12");
  
  // Tasks list
  const [tasks, setTasks] = useState(initialTasks);
  const [newTaskText, setNewTaskText] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggleClock = () => {
    setIsClockedIn(prev => !prev);
  };

  const handleToggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask = {
      id: `task-${Date.now()}`,
      text: newTaskText.trim(),
      completed: false
    };
    setTasks(prev => [...prev, newTask]);
    setNewTaskText("");
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col text-left">
          <h1 className="text-h1 font-medium">Welcome Back, William</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Here is your workspace summary for today, 19th July 2026.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="cursor-pointer px-4 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98 transition-all">
            Submit Timesheet
          </button>
          <button 
            onClick={handleToggleClock}
            className={cn(
              "cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-2xs active:scale-98 transition-all",
              isClockedIn 
                ? "bg-red-50 text-red-700 border border-red-200/50 hover:bg-red-100/50" 
                : "bg-zinc-900 hover:bg-zinc-800 text-white"
            )}
          >
            {isClockedIn ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}
            {isClockedIn ? "Clock Out" : "Clock In"}
          </button>
        </div>
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Work Status", value: isClockedIn ? "Clocked In" : "Clocked Out", color: isClockedIn ? "text-emerald-600" : "text-red-500" },
          { label: "Remaining Leave Balance", value: "12 Days" },
          { label: "Pending Tasks", value: `${tasks.filter(t => !t.completed).length} Tasks`, color: "text-amber-500" },
          { label: "Upcoming Event", value: "Q3 Town Hall" },
        ].map((stat, idx) => (
          <div key={idx} className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between select-none">
            <span className="text-sm font-medium text-zinc-500">{stat.label}</span>
            <span className={cn("text-2xl font-bold text-zinc-950 mt-2", stat.color)}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Main Grid: Left Column, Right Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Active Shift Clock */}
          <div className="border border-border rounded-2xl p-5 bg-surface flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-left">
              <ShiftClockIcon className="size-13 text-zinc-600 shrink-0 mr-2" />
              {/* <div className="size-12 rounded-xl bg-zinc-100 flex items-center justify-center border border-zinc-200 shrink-0">
                <ShiftClockIcon className="size-6 text-zinc-700" />
              </div> */}
              <div className="flex flex-col">
                <span className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Shift Clock</span>
                <span className="text-xl font-bold text-zinc-950 mt-1">
                  {isClockedIn ? `Clocked In at 08:52 AM` : "Not Clocked In"}
                </span>
                <p className="text-xs text-zinc-400 font-semibold mt-0.5">Hours Worked Today: {workedHours} hrs</p>
              </div>
            </div>
            <button 
              onClick={handleToggleClock}
              className={cn(
                "cursor-pointer px-6 py-2.5 rounded-xl text-sm font-bold shadow-3xs active:scale-98 transition-all border shrink-0",
                isClockedIn 
                  ? "bg-surface border-border text-zinc-600 hover:bg-zinc-50" 
                  : "bg-zinc-900 border-zinc-900 text-white hover:bg-zinc-800"
              )}
            >
              {isClockedIn ? "Clock Out of Shift" : "Clock Into Shift"}
            </button>
          </div>

          {/* Weekly Work Hours Chart */}
          <div className="border border-border rounded-2xl p-5 bg-surface flex flex-col">
            <h2 className="text-base font-bold text-zinc-950 mb-4 text-left">Weekly Work Hours</h2>
            <div className="h-[200px] w-full flex items-center justify-center">
              {!mounted ? (
                <div className="h-[200px] w-full bg-zinc-50 rounded-xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyHoursData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E4E4E7" />
                        <stop offset="100%" stopColor="#18181B" />
                      </linearGradient>
                      <linearGradient id="hoursBarStrokeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#18181B" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#18181B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F4F4F5" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#A1A1AA", fontSize: 11, fontWeight: 600 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#A1A1AA", fontSize: 11, fontWeight: 600 }} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                    <Tooltip wrapperStyle={{ zIndex: 50 }} />
                    <Bar 
                      dataKey="hours" 
                      fill="url(#hoursGrad)" 
                      stroke="url(#hoursBarStrokeGrad)"
                      strokeWidth={1}
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={40} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* My Tasks List */}
          <div className="border border-border rounded-2xl p-5 bg-surface flex flex-col gap-4 text-left">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <CheckSquare className="size-4 text-zinc-400" />
              My Tasks Checklist
            </h2>

            {/* Task Add Form */}
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input
                type="text"
                placeholder="Add a new task..."
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                className="flex-1 h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong font-semibold"
              />
              <button 
                type="submit"
                className="cursor-pointer h-10 px-3.5 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 flex items-center justify-center shrink-0 active:scale-98 transition-all"
              >
                <Plus className="size-4" />
              </button>
            </form>

            {/* Tasks Feed */}
            <div className="flex flex-col divide-y divide-border">
              {tasks.length === 0 ? (
                <div className="py-6 text-center text-xs font-medium text-zinc-400">
                  No tasks pending. Add one above!
                </div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <label className="flex items-center gap-3 cursor-pointer select-none min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleTask(task.id)}
                        className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer"
                      />
                      <span className={cn(
                        "text-sm font-semibold text-zinc-700 truncate",
                        task.completed && "line-through text-zinc-400"
                      )}>
                        {task.text}
                      </span>
                    </label>
                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="cursor-pointer p-1.5 hover:bg-red-50 text-zinc-400 hover:text-red-700 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Quick Actions Links */}
          <div className="border border-border rounded-2xl p-5 bg-surface flex flex-col gap-4 text-left">
            <h3 className="text-sm font-bold text-zinc-950">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <Link 
                href="/employee/leave"
                className="flex flex-col items-center justify-center p-4 border border-border rounded-xl bg-surface hover:border-zinc-300 text-zinc-700 hover:text-zinc-950 transition-all text-center gap-2 cursor-pointer shadow-3xs"
              >
                <CustomCalendarIcon className="size-6 text-zinc-500" />
                Request Leave
              </Link>
              <Link 
                href="/employee/attendance"
                className="flex flex-col items-center justify-center p-4 border border-border rounded-xl bg-surface hover:border-zinc-300 text-zinc-700 hover:text-zinc-950 transition-all text-center gap-2 cursor-pointer shadow-3xs"
              >
                <ShiftClockIcon className="size-6 text-zinc-500" />
                Shift Adjustment
              </Link>
            </div>
          </div>

          {/* Announcements */}
          <div className="border border-border rounded-2xl p-5 bg-surface flex flex-col gap-4 text-left">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <Megaphone className="size-4 text-zinc-400" />
              Company Announcements
            </h3>
            <div className="flex flex-col gap-3">
              {[
                { title: "Q3 Town Hall Schedule", desc: "Town hall is scheduled for Thursday, 3:00 PM. Teams links will be sent.", date: "23 Jul 2026" },
                { title: "Insurance Benefits Open", desc: "Please enroll or change medical selections before the August deadline.", date: "15 Jul 2026" },
              ].map((ann, idx) => (
                <div key={idx} className="border border-border rounded-xl p-3.5 bg-zinc-50/20 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-zinc-900 truncate leading-tight">{ann.title}</span>
                    <span className="text-[9px] text-zinc-400 font-semibold shrink-0">{ann.date}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-normal font-semibold">
                    {ann.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Holidays */}
          <div className="border border-border rounded-2xl p-5 bg-surface flex flex-col gap-4 text-left">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <CalendarIcon className="size-4 text-zinc-400" />
              Upcoming Holidays
            </h3>
            <div className="flex flex-col gap-3 text-xs font-semibold text-zinc-500">
              {[
                { label: "Independence Day", date: "Saturday, 15 Aug 2026" },
                { label: "Labor Day Holiday", date: "Monday, 07 Sep 2026" },
              ].map((holiday, idx) => (
                <div key={idx} className="flex justify-between items-center py-1">
                  <span className="text-zinc-800 font-bold">{holiday.label}</span>
                  <span className="text-zinc-450">{holiday.date}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
