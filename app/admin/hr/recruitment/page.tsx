"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Search,
  ChevronDown,
  MoreHorizontal,
  Calendar as CalendarIcon,
  Clock,
  Star,
  Briefcase,
  TrendingUp,
  Activity as ActivityIcon,
  FilterX,
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { cn } from "@/utils/cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";

// Mock Kanban Pipeline Candidates
const initialPipeline = {
  Applied: [
    {
      id: "CAN001",
      name: "Alice Smith",
      position: "Frontend Engineer",
      date: "18 Jul",
      rating: 4,
      avatar: "AS",
    },
    {
      id: "CAN002",
      name: "Bob Johnson",
      position: "Product Manager",
      date: "19 Jul",
      rating: 3,
      avatar: "BJ",
    },
  ],
  Screening: [
    {
      id: "CAN003",
      name: "Charlie Brown",
      position: "UX Designer",
      date: "15 Jul",
      rating: 4,
      avatar: "CB",
    },
  ],
  Interview: [
    {
      id: "CAN004",
      name: "Diana Prince",
      position: "Backend Architect",
      date: "12 Jul",
      rating: 5,
      avatar: "DP",
    },
  ],
  Technical: [
    {
      id: "CAN005",
      name: "Evan Wright",
      position: "QA Lead",
      date: "10 Jul",
      rating: 4,
      avatar: "EW",
    },
  ],
  Offer: [
    {
      id: "CAN006",
      name: "Fiona Gallagher",
      position: "Frontend Engineer",
      date: "05 Jul",
      rating: 5,
      avatar: "FG",
    },
  ],
  Hired: [
    {
      id: "CAN007",
      name: "George Clark",
      position: "Data Scientist",
      date: "01 Jul",
      rating: 5,
      avatar: "GC",
    },
  ],
};

// Mock Active Job Openings
const initialJobs = [
  {
    id: "JOB001",
    title: "Frontend Engineer",
    department: "Engineering",
    applicants: 48,
    inInterview: 6,
    offers: 1,
    deadline: "15 Aug 2026",
    description:
      "Build responsive dashboard interfaces and internal HR tools using React and TypeScript.",
    status: "Active" as const,
  },
  {
    id: "JOB002",
    title: "Backend Architect",
    department: "Engineering",
    applicants: 32,
    inInterview: 4,
    offers: 0,
    deadline: "20 Aug 2026",
    description:
      "Design scalable APIs, database schemas, and payroll processing services.",
    status: "Active" as const,
  },
  {
    id: "JOB003",
    title: "Product Manager",
    department: "Product",
    applicants: 24,
    inInterview: 2,
    offers: 1,
    deadline: "10 Aug 2026",
    description:
      "Own the hiring roadmap, candidate experience, and cross-team delivery.",
    status: "Active" as const,
  },
];

// Mock Applicants List
const initialApplicants = [
  {
    id: "APP001",
    name: "Alice Smith",
    position: "Frontend Engineer",
    exp: "3 Years",
    date: "18 Jul 2026",
    stage: "Applied",
    rating: 4.0,
    avatar: "AS",
  },
  {
    id: "APP002",
    name: "Bob Johnson",
    position: "Product Manager",
    exp: "5 Years",
    date: "19 Jul 2026",
    stage: "Applied",
    rating: 3.5,
    avatar: "BJ",
  },
  {
    id: "APP003",
    name: "Charlie Brown",
    position: "UX Designer",
    exp: "4 Years",
    date: "15 Jul 2026",
    stage: "Screening",
    rating: 4.2,
    avatar: "CB",
  },
  {
    id: "APP004",
    name: "Diana Prince",
    position: "Backend Architect",
    exp: "8 Years",
    date: "12 Jul 2026",
    stage: "Interview",
    rating: 4.9,
    avatar: "DP",
  },
  {
    id: "APP005",
    name: "Evan Wright",
    position: "QA Lead",
    exp: "6 Years",
    date: "10 Jul 2026",
    stage: "Technical",
    rating: 4.0,
    avatar: "EW",
  },
  {
    id: "APP006",
    name: "Fiona Gallagher",
    position: "Frontend Engineer",
    exp: "4 Years",
    date: "05 Jul 2026",
    stage: "Offer",
    rating: 4.8,
    avatar: "FG",
  },
];

