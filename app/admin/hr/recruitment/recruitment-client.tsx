"use client";

import React, { useState, useEffect, useMemo, useRef, useTransition } from "react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { PieChartTooltip, chartTooltipWrapperStyle } from "@/components/charts/chart-tooltip";
import { ListPagination, useClientPagination } from "@/components/ui/list-pagination";
import {
  createJobOpeningAction,
  moveCandidateStageAction,
  rejectCandidateAction,
  scheduleCandidateInterviewAction,
  type RecruitmentBoard,
  type RecruitmentCandidate,
  type RecruitmentJob,
} from "@/lib/actions/recruitment";
import {
  PIPELINE_STAGES,
  type PipelineStageLabel,
} from "@/lib/recruitment/stages";
import { kolkataTodayKey } from "@/lib/shared/dates";

type Applicant = RecruitmentCandidate;
type JobOpening = RecruitmentJob;

const KANBAN_PREVIEW = 2;

export default function RecruitmentClient({
  initialBoard,
}: {
  initialBoard: RecruitmentBoard;
}) {
  const [mounted, setMounted] = useState(false);
  const [board, setBoard] = useState(initialBoard);
  const [pipeline, setPipeline] = useState(initialBoard.pipeline);
  const [jobs, setJobs] = useState(initialBoard.jobs);
  const [applicants, setApplicants] = useState(initialBoard.candidates);
  const [kanbanExpanded, setKanbanExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
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

  const applyCandidateUpdate = (updated: RecruitmentCandidate) => {
    setApplicants((prev) => {
      const next = prev.some((app) => app.id === updated.id)
        ? prev.map((app) => (app.id === updated.id ? updated : app))
        : [...prev, updated];
      return next.filter((app) => app.stage !== "Rejected");
    });
    setPipeline((prev) => {
      const next = { ...prev };
      for (const stage of PIPELINE_STAGES) {
        next[stage] = next[stage].filter((c) => c.id !== updated.id);
      }
      if (updated.stage !== "Rejected") {
        next[updated.stage] = [...next[updated.stage], updated];
      }
      return next;
    });
  };

  const handleDrop = (e: React.DragEvent, targetStage: PipelineStageLabel) => {
    const candidateId = e.dataTransfer.getData("candidateId");
    const sourceStage = e.dataTransfer.getData("sourceStage") as PipelineStageLabel;
    if (!candidateId || !sourceStage || sourceStage === targetStage) return;

    startTransition(async () => {
      const result = await moveCandidateStageAction({
        candidateId,
        stage: targetStage,
      });
      if (!result.ok) {
        toast.error("Could not move candidate", { description: result.error });
        return;
      }
      applyCandidateUpdate(result.data);
    });
  };

  const handleAddJob = () => {
    if (!draftJob.title.trim() || !draftJob.deadline.trim()) {
      toast.error("Missing fields", {
        description: "Title and deadline are required.",
      });
      return;
    }

    startTransition(async () => {
      const result = await createJobOpeningAction({
        title: draftJob.title.trim(),
        department: draftJob.department,
        deadline: draftJob.deadline.trim(),
        description: draftJob.description.trim(),
      });
      if (!result.ok) {
        toast.error("Could not create job", { description: result.error });
        return;
      }
      setJobs((prev) => [result.data, ...prev]);
      setBoard((prev) => ({
        ...prev,
        jobs: [result.data, ...prev.jobs],
        stats: {
          ...prev.stats,
          openPositions: prev.stats.openPositions + 1,
        },
      }));
      setIsAddJobOpen(false);
      setDraftJob({
        title: "",
        department: "Engineering",
        deadline: "",
        description: "",
      });
      toast.success("Job opening created", {
        description: `${result.data.title} is now live.`,
      });
    });
  };

  const findApplicantById = (id: string) => applicants.find((app) => app.id === id);

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
        date: kolkataTodayKey(),
        time: "10:00",
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

    startTransition(async () => {
      const result = await scheduleCandidateInterviewAction({
        candidateId: scheduleTarget.id,
        date: draftInterview.date,
        time: draftInterview.time,
        type: draftInterview.type,
        interviewer: draftInterview.interviewer,
      });
      if (!result.ok) {
        toast.error("Could not schedule", { description: result.error });
        return;
      }
      applyCandidateUpdate(result.data);
      setBoard((prev) => {
        const nextCandidates = prev.candidates.some((c) => c.id === result.data.id)
          ? prev.candidates.map((c) => (c.id === result.data.id ? result.data : c))
          : [...prev.candidates, result.data];
        const interviews = nextCandidates
          .filter(
            (c) =>
              c.interviewAt && c.stage !== "Rejected" && c.stage !== "Hired",
          )
          .map((c) => ({
            candidate: c.name,
            type: c.interviewType || "Interview",
            time: new Date(c.interviewAt!).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            }),
            interviewer: c.interviewer || "—",
          }));
        return { ...prev, candidates: nextCandidates, interviews };
      });
      setScheduleTarget(null);
      toast.success("Interview scheduled", {
        description: `${result.data.name} on ${draftInterview.date} at ${draftInterview.time}.`,
      });
    });
  };

  const handleMoveStage = () => {
    if (!moveStageTarget) return;
    startTransition(async () => {
      const result = await moveCandidateStageAction({
        candidateId: moveStageTarget.id,
        stage: moveToStage as PipelineStageLabel,
      });
      if (!result.ok) {
        toast.error("Could not move", { description: result.error });
        return;
      }
      applyCandidateUpdate(result.data);
      setMoveStageTarget(null);
      toast.success("Stage updated", {
        description: `${result.data.name} moved to ${result.data.stage}.`,
      });
    });
  };

  const handleRejectApplicant = () => {
    if (!rejectTarget) return;
    startTransition(async () => {
      const result = await rejectCandidateAction({ candidateId: rejectTarget.id });
      if (!result.ok) {
        toast.error("Could not reject", { description: result.error });
        return;
      }
      setApplicants((prev) => prev.filter((app) => app.id !== rejectTarget.id));
      setPipeline((prev) => {
        const next = { ...prev };
        for (const stage of PIPELINE_STAGES) {
          next[stage] = next[stage].filter((c) => c.id !== rejectTarget.id);
        }
        return next;
      });
      setRejectTarget(null);
      toast.success("Applicant rejected", {
        description: `${rejectTarget.name} was removed from the pipeline.`,
      });
    });
  };

  const showKanbanViewMore = PIPELINE_STAGES.some(
    (stage) => (pipeline[stage]?.length ?? 0) > KANBAN_PREVIEW,
  );

  // Filter Logic
  const filteredApplicants = useMemo(
    () =>
      applicants.filter((app) => {
        const matchesSearch =
          app.name.toLowerCase().includes(search.toLowerCase()) ||
          app.id.toLowerCase().includes(search.toLowerCase()) ||
          app.code.toLowerCase().includes(search.toLowerCase());

        const matchesPosition =
          selectedPosition === "All" || app.position === selectedPosition;
        const matchesStage = selectedStage === "All" || app.stage === selectedStage;
        const matchesExp = selectedExp === "All" || app.exp.includes(selectedExp);

        return matchesSearch && matchesPosition && matchesStage && matchesExp;
      }),
    [applicants, search, selectedPosition, selectedStage, selectedExp],
  );

  const {
    page: applicantPage,
    setPage: setApplicantPage,
    totalPages: applicantTotalPages,
    total: applicantTotal,
    pageItems: pagedApplicants,
  } = useClientPagination(
    filteredApplicants,
    15,
    `${search}|${selectedPosition}|${selectedStage}|${selectedExp}`,
  );

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
    ...Array.from(new Set(applicants.map((app) => app.position))).sort(),
  ];
  const stages = ["All", ...PIPELINE_STAGES];
  const expLevels = [
    "All",
    ...Array.from(new Set(applicants.map((app) => app.exp))).sort(),
  ];

  const interviewSchedule = board.interviews;
  const sourceData = board.sourceData;
  const recruitmentActivities = board.activities;

  const reachedScreening = applicants.filter((app) =>
    ["Screening", "Interview", "Technical", "Offer", "Hired"].includes(app.stage),
  ).length;
  const reachedOffer = applicants.filter((app) =>
    ["Offer", "Hired"].includes(app.stage),
  ).length;
  const appliedToScreeningPct =
    applicants.length === 0
      ? 0
      : Math.round((reachedScreening / applicants.length) * 100);
  const screeningToOfferPct =
    reachedScreening === 0
      ? 0
      : Math.round((reachedOffer / reachedScreening) * 100);

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
          className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out disabled:opacity-60"
          disabled={pending}
        >
          <Plus className="size-4" />
          New Job Opening
        </button>
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Open Positions",
            value: `${board.stats.openPositions} Positions`,
          },
          {
            label: "Total Applicants",
            value: `${board.stats.totalApplicants} Candidates`,
          },
          {
            label: "Interview Rate",
            value: board.stats.interviewRate,
            color: "text-amber-600",
          },
          {
            label: "Offer Acceptance",
            value: board.stats.offerAcceptance,
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="type-heading">Recruitment Pipeline</h2>
          {showKanbanViewMore ? (
            <button
              type="button"
              onClick={() => setKanbanExpanded((prev) => !prev)}
              className="cursor-pointer text-xs font-semibold text-zinc-600 hover:text-zinc-950 px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover"
            >
              {kanbanExpanded ? "Show less" : "View more"}
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 pb-2 overflow-x-auto">
          {PIPELINE_STAGES.map((stage) => {
              const candidates = pipeline[stage] ?? [];
              const visible = kanbanExpanded
                ? candidates
                : candidates.slice(0, KANBAN_PREVIEW);
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
                    {visible.map((candidate) => (
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
                                    const app = findApplicantById(candidate.id);
                                    if (app) handleApplicantAction("view", app);
                                  }}
                                  className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                                >
                                  View Profile
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const app = findApplicantById(candidate.id);
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
                                    const app = findApplicantById(candidate.id);
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
                                    const app = findApplicantById(candidate.id);
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
                            <span>{candidate.rating}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!kanbanExpanded && candidates.length > KANBAN_PREVIEW ? (
                      <p className="text-[11px] font-semibold text-zinc-400 text-center">
                        +{candidates.length - KANBAN_PREVIEW} more
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
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
                  pagedApplicants.map((app) => (
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
          <ListPagination
            className="px-4 py-3 border-t border-border"
            page={applicantPage}
            totalPages={applicantTotalPages}
            total={applicantTotal}
            pageItemCount={pagedApplicants.length}
            onPageChange={setApplicantPage}
          />
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
                      content={<PieChartTooltip valueLabel="Applicants" />}
                      wrapperStyle={chartTooltipWrapperStyle}
                    />
                    <Pie
                      data={sourceData}
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      cornerRadius={4}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                      className="outline-none cursor-pointer"
                    >
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} className="outline-none" />
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
                  className="flex items-center justify-between text-sm font-semibold rounded-lg px-1.5 py-1 -mx-1.5 transition-colors hover:bg-zinc-50"
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
                  <span className="font-bold">{appliedToScreeningPct}% Conversion</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden group">
                  <div
                    className="h-full bg-zinc-950 rounded-full transition-all group-hover:bg-zinc-800"
                    style={{ width: `${appliedToScreeningPct}%` }}
                    title={`${appliedToScreeningPct}% Applied → Screening`}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-sm text-zinc-900">
                  <span>Screening &rarr; Offer</span>
                  <span className="font-bold">{screeningToOfferPct}% Conversion</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden group">
                  <div
                    className="h-full bg-zinc-700 rounded-full transition-all group-hover:bg-zinc-600"
                    style={{ width: `${screeningToOfferPct}%` }}
                    title={`${screeningToOfferPct}% Screening → Offer`}
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
              <DatePicker
                value={draftJob.deadline}
                onChange={(deadline) =>
                  setDraftJob((current) => ({ ...current, deadline }))
                }
                placeholder="Pick a deadline"
                min={kolkataTodayKey()}
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
            <DatePicker
              value={draftInterview.date}
              onChange={(date) =>
                setDraftInterview((current) => ({ ...current, date }))
              }
              placeholder="Pick interview date"
              min={kolkataTodayKey()}
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
