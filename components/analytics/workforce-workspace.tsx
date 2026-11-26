"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteRoleSkillRequirement,
  generateEmployee360Summary,
  generateEmployeeSkillRecommendations,
  getEmployee360,
  runWorkforceReport,
  saveMySkills,
  saveRoleSkillRequirement,
} from "@/lib/actions/workforce-insights";
import type {
  Workforce360Data,
  WorkforceDashboard,
  WorkforceReport,
} from "@/lib/analytics/workforce-types";

type Tab = "skills" | "reports" | "employee360";
type SkillDraft = { name: string; proficiency: number };

function Card({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`rounded-2xl border border-border bg-surface p-5 ${className}`}>{children}</section>;
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
      {detail ? <p className="mt-1 text-xs text-text-tertiary">{detail}</p> : null}
    </div>
  );
}

export function WorkforceWorkspace({ data }: { data: WorkforceDashboard }) {
  const router = useRouter();
  const initialEmployeeId =
    data.employees.find((employee) => employee.id === data.ownProfileId)?.id ?? data.employees[0]?.id ?? "";
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId);
  const [tab, setTab] = useState<Tab>("skills");
  const [skillDraftsByEmployee, setSkillDraftsByEmployee] = useState<Record<string, SkillDraft[]>>({});
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState(1);
  const [savingSkills, setSavingSkills] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState("");
  const [newRequirementSkill, setNewRequirementSkill] = useState("");
  const [newRequirementLevel, setNewRequirementLevel] = useState(3);
  const [savingRequirement, setSavingRequirement] = useState(false);
  const [data360ByEmployee, setData360ByEmployee] = useState<Record<string, Workforce360Data>>({});
  const [loaded360Ids, setLoaded360Ids] = useState<string[]>([]);
  const [observations, setObservations] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<
    { skillName: string; action: string; reason: string }[]
  >([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [report, setReport] = useState<WorkforceReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const selectedEmployee = useMemo(
    () => data.employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [data.employees, selectedEmployeeId],
  );
  const skillDrafts =
    (selectedEmployee && skillDraftsByEmployee[selectedEmployee.id]) ??
    selectedEmployee?.skills.map((skill) => ({ ...skill })) ??
    [];
  const data360 = data360ByEmployee[selectedEmployeeId] ?? null;
  const loading360 = Boolean(selectedEmployeeId && !loaded360Ids.includes(selectedEmployeeId));
  const isOwnProfile = selectedEmployee?.id === data.ownProfileId;
  const canManageRequirements = data.access === "hr";
  const canRunReports = data.access === "hr" || data.access === "manager";
  const reportMaxValue = Math.max(1, ...(report?.rows.map((row) => row.chartValue) ?? []));

  useEffect(() => {
    if (!selectedEmployeeId || loaded360Ids.includes(selectedEmployeeId)) return;
    let active = true;
    getEmployee360(selectedEmployeeId)
      .then((result) => {
        if (!active) return;
        setLoaded360Ids((current) => [...current, selectedEmployeeId]);
        if (result.ok) {
          setData360ByEmployee((current) => ({ ...current, [selectedEmployeeId]: result.data }));
        }
        else toast.error(result.error);
      })
      .catch(() => {
        if (!active) return;
        setLoaded360Ids((current) => [...current, selectedEmployeeId]);
        toast.error("Could not load Employee 360 metrics.");
      });
    return () => {
      active = false;
    };
  }, [loaded360Ids, selectedEmployeeId]);

  function updateSkillDrafts(update: SkillDraft[] | ((current: SkillDraft[]) => SkillDraft[])) {
    if (!selectedEmployee) return;
    setSkillDraftsByEmployee((current) => {
      const currentSkills =
        current[selectedEmployee.id] ?? selectedEmployee.skills.map((skill) => ({ ...skill }));
      return {
        ...current,
        [selectedEmployee.id]:
          typeof update === "function" ? update(currentSkills) : update,
      };
    });
  }

  async function onSaveSkills() {
    setSavingSkills(true);
    const result = await saveMySkills(skillDrafts);
    setSavingSkills(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSkillDraftsByEmployee((current) => {
      const next = { ...current };
      if (selectedEmployee) delete next[selectedEmployee.id];
      return next;
    });
    toast.success("Your skills were saved.");
    router.refresh();
  }

  async function onSaveRequirement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingRequirement(true);
    const result = await saveRoleSkillRequirement({
      jobTitle: newRoleTitle,
      skillName: newRequirementSkill,
      targetLevel: newRequirementLevel,
    });
    setSavingRequirement(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setNewRequirementSkill("");
    toast.success("Role skill requirement saved.");
    router.refresh();
  }

  async function onDeleteRequirement(id: string) {
    const result = await deleteRoleSkillRequirement(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Role skill requirement removed.");
    router.refresh();
  }

  async function onGenerateRecommendations() {
    if (!selectedEmployee) return;
    setAiLoading(true);
    const result = await generateEmployeeSkillRecommendations(selectedEmployee.id);
    setAiLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setRecommendations(result.data.recommendations);
    if (result.data.recommendations.length === 0) toast("No skill gaps found for this role.");
  }

  async function onGenerateObservations() {
    if (!selectedEmployee) return;
    setAiLoading(true);
    const result = await generateEmployee360Summary(selectedEmployee.id);
    setAiLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setObservations(result.data.observations);
  }

  async function onRunReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReportLoading(true);
    setReport(null);
    const result = await runWorkforceReport(question);
    setReportLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setReport(result.data);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "skills", label: "Skill gap analysis" },
    ...(canRunReports ? [{ id: "reports" as const, label: "HR reports" }] : []),
    { id: "employee360", label: "Employee 360" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Workforce intelligence</p>
          <h1 className="mt-1 text-3xl font-semibold text-text-primary">
            {data.access === "employee" ? "My career & insights" : "AI workforce analytics"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Explore skill development and workforce trends. Insights are advisory and show the structured data behind them.
            Review comments and manager notes are never sent to the AI.
          </p>
        </div>
        {data.access !== "employee" ? (
          <label className="flex min-w-64 flex-col gap-1 text-sm text-text-secondary">
            Employee view
            <select
              value={selectedEmployeeId}
              onChange={(event) => {
                setSelectedEmployeeId(event.target.value);
                setObservations([]);
                setRecommendations([]);
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
            >
              {data.employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} · {employee.department}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-border" aria-label="Workforce analytics">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`border-b-2 px-4 py-3 text-sm font-medium ${
              tab === item.id
                ? "border-text-primary text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "skills" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="flex flex-col gap-6">
            {(data.access === "hr" || data.access === "manager") && (
              <Card>
                <SectionTitle
                  title="Skill gaps by employee"
                  description="Gaps compare employee-reported proficiency with the configured requirement for their job title. Level 1 is foundational; level 5 is advanced."
                />
                {data.employees.length === 0 ? (
                  <p className="text-sm text-text-secondary">No employee profiles are available in your access scope.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-text-secondary">
                          <th className="pb-3 pr-4 font-medium">Employee</th>
                          <th className="pb-3 pr-4 font-medium">Department</th>
                          <th className="pb-3 pr-4 font-medium">Role</th>
                          <th className="pb-3 pr-4 font-medium">Gaps</th>
                          <th className="pb-3 font-medium">Skills to develop</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.employees.map((employee) => (
                          <tr key={employee.id} className="border-b border-border/70 align-top">
                            <td className="py-3 pr-4 font-medium text-text-primary">{employee.name}</td>
                            <td className="py-3 pr-4 text-text-secondary">{employee.department}</td>
                            <td className="py-3 pr-4 text-text-secondary">{employee.jobTitle}</td>
                            <td className="py-3 pr-4">{employee.gaps.length}</td>
                            <td className="py-3 text-text-secondary">
                              {employee.gaps.length
                                ? employee.gaps.map((gap) => `${gap.skillName} (${gap.currentLevel}/${gap.targetLevel})`).join(", ")
                                : "No configured gaps"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {data.access === "hr" ? (
              <Card>
                <SectionTitle title="Skill gaps by department" description="Only configured role skills are included." />
                {data.departments.length === 0 ? (
                  <p className="text-sm text-text-secondary">No employee data is available yet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {data.departments.map((department) => (
                      <Metric
                        key={department.name}
                        label={department.name}
                        value={`${department.gapCount} gaps`}
                        detail={`${department.employeesWithGaps} of ${department.employees} employees with gaps`}
                      />
                    ))}
                  </div>
                )}
              </Card>
            ) : null}

            <Card>
              <SectionTitle
                title={isOwnProfile ? "My skills" : "Employee skills"}
                description={isOwnProfile ? "Self-reported skills; update your proficiency whenever it changes." : "Self-reported profile; employees manage their own skill entries."}
              />
              {selectedEmployee ? (
                <>
                  {skillDrafts.length === 0 ? (
                    <p className="mb-4 text-sm text-text-secondary">No skills added yet.</p>
                  ) : (
                    <div className="mb-4 flex flex-col gap-2">
                      {skillDrafts.map((skill, index) => (
                        <div key={`${skill.name}-${index}`} className="flex items-center gap-3 rounded-lg border border-border p-3">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{skill.name}</span>
                          {isOwnProfile ? (
                            <>
                              <select
                                aria-label={`${skill.name} proficiency`}
                                value={skill.proficiency}
                                onChange={(event) =>
                                  updateSkillDrafts((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, proficiency: Number(event.target.value) } : item,
                                    ),
                                  )
                                }
                                className="rounded-md border border-border bg-background px-2 py-1 text-sm text-text-primary"
                              >
                                {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Level {level}</option>)}
                              </select>
                              <button
                                type="button"
                                onClick={() => updateSkillDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                className="text-sm font-medium text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            </>
                          ) : (
                            <span className="text-sm text-text-secondary">Level {skill.proficiency}/5</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {isOwnProfile ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm text-text-secondary">
                        Skill
                        <input
                          value={newSkillName}
                          onChange={(event) => setNewSkillName(event.target.value)}
                          maxLength={80}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                          placeholder="e.g. TypeScript"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm text-text-secondary">
                        Proficiency
                        <select
                          value={newSkillLevel}
                          onChange={(event) => setNewSkillLevel(Number(event.target.value))}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                        >
                          {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Level {level}</option>)}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const name = newSkillName.trim();
                          if (!name) return;
                          if (skillDrafts.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) {
                            toast.error("That skill is already listed.");
                            return;
                          }
                          updateSkillDrafts((current) => [...current, { name, proficiency: newSkillLevel }]);
                          setNewSkillName("");
                        }}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:bg-background"
                      >
                        Add skill
                      </button>
                      <button
                        type="button"
                        disabled={savingSkills}
                        onClick={onSaveSkills}
                        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {savingSkills ? "Saving…" : "Save skills"}
                      </button>
                    </div>
                  ) : null}
                  {selectedEmployee.gaps.length > 0 ? (
                    <div className="mt-5 rounded-xl bg-amber-50 p-4 dark:bg-amber-950/30">
                      <p className="font-semibold text-text-primary">Development opportunities</p>
                      <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                        {selectedEmployee.gaps.map((gap) => (
                          <li key={gap.skillName}>
                            {gap.skillName}: level {gap.currentLevel} of {gap.targetLevel} target
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        disabled={aiLoading}
                        onClick={onGenerateRecommendations}
                        className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary disabled:opacity-50"
                      >
                        {aiLoading ? "Generating…" : "Suggest learning actions"}
                      </button>
                    </div>
                  ) : null}
                  {recommendations.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {recommendations.map((recommendation, index) => (
                        <div key={`${recommendation.skillName}-${index}`} className="rounded-lg border border-border p-3">
                          <p className="font-semibold text-text-primary">{recommendation.skillName}</p>
                          <p className="mt-1 text-sm text-text-secondary">{recommendation.action}</p>
                          <p className="mt-1 text-xs text-text-tertiary">{recommendation.reason}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-text-secondary">Select an employee to review their skill profile.</p>
              )}
            </Card>
          </div>

          {canManageRequirements ? (
            <Card className="h-fit">
              <SectionTitle
                title="Role skill requirements"
                description="Configure the skills and expected proficiency level used by the gap analysis."
              />
              <form onSubmit={onSaveRequirement} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm text-text-secondary">
                  Job title
                  <input
                    value={newRoleTitle}
                    onChange={(event) => setNewRoleTitle(event.target.value)}
                    required
                    maxLength={100}
                    list="workforce-role-titles"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                    placeholder="e.g. Software Engineer"
                  />
                  <datalist id="workforce-role-titles">
                    {[...new Set(data.employees.map((employee) => employee.jobTitle))].map((jobTitle) => (
                      <option key={jobTitle} value={jobTitle} />
                    ))}
                  </datalist>
                </label>
                <label className="flex flex-col gap-1 text-sm text-text-secondary">
                  Required skill
                  <input
                    value={newRequirementSkill}
                    onChange={(event) => setNewRequirementSkill(event.target.value)}
                    required
                    maxLength={80}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                    placeholder="e.g. React"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-text-secondary">
                  Target proficiency
                  <select
                    value={newRequirementLevel}
                    onChange={(event) => setNewRequirementLevel(Number(event.target.value))}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                  >
                    {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Level {level}</option>)}
                  </select>
                </label>
                <button
                  disabled={savingRequirement}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingRequirement ? "Saving…" : "Save requirement"}
                </button>
              </form>
              <div className="mt-5 space-y-2">
                {data.roleRequirements.map((requirement) => (
                  <div key={requirement.id} className="flex items-center gap-2 rounded-lg border border-border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{requirement.skillName}</p>
                      <p className="truncate text-xs text-text-secondary">{requirement.jobTitle} · target {requirement.targetLevel}/5</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteRequirement(requirement.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {data.roleRequirements.length === 0 ? (
                  <p className="py-3 text-sm text-text-secondary">No role requirements configured yet.</p>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "reports" && canRunReports ? (
        <div className="flex flex-col gap-5">
          <Card>
            <SectionTitle
              title="Ask for an HR report"
              description="Questions are mapped to fixed attendance, leave, performance, or skill-gap reports. No free-form SQL is generated or executed."
            />
            <form onSubmit={onRunReport} className="flex flex-col gap-3 sm:flex-row">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                required
                minLength={4}
                maxLength={1000}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                placeholder="e.g. Show department-wise employee attendance this month"
              />
              <button
                disabled={reportLoading}
                className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {reportLoading ? "Building report…" : "Generate report"}
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-secondary">
              {[
                "Department attendance this month",
                "Summarize approved leave for the last quarter",
                "Compare performance across departments",
                "Show department skill gaps",
                "Which department has the highest turnover?",
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setQuestion(example)}
                  className="rounded-full border border-border px-3 py-1.5 hover:bg-background"
                >
                  {example}
                </button>
              ))}
            </div>
          </Card>
          {report ? (
            <Card id="workforce-report-print" className="print-report">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">{report.title}</h2>
                  <p className="mt-1 text-sm text-text-secondary">{report.periodLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="print:hidden rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:bg-background"
                >
                  Print / Save as PDF
                </button>
              </div>
              <p className="my-4 rounded-lg bg-background p-3 text-sm text-text-primary">{report.summary}</p>
              {report.limitation ? <p className="mb-4 text-sm text-amber-700">{report.limitation}</p> : null}
              {report.rows.length ? (
                <>
                  <div className="mb-5 space-y-3">
                    {report.rows.map((row) => {
                      const width = Math.max(2, Math.round((row.chartValue / reportMaxValue) * 100));
                      return (
                        <div key={`chart-${row.label}`} className="grid grid-cols-[minmax(90px,0.6fr)_minmax(0,2fr)_auto] items-center gap-3 text-xs">
                          <span className="truncate text-text-secondary">{row.label}</span>
                          <span className="h-2 overflow-hidden rounded-full bg-background">
                            <span className="block h-full rounded-full bg-zinc-700" style={{ width: `${width}%` }} />
                          </span>
                          <span className="font-medium text-text-primary">{row.value}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-text-secondary">
                        <th className="py-3 pr-4 font-medium">Department</th>
                        <th className="py-3 pr-4 font-medium">Result</th>
                        <th className="py-3 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row) => (
                        <tr key={row.label} className="border-b border-border/70">
                          <td className="py-3 pr-4 font-medium text-text-primary">{row.label}</td>
                          <td className="py-3 pr-4 text-text-primary">{row.value}</td>
                          <td className="py-3 text-text-secondary">{row.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </>
              ) : null}
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "employee360" ? (
        <div className="flex flex-col gap-5">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <SectionTitle
                  title="Employee 360"
                  description="Descriptive metrics for the last 90 days, with attendance compared to the preceding 90 days."
                />
                <p className="text-xs text-text-tertiary">Performance goals use progress values only; review text and manager comments are excluded.</p>
              </div>
            </div>
            {loading360 ? <p className="mt-4 text-sm text-text-secondary">Loading metrics…</p> : null}
            {data360 ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label="Attendance, last 90 days"
                    value={data360.attendance.attendancePct == null ? "—" : `${data360.attendance.attendancePct}%`}
                    detail={`${data360.attendance.recordedDays} recorded days`}
                  />
                  <Metric label="Absences" value={String(data360.attendance.absentDays)} detail="Recorded absent days" />
                  <Metric
                    label="Approved leave"
                    value={`${data360.leave.approvedDays} days`}
                    detail={`${data360.leave.previousApprovedDays} days in the prior 90-day period; full requests only`}
                  />
                  <Metric
                    label="Tenure"
                    value={data360.tenureMonths == null ? "—" : `${data360.tenureMonths} months`}
                    detail={data360.department}
                  />
                  <Metric
                    label="Latest review rating"
                    value={data360.performance.latestRating == null ? "—" : `${data360.performance.latestRating}/5`}
                    detail={`Previous review: ${data360.performance.previousRating == null ? "—" : `${data360.performance.previousRating}/5`}`}
                  />
                  <Metric
                    label="Goal completion"
                    value={data360.performance.goalCompletionPct == null ? "—" : `${data360.performance.goalCompletionPct}%`}
                    detail={`Previous cycle: ${data360.performance.previousGoalCompletionPct == null ? "—" : `${data360.performance.previousGoalCompletionPct}%`} · ${data360.performance.completedGoals} of ${data360.performance.totalGoals} goals`}
                  />
                  <Metric
                    label="Previous 90-day attendance"
                    value={data360.attendance.previousAttendancePct == null ? "—" : `${data360.attendance.previousAttendancePct}%`}
                    detail="Same attended / eligible-day calculation"
                  />
                  {data360.departmentComparison ? (
                    <Metric
                      label="Team attendance comparison"
                      value={data360.departmentComparison.attendancePct == null ? "—" : `${data360.departmentComparison.attendancePct}%`}
                      detail={`${data360.departmentComparison.sampleSize} accessible peers; aggregate only`}
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={onGenerateObservations}
                  className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:bg-background disabled:opacity-50"
                >
                  {aiLoading ? "Generating…" : "Generate AI observations"}
                </button>
                {observations.length ? (
                  <div className="mt-4 rounded-xl bg-background p-4">
                    <h3 className="font-semibold text-text-primary">AI observations</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                      {observations.map((observation, index) => <li key={`${index}-${observation}`}>{observation}</li>)}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