// Mock Interview Schedule
const interviewSchedule = [
  {
    candidate: "Diana Prince",
    type: "Backend System Design",
    time: "10:00 AM",
    interviewer: "Bruce Banner",
  },
  {
    candidate: "Charlie Brown",
    type: "UX Review",
    time: "02:30 PM",
    interviewer: "Sarah Mills",
  },
  {
    candidate: "Evan Wright",
    type: "QA Automation Test",
    time: "04:00 PM",
    interviewer: "John Cena",
  },
];

// Mock Donut Chart Data (Candidate Sources)
const sourceData = [
  { name: "LinkedIn", value: 58, color: "#18181B" },
  { name: "Referrals", value: 34, color: "#525252" },
  { name: "Career Portal", value: 28, color: "#737373" },
  { name: "Agency", value: 12, color: "#A3A3A3" },
  { name: "Indeed", value: 10, color: "#D4D4D8" },
];

// Mock Recent Activities
const recruitmentActivities = [
  {
    desc: "Offer letter sent to Fiona Gallagher",
    user: "Sarah Mills (HR)",
    time: "10 min ago",
  },
  {
    desc: "George Clark marked as Hired",
    user: "Bruce Banner (Eng Lead)",
    time: "1 hr ago",
  },
  {
    desc: "Diana Prince cleared Technical stage",
    user: "Bruce Banner (Eng Lead)",
    time: "4 hrs ago",
  },
];

// Custom Tooltip component for Donut Chart
const ChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-surface border border-border px-3 py-1.5 rounded-lg shadow-md text-xs font-semibold">
        <p className="text-zinc-900 font-bold">{data.name}</p>
        <p className="text-zinc-600 mt-0.5">
          Applicants:{" "}
          <span className="text-zinc-950 font-bold">{data.value}</span>
        </p>
      </div>
    );
  }
  return null;
};

type Applicant = (typeof initialApplicants)[0];
type JobOpening = (typeof initialJobs)[0];

export default function RecruitmentPage() {
  const [mounted, setMounted] = useState(false);
  const [pipeline, setPipeline] = useState(initialPipeline);
  const [jobs, setJobs] = useState(initialJobs);
  const [applicants, setApplicants] = useState(initialApplicants);
  const [search, setSearch] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("All");
  const [selectedStage, setSelectedStage] = useState("All");
  const [selectedExp, setSelectedExp] = useState("All");

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeKanbanMenuId, setActiveKanbanMenuId] = useState<string | null>(
    null,
  );
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [viewJob, setViewJob] = useState<JobOpening | null>(null);
  const [viewApplicant, setViewApplicant] = useState<Applicant | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<Applicant | null>(null);
  const [moveStageTarget, setMoveStageTarget] = useState<Applicant | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Applicant | null>(null);
  const [draftJob, setDraftJob] = useState({
    title: "",
    department: "Engineering",
    deadline: "",
    description: "",
  });
  const [draftInterview, setDraftInterview] = useState({
    date: "",
    time: "",
    type: "",
    interviewer: "Sarah Mills",
  });
  const [moveToStage, setMoveToStage] = useState("Screening");

  const dropdownRef = useRef<HTMLTableCellElement>(null);
  const kanbanMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveMenuId(null);
      }
      if (
        kanbanMenuRef.current &&
        !kanbanMenuRef.current.contains(event.target as Node)
      ) {
        setActiveKanbanMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDragStart = (
    e: React.DragEvent,
    candidateId: string,
    sourceStage: string,
  ) => {
    e.dataTransfer.setData("candidateId", candidateId);
    e.dataTransfer.setData("sourceStage", sourceStage);
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    const candidateId = e.dataTransfer.getData("candidateId");
    const sourceStage = e.dataTransfer.getData(
      "sourceStage",
    ) as keyof typeof initialPipeline;

    if (!candidateId || !sourceStage || sourceStage === targetStage) return;

    setPipeline((prev) => {
      const sourceList = [...prev[sourceStage]];
      const targetList = [
        ...(prev[targetStage as keyof typeof initialPipeline] || []),
      ];

      const candidateIndex = sourceList.findIndex((c) => c.id === candidateId);
      if (candidateIndex === -1) return prev;

      const [movedCandidate] = sourceList.splice(candidateIndex, 1);
      targetList.push(movedCandidate);

      return {
        ...prev,
        [sourceStage]: sourceList,
        [targetStage]: targetList,
      };
    });

    setApplicants((prev) =>
      prev.map((app) =>
        app.id === candidateId ? { ...app, stage: targetStage } : app,
      ),
    );
  };

  const handleAddJob = () => {
    if (!draftJob.title.trim() || !draftJob.deadline.trim()) {
      toast.error("Missing fields", {
        description: "Title and deadline are required.",
      });
      return;
    }

    const newJob: JobOpening = {
      id: `JOB${String(jobs.length + 1).padStart(3, "0")}`,
      title: draftJob.title.trim(),
      department: draftJob.department,
      applicants: 0,
      inInterview: 0,
      offers: 0,
      deadline: draftJob.deadline.trim(),
      description: draftJob.description.trim() || "No description provided.",
      status: "Active",
    };

    setJobs((prev) => [newJob, ...prev]);
    setIsAddJobOpen(false);
    setDraftJob({
      title: "",
      department: "Engineering",
      deadline: "",
      description: "",
    });
    toast.success("Job opening created", {
      description: `${newJob.title} is now live.`,
    });
  };

  const findApplicantByName = (name: string) =>
    applicants.find((app) => app.name === name);

  const handleApplicantAction = (
    action: "view" | "schedule" | "move" | "reject",
    app: Applicant,
  ) => {
    setActiveMenuId(null);
    setActiveKanbanMenuId(null);

    if (action === "view") {
      setViewApplicant(app);
      return;
    }
    if (action === "schedule") {
      setScheduleTarget(app);
      setDraftInterview({
        date: "",
        time: "",
        type: `${app.position} Interview`,
        interviewer: "Sarah Mills",
      });
      return;
    }
    if (action === "move") {
      setMoveStageTarget(app);
      setMoveToStage(app.stage === "Applied" ? "Screening" : "Interview");
      return;
    }
    setRejectTarget(app);
  };

  const handleScheduleInterview = () => {
    if (!scheduleTarget || !draftInterview.date || !draftInterview.time) {
      toast.error("Missing fields", {
        description: "Date and time are required.",
      });
      return;
    }

    setScheduleTarget(null);
    toast.success("Interview scheduled", {
      description: `${scheduleTarget.name} on ${draftInterview.date} at ${draftInterview.time}.`,
    });
  };

  const handleMoveStage = () => {
    if (!moveStageTarget) return;

    setApplicants((prev) =>
      prev.map((app) =>
        app.id === moveStageTarget.id ? { ...app, stage: moveToStage } : app,
      ),
    );

    setPipeline((prev) => {
      const next = { ...prev };
      (Object.keys(next) as Array<keyof typeof next>).forEach((stage) => {
        next[stage] = next[stage].filter(
          (c) => c.name !== moveStageTarget.name,
        );
      });
      const candidate = {
        id: moveStageTarget.id,
        name: moveStageTarget.name,
        position: moveStageTarget.position,
        date: moveStageTarget.date.split(" ")[0] ?? moveStageTarget.date,
        rating: Math.round(moveStageTarget.rating),
        avatar: moveStageTarget.avatar,
      };
      const targetKey = moveToStage as keyof typeof next;
      next[targetKey] = [...(next[targetKey] ?? []), candidate];
      return next;
    });

    setMoveStageTarget(null);
    toast.success("Stage updated", {
      description: `${moveStageTarget.name} moved to ${moveToStage}.`,
    });
  };

  const handleRejectApplicant = () => {
    if (!rejectTarget) return;

    setApplicants((prev) => prev.filter((app) => app.id !== rejectTarget.id));
    setPipeline((prev) => {
      const next = { ...prev };
      (Object.keys(next) as Array<keyof typeof next>).forEach((stage) => {
        next[stage] = next[stage].filter((c) => c.id !== rejectTarget.id);
      });
      return next;
    });
    setRejectTarget(null);
    toast.success("Applicant rejected", {
      description: `${rejectTarget.name} was removed from the pipeline.`,
    });
  };

  // Filter Logic
  const filteredApplicants = applicants.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.id.toLowerCase().includes(search.toLowerCase());

    const matchesPosition =
      selectedPosition === "All" || app.position === selectedPosition;
    const matchesStage = selectedStage === "All" || app.stage === selectedStage;
    const matchesExp = selectedExp === "All" || app.exp.includes(selectedExp);

    return matchesSearch && matchesPosition && matchesStage && matchesExp;
  });

  // Clear Filters
  const handleClearFilters = () => {
    setSearch("");
    setSelectedPosition("All");
    setSelectedStage("All");
    setSelectedExp("All");
  };

  // Stage Badge Style Helper
  const getStageBadgeClass = (stage: string) => {
    switch (stage) {
      case "Hired":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
      case "Offer":
        return "bg-sky-50 text-sky-700 border border-sky-200/50";
      case "Technical":
      case "Interview":
        return "bg-amber-50 text-amber-700 border border-amber-200/50";
      case "Screening":
        return "bg-zinc-100 text-zinc-700 border border-zinc-200";
      case "Applied":
      default:
        return "bg-zinc-50 text-zinc-500 border border-zinc-200";
    }
  };

  const positions = [
    "All",
    "Frontend Engineer",
    "Backend Architect",
    "Product Manager",
    "UX Designer",
    "QA Lead",
  ];
  const stages = [
    "All",
    "Applied",
    "Screening",
    "Interview",
    "Technical",
    "Offer",
    "Hired",
  ];
  const expLevels = [
    "All",
    "3 Years",
    "4 Years",
    "5 Years",
    "6 Years",
    "8 Years",
  ];

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h1 className="type-title">Recruitment</h1>
          <p className="type-subtitle">
            Manage job openings, candidates, and the hiring process.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddJobOpen(true)}
          className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
        >
          <Plus className="size-4" />
          New Job Opening
        </button>
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open Positions", value: "8 Positions" },
          { label: "Total Applicants", value: "142 Candidates" },
          {
            label: "Interviews This Week",
            value: "24 Interviews",
            color: "text-amber-600",
          },
          {
            label: "Hires This Month",
            value: "6 Hires",
            color: "text-emerald-600",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between"
          >
            <span className="text-sm font-medium text-zinc-500">
              {stat.label}
            </span>
            <span
              className={cn(
                "text-2xl font-bold text-zinc-950 mt-2",
                stat.color,
              )}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Recruitment Pipeline Kanban Board */}
      <div className="flex flex-col gap-4">
        <h2 className="type-heading">
          Recruitment Pipeline
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 pb-2 overflow-x-auto">
          {(Object.keys(pipeline) as Array<keyof typeof pipeline>).map(
            (stage) => {
              const candidates = pipeline[stage];
              return (
                <div
                  key={stage}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, stage)}
                  className="bg-zinc-50/50 border border-border rounded-2xl p-4 flex flex-col gap-4 flex-1 min-w-[240px] min-h-[350px]"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                      {stage}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 bg-white border border-border px-1.5 py-0.5 rounded-full">
                      {candidates.length}
                    </span>
                  </div>

                  {/* Candidate List */}
                  <div className="flex flex-col gap-3">
                    {candidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        draggable
                        onDragStart={(e) =>
                          handleDragStart(e, candidate.id, stage)
                        }
                        className="cursor-grab active:cursor-grabbing bg-surface border border-border rounded-xl p-4 shadow-3xs hover:border-zinc-300 hover:shadow-2xs transition-all flex flex-col gap-3.5 relative group"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <PersonAvatar
                              name={candidate.name}
                              size={32}
                            />
                            <div className="flex flex-col min-w-0 text-left">
                              <span className="text-sm font-semibold text-zinc-950 leading-tight truncate">
                                {candidate.name}
                              </span>
                              <span className="text-xs text-zinc-500 truncate mt-0.5">
                                {candidate.position}
                              </span>
                            </div>
                          </div>
                          <div
                            className="relative"
                            ref={
                              activeKanbanMenuId === candidate.id
                                ? kanbanMenuRef
                                : null
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setActiveKanbanMenuId(
                                  activeKanbanMenuId === candidate.id
                                    ? null
                                    : candidate.id,
                                )
                              }
                              className="cursor-pointer p-0.5 rounded hover:bg-zinc-100 border border-transparent text-zinc-400 hover:text-zinc-800 active:scale-95 transition-[transform,background-color,color] duration-150 ease-out shrink-0"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                            {activeKanbanMenuId === candidate.id && (
                              <div className="absolute right-0 top-6 w-40 bg-surface border border-border rounded-lg shadow-lg py-1.5 z-40 text-left animate-in fade-in slide-in-from-top-2 duration-150">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const app = findApplicantByName(candidate.name);
                                    if (app) handleApplicantAction("view", app);
                                  }}
                                  className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                                >
                                  View Profile
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const app = findApplicantByName(candidate.name);
                                    if (app)
                                      handleApplicantAction("schedule", app);
                                  }}
                                  className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                                >
                                  Schedule Interview
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const app = findApplicantByName(candidate.name);
                                    if (app) handleApplicantAction("move", app);
                                  }}
                                  className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                                >
                                  Move Stage
                                </button>
                                <hr className="border-border my-1" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const app = findApplicantByName(candidate.name);
                                    if (app)
                                      handleApplicantAction("reject", app);
                                  }}
                                  className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                  Reject Applicant
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-zinc-400 font-medium mt-1">
                          <span>Applied {candidate.date}</span>
                          <div className="flex items-center gap-1 text-amber-500 font-bold">
                            <Star className="size-3.5 fill-amber-500 text-amber-500" />
                            <span>{candidate.rating}.0</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </div>

      {/* Active Job Openings Grid */}
      <div className="flex flex-col gap-4">
        <h2 className="type-heading">
          Active Job Openings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="border border-border rounded-2xl p-5 bg-surface hover:border-zinc-300 hover:shadow-2xs transition-[border-color,box-shadow] duration-150 ease-out flex flex-col justify-between min-h-[220px] relative group select-none"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700 border border-zinc-200">
                  <Briefcase className="size-5" />
                </div>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded-full">
                  Active
                </span>
              </div>

              {/* Title & Stats */}
              <div className="mt-4 flex-1 text-left">
                <h3 className="text-base font-bold text-zinc-950 tracking-tight leading-tight">
                  {job.title}
                </h3>
                <p className="text-xs text-zinc-400 font-medium mt-1.5 uppercase">
                  Deadline: {job.deadline}
                </p>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center border-t border-border pt-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase">
                      Applicants
                    </span>
                    <span className="text-base font-bold text-zinc-900 mt-1">
                      {job.applicants}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase">
                      Interviews
                    </span>
                    <span className="text-base font-bold text-zinc-900 mt-1">
                      {job.inInterview}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase">
                      Offers
                    </span>
                    <span className="text-base font-bold text-zinc-900 mt-1">
                      {job.offers}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewJob(job)}
                  className="cursor-pointer px-3 py-1.5 border border-border bg-surface hover:bg-zinc-950 hover:text-white hover:border-zinc-950 text-zinc-700 text-xs font-bold rounded-lg shadow-3xs active:scale-[0.98] transition-[transform,background-color,border-color,color] duration-150 ease-out shrink-0"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar & Applicants Table */}
      <div className="flex flex-col gap-4">
        <h2 className="type-heading">Applicants List</h2>

        {/* Filters Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 size-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search applicants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong transition-colors"
            />
          </div>

          {/* Position */}
          <div className="relative">
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
            >
              <option disabled>Position</option>
              {positions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos === "All" ? "All Positions" : pos}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
          </div>

          {/* Stage */}
          <div className="relative">
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
            >
              <option disabled>Hiring Stage</option>
              {stages.map((stg) => (
                <option key={stg} value={stg}>
                  {stg === "All" ? "All Stages" : stg}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
          </div>

          {/* Experience & Clear Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <select
                value={selectedExp}
                onChange={(e) => setSelectedExp(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
              >
                <option disabled>Experience Level</option>
                {expLevels.map((exp) => (
                  <option key={exp} value={exp}>
                    {exp === "All" ? "All Experience" : exp}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
            </div>
            {(search ||
              selectedPosition !== "All" ||
              selectedStage !== "All" ||
              selectedExp !== "All") && (
              <button
                onClick={handleClearFilters}
                className="cursor-pointer h-10 px-3 border border-dashed border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all bg-zinc-50/50"
              >
                <FilterX className="size-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table Container */}
        <div className="border border-border rounded-xl bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-border text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6 font-semibold">Candidate</th>
                  <th className="py-3.5 px-6 font-semibold">Position</th>
                  <th className="py-3.5 px-6 font-semibold">Experience</th>
                  <th className="py-3.5 px-6 font-semibold">Applied Date</th>
                  <th className="py-3.5 px-6 font-semibold">Hiring Stage</th>
                  <th className="py-3.5 px-6 font-semibold w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-zinc-700 font-medium">
                {filteredApplicants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-zinc-400">
                      No applicants found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredApplicants.map((app) => (
                    <tr
                      key={app.id}
                      className="hover:bg-zinc-50/40 transition-colors"
                    >
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <PersonAvatar
                            name={app.name}
                            size={32}
                          />
                          <span className="font-semibold text-zinc-950 leading-tight">
                            {app.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-zinc-950">
                        {app.position}
                      </td>
                      <td className="py-3.5 px-6 text-zinc-500">{app.exp}</td>
                      <td className="py-3.5 px-6 text-zinc-400">{app.date}</td>
                      <td className="py-3.5 px-6">
                        <span
                          className={cn(
                            "whitespace-nowrap inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold",
                            getStageBadgeClass(app.stage),
                          )}
                        >
                          {app.stage}
                        </span>
                      </td>
                      <td
                        className="py-3.5 px-6 text-right relative"
                        ref={activeMenuId === app.id ? dropdownRef : null}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuId(
                              activeMenuId === app.id ? null : app.id,
                            )
                          }
                          className="cursor-pointer p-1.5 rounded-lg border border-transparent hover:border-zinc-200 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 active:scale-95 transition-[transform,background-color,border-color,color] duration-150 ease-out"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>

                        {activeMenuId === app.id && (
                          <div className="absolute right-6 top-10 w-40 bg-surface border border-border rounded-lg shadow-lg py-1.5 z-40 text-left animate-in fade-in slide-in-from-top-2 duration-150">
                            <button
                              type="button"
                              onClick={() => handleApplicantAction("view", app)}
                              className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                            >
                              View Profile
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleApplicantAction("schedule", app)
                              }
                              className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                            >
                              Schedule Interview
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplicantAction("move", app)}
                              className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                            >
                              Move Stage
                            </button>
                            <hr className="border-border my-1" />
                            <button
                              type="button"
                              onClick={() =>
                                handleApplicantAction("reject", app)
                              }
                              className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              Reject Applicant
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lower Widgets Section: Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Interviews Schedule */}
        <div className="border border-border rounded-xl p-6 bg-surface flex flex-col gap-4 text-left">
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2 mb-1">
            <Clock className="size-4 text-zinc-400" />
            Interview Schedule Today
          </h3>
          <div className="flex flex-col divide-y divide-border">
            {interviewSchedule.map((meet, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-1.5 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="flex items-center justify-between text-sm font-bold">
                  <span className="text-zinc-950">{meet.candidate}</span>
                  <span className="text-zinc-400 flex items-center gap-1.5 text-xs font-semibold">
                    <CalendarIcon className="size-3.5" />
                    {meet.time}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 font-semibold">
                  {meet.type} &bull; by {meet.interviewer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Candidate Source Distribution (Donut Chart) */}
        <div className="border border-border rounded-xl p-6 bg-surface flex flex-col gap-4 text-left">
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <Briefcase className="size-4 text-zinc-400" />
            Candidate Sources
          </h3>
          <div className="flex items-center gap-4 h-[195px] mt-2">
            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
              {!mounted ? (
                <div className="w-40 h-40 rounded-full bg-zinc-50 animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={<ChartTooltip />}
                      wrapperStyle={{ zIndex: 50 }}
                    />
                    <Pie
                      data={sourceData}
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      cornerRadius={4}
                      dataKey="value"
                    >
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center gap-2 max-h-[195px] overflow-y-auto pl-2">
              {sourceData.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm font-semibold"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-zinc-500 truncate max-w-[140px]">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-zinc-900 font-bold shrink-0">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hiring Funnel Summary */}
        <div className="border border-border rounded-xl p-6 bg-surface flex flex-col justify-between text-left">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="size-4 text-zinc-400" />
              Hiring Conversion
            </h3>
            <div className="flex flex-col gap-4 text-xs font-semibold text-zinc-500">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-sm text-zinc-900">
                  <span>Applied &rarr; Screening</span>
                  <span className="font-bold">78% Conversion</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-950 rounded-full"
                    style={{ width: "78%" }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-sm text-zinc-900">
                  <span>Screening &rarr; Offer</span>
                  <span className="font-bold">18% Conversion</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-700 rounded-full"
                    style={{ width: "18%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="border border-border rounded-xl p-6 bg-surface flex flex-col gap-4 text-left">
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider flex items-center gap-2 mb-1">
            <ActivityIcon className="size-4 text-zinc-400" />
            Recruitment Activity
          </h3>
          <div className="flex flex-col gap-4 overflow-y-auto max-h-[160px] scrollbar-none">
            {recruitmentActivities.map((act, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm">
                <div className="size-2 bg-zinc-300 rounded-full mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-800 leading-snug font-medium">
                    {act.desc}
                  </p>
                  <span className="text-xs text-zinc-400 font-semibold block mt-1">
                    {act.time} &bull; by {act.user}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={isAddJobOpen}
        onClose={() => setIsAddJobOpen(false)}
        title="New Job Opening"
        description="Publish a role to the careers portal"
      >
        <div className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Job title
            <input
              value={draftJob.title}
              onChange={(e) =>
                setDraftJob((current) => ({ ...current, title: e.target.value }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong"
              placeholder="Senior Frontend Engineer"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
              Department
              <select
                value={draftJob.department}
                onChange={(e) =>
                  setDraftJob((current) => ({
                    ...current,
                    department: e.target.value,
                  }))
                }
                className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong cursor-pointer"
              >
                {["Engineering", "Product", "Design", "HR", "Sales"].map(
                  (dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
              Application deadline
              <input
                type="text"
                value={draftJob.deadline}
                onChange={(e) =>
                  setDraftJob((current) => ({
                    ...current,
                    deadline: e.target.value,
                  }))
                }
                className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong"
                placeholder="15 Aug 2026"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Description
            <textarea
              value={draftJob.description}
              onChange={(e) =>
                setDraftJob((current) => ({
                  ...current,
                  description: e.target.value,
                }))
              }
              rows={3}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong resize-none"
              placeholder="What the candidate will work on..."
            />
          </label>
          <button
            type="button"
            onClick={handleAddJob}
            className="cursor-pointer mt-1 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            Publish Opening
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(viewJob)}
        onClose={() => setViewJob(null)}
        title={viewJob?.title ?? "Job Opening"}
        description={viewJob?.id}
      >
        {viewJob ? (
          <div className="flex flex-col gap-4 text-left">
            <p className="text-sm text-zinc-600 leading-relaxed">
              {viewJob.description}
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
              <div>
                <span className="text-zinc-400">Department</span>
                <p className="text-zinc-900 mt-1">{viewJob.department}</p>
              </div>
              <div>
                <span className="text-zinc-400">Deadline</span>
                <p className="text-zinc-900 mt-1">{viewJob.deadline}</p>
              </div>
              <div>
                <span className="text-zinc-400">Applicants</span>
                <p className="text-zinc-900 mt-1">{viewJob.applicants}</p>
              </div>
              <div>
                <span className="text-zinc-400">In interview</span>
                <p className="text-zinc-900 mt-1">{viewJob.inInterview}</p>
              </div>
            </div>
            <span className="inline-flex w-fit px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
              {viewJob.status}
            </span>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(viewApplicant)}
        onClose={() => setViewApplicant(null)}
        title={viewApplicant?.name ?? "Candidate"}
        description={viewApplicant?.position}
      >
        {viewApplicant ? (
          <div className="flex flex-col gap-4 text-left">
            <div className="flex items-center gap-3">
              <PersonAvatar
                name={viewApplicant.name}
                size={48}
              />
              <div>
                <p className="text-sm font-bold text-zinc-950">
                  {viewApplicant.name}
                </p>
                <p className="text-xs text-zinc-400 font-semibold">
                  {viewApplicant.id}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
              <div>
                <span className="text-zinc-400">Experience</span>
                <p className="text-zinc-900 mt-1">{viewApplicant.exp}</p>
              </div>
              <div>
                <span className="text-zinc-400">Applied</span>
                <p className="text-zinc-900 mt-1">{viewApplicant.date}</p>
              </div>
              <div>
                <span className="text-zinc-400">Stage</span>
                <p className="text-zinc-900 mt-1">{viewApplicant.stage}</p>
              </div>
              <div>
                <span className="text-zinc-400">Rating</span>
                <p className="text-zinc-900 mt-1">{viewApplicant.rating}/5</p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(scheduleTarget)}
        onClose={() => setScheduleTarget(null)}
        title="Schedule Interview"
        description={scheduleTarget?.name}
      >
        <div className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Date
            <input
              type="date"
              value={draftInterview.date}
              onChange={(e) =>
                setDraftInterview((current) => ({
                  ...current,
                  date: e.target.value,
                }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Time
            <input
              type="time"
              value={draftInterview.time}
              onChange={(e) =>
                setDraftInterview((current) => ({
                  ...current,
                  time: e.target.value,
                }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Interview type
            <input
              value={draftInterview.type}
              onChange={(e) =>
                setDraftInterview((current) => ({
                  ...current,
                  type: e.target.value,
                }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Interviewer
            <select
              value={draftInterview.interviewer}
              onChange={(e) =>
                setDraftInterview((current) => ({
                  ...current,
                  interviewer: e.target.value,
                }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong cursor-pointer"
            >
              {["Sarah Mills", "Bruce Banner", "William Joseph"].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleScheduleInterview}
            className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            Schedule Interview
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(moveStageTarget)}
        onClose={() => setMoveStageTarget(null)}
        title="Move Stage"
        description={moveStageTarget?.name}
      >
        <div className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            New stage
            <select
              value={moveToStage}
              onChange={(e) => setMoveToStage(e.target.value)}
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong cursor-pointer"
            >
              {stages.filter((s) => s !== "All").map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleMoveStage}
            className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            Update Stage
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Reject applicant"
        description={rejectTarget?.name}
      >
        <div className="flex flex-col gap-4 text-left">
          <p className="text-sm text-zinc-600 font-medium">
            This removes the candidate from the pipeline and applicants list.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRejectTarget(null)}
              className="cursor-pointer flex-1 px-3.5 py-2 rounded-lg border border-border text-sm font-semibold text-zinc-700 active:scale-[0.98] transition-transform duration-150 ease-out"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRejectApplicant}
              className="cursor-pointer flex-1 px-3.5 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200/50 text-sm font-semibold active:scale-[0.98] transition-transform duration-150 ease-out"
            >
              Reject
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
