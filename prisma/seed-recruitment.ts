/**
 * Deterministic recruitment board seed — jobs + candidates aligned to org departments.
 */
import type { CandidateStage, JobOpeningStatus, PrismaClient } from "../generated/prisma/client";
import { dateFromKey } from "../lib/shared/dates";

type JobSeed = {
  code: string;
  title: string;
  department: string;
  description: string;
  deadline: string;
  status: JobOpeningStatus;
};

type CandidateSeed = {
  code: string;
  name: string;
  email: string;
  position: string;
  experienceYears: number;
  stage: CandidateStage;
  rating: number;
  source: string;
  appliedAt: string;
  interviewType?: string;
  interviewer?: string;
  /** ISO datetime for interviewAt */
  interviewAt?: string;
};

const JOBS: JobSeed[] = [
  {
    code: "JOB001",
    title: "Frontend Engineer",
    department: "Engineering",
    description:
      "Ship responsive admin and employee surfaces in React/TypeScript with our zinc design system.",
    deadline: "2026-10-15",
    status: "active",
  },
  {
    code: "JOB002",
    title: "Backend Engineer",
    department: "Engineering",
    description: "Own Prisma models, payroll compute, and Next.js server actions at scale.",
    deadline: "2026-10-20",
    status: "active",
  },
  {
    code: "JOB003",
    title: "Product Manager",
    department: "Product",
    description: "Drive people-ops roadmap, hiring funnel metrics, and cross-team delivery.",
    deadline: "2026-09-30",
    status: "active",
  },
  {
    code: "JOB004",
    title: "UX Designer",
    department: "Design",
    description: "Design dense HR workflows with clear hierarchy and accessible patterns.",
    deadline: "2026-10-05",
    status: "active",
  },
  {
    code: "JOB005",
    title: "Talent Partner",
    department: "Human Resources",
    description: "Full-cycle recruiting for engineering and GTM roles across India hubs.",
    deadline: "2026-09-25",
    status: "active",
  },
  {
    code: "JOB006",
    title: "Account Executive",
    department: "Sales",
    description: "Own mid-market pipeline for Odoo HRMS and hit quarterly bookings targets.",
    deadline: "2026-11-01",
    status: "active",
  },
  {
    code: "JOB007",
    title: "Financial Analyst",
    department: "Finance",
    description: "Partner with payroll on cost centers, forecasts, and month-end close.",
    deadline: "2026-10-12",
    status: "active",
  },
  {
    code: "JOB008",
    title: "Customer Success Manager",
    department: "Customer Success",
    description: "Onboard enterprise HR admins and drive product adoption / renewals.",
    deadline: "2026-09-18",
    status: "active",
  },
  {
    code: "JOB009",
    title: "DevOps Engineer",
    department: "Engineering",
    description: "CI/CD, Postgres ops, and observability for the HRMS platform.",
    deadline: "2026-08-01",
    status: "closed",
  },
  {
    code: "JOB010",
    title: "Marketing Manager",
    department: "Marketing",
    description: "Demand gen for people-product launches and employer-brand campaigns.",
    deadline: "2026-07-20",
    status: "closed",
  },
];

const CANDIDATES: CandidateSeed[] = [
  // Applied
  {
    code: "CAN001",
    name: "Alice Smith",
    email: "alice.smith.cand@mail.com",
    position: "Frontend Engineer",
    experienceYears: 3,
    stage: "applied",
    rating: 4,
    source: "LinkedIn",
    appliedAt: "2026-08-28",
  },
  {
    code: "CAN002",
    name: "Rohan Mehta",
    email: "rohan.mehta.cand@mail.com",
    position: "Frontend Engineer",
    experienceYears: 2,
    stage: "applied",
    rating: 3.5,
    source: "Career Portal",
    appliedAt: "2026-09-01",
  },
  {
    code: "CAN003",
    name: "Priya Nair",
    email: "priya.nair.cand@mail.com",
    position: "Backend Engineer",
    experienceYears: 4,
    stage: "applied",
    rating: 4.2,
    source: "Referrals",
    appliedAt: "2026-09-02",
  },
  {
    code: "CAN004",
    name: "James Okonkwo",
    email: "james.okonkwo.cand@mail.com",
    position: "Account Executive",
    experienceYears: 5,
    stage: "applied",
    rating: 3.8,
    source: "Indeed",
    appliedAt: "2026-09-03",
  },
  {
    code: "CAN005",
    name: "Neha Kapoor",
    email: "neha.kapoor.cand@mail.com",
    position: "Talent Partner",
    experienceYears: 6,
    stage: "applied",
    rating: 4.1,
    source: "LinkedIn",
    appliedAt: "2026-09-04",
  },
  {
    code: "CAN006",
    name: "Omar Hassan",
    email: "omar.hassan.cand@mail.com",
    position: "Financial Analyst",
    experienceYears: 3,
    stage: "applied",
    rating: 3.6,
    source: "Agency",
    appliedAt: "2026-08-30",
  },
  // Screening
  {
    code: "CAN007",
    name: "Charlie Brown",
    email: "charlie.brown.cand@mail.com",
    position: "UX Designer",
    experienceYears: 4,
    stage: "screening",
    rating: 4.2,
    source: "Career Portal",
    appliedAt: "2026-08-20",
    interviewType: "Portfolio review",
    interviewer: "Sarah Mills",
    interviewAt: "2026-09-08T09:00:00.000Z",
  },
  {
    code: "CAN008",
    name: "Ananya Iyer",
    email: "ananya.iyer.cand@mail.com",
    position: "Product Manager",
    experienceYears: 7,
    stage: "screening",
    rating: 4.5,
    source: "LinkedIn",
    appliedAt: "2026-08-22",
  },
  {
    code: "CAN009",
    name: "Luis Fernandez",
    email: "luis.fernandez.cand@mail.com",
    position: "Customer Success Manager",
    experienceYears: 5,
    stage: "screening",
    rating: 3.9,
    source: "Referrals",
    appliedAt: "2026-08-25",
  },
  {
    code: "CAN010",
    name: "Mei Lin",
    email: "mei.lin.cand@mail.com",
    position: "Backend Engineer",
    experienceYears: 6,
    stage: "screening",
    rating: 4.4,
    source: "LinkedIn",
    appliedAt: "2026-08-26",
  },
  // Interview
  {
    code: "CAN011",
    name: "Diana Prince",
    email: "diana.prince.cand@mail.com",
    position: "Backend Engineer",
    experienceYears: 8,
    stage: "interview",
    rating: 4.9,
    source: "LinkedIn",
    appliedAt: "2026-08-12",
    interviewType: "System design",
    interviewer: "Bruce Banner",
    interviewAt: "2026-09-05T04:30:00.000Z",
  },
  {
    code: "CAN012",
    name: "Kabir Singh",
    email: "kabir.singh.cand@mail.com",
    position: "Frontend Engineer",
    experienceYears: 5,
    stage: "interview",
    rating: 4.3,
    source: "Referrals",
    appliedAt: "2026-08-14",
    interviewType: "Frontend deep dive",
    interviewer: "William Joseph",
    interviewAt: "2026-09-06T07:00:00.000Z",
  },
  {
    code: "CAN013",
    name: "Sofia Rossi",
    email: "sofia.rossi.cand@mail.com",
    position: "Product Manager",
    experienceYears: 6,
    stage: "interview",
    rating: 4.6,
    source: "Agency",
    appliedAt: "2026-08-10",
    interviewType: "Product case",
    interviewer: "Mark Lou",
    interviewAt: "2026-09-07T10:00:00.000Z",
  },
  {
    code: "CAN014",
    name: "Ethan Brooks",
    email: "ethan.brooks.cand@mail.com",
    position: "Account Executive",
    experienceYears: 4,
    stage: "interview",
    rating: 3.7,
    source: "Indeed",
    appliedAt: "2026-08-18",
    interviewType: "Sales role-play",
    interviewer: "John Cena",
    interviewAt: "2026-09-05T11:30:00.000Z",
  },
  // Technical
  {
    code: "CAN015",
    name: "Evan Wright",
    email: "evan.wright.cand@mail.com",
    position: "Frontend Engineer",
    experienceYears: 6,
    stage: "technical",
    rating: 4,
    source: "Agency",
    appliedAt: "2026-08-05",
    interviewType: "Live coding",
    interviewer: "Bruce Banner",
    interviewAt: "2026-09-05T10:30:00.000Z",
  },
  {
    code: "CAN016",
    name: "Aisha Rahman",
    email: "aisha.rahman.cand@mail.com",
    position: "Backend Engineer",
    experienceYears: 7,
    stage: "technical",
    rating: 4.7,
    source: "LinkedIn",
    appliedAt: "2026-08-02",
    interviewType: "API design exercise",
    interviewer: "William Joseph",
    interviewAt: "2026-09-08T06:00:00.000Z",
  },
  {
    code: "CAN017",
    name: "Tom Hughes",
    email: "tom.hughes.cand@mail.com",
    position: "UX Designer",
    experienceYears: 5,
    stage: "technical",
    rating: 4.1,
    source: "Career Portal",
    appliedAt: "2026-08-08",
    interviewType: "Design critique",
    interviewer: "Sarah Mills",
    interviewAt: "2026-09-09T08:00:00.000Z",
  },
  // Offer
  {
    code: "CAN018",
    name: "Fiona Gallagher",
    email: "fiona.gallagher.cand@mail.com",
    position: "Frontend Engineer",
    experienceYears: 4,
    stage: "offer",
    rating: 4.8,
    source: "LinkedIn",
    appliedAt: "2026-07-28",
  },
  {
    code: "CAN019",
    name: "Vikram Desai",
    email: "vikram.desai.cand@mail.com",
    position: "Talent Partner",
    experienceYears: 8,
    stage: "offer",
    rating: 4.5,
    source: "Referrals",
    appliedAt: "2026-07-30",
  },
  {
    code: "CAN020",
    name: "Hannah Lee",
    email: "hannah.lee.cand@mail.com",
    position: "Customer Success Manager",
    experienceYears: 5,
    stage: "offer",
    rating: 4.2,
    source: "LinkedIn",
    appliedAt: "2026-08-01",
  },
  // Hired
  {
    code: "CAN021",
    name: "George Clark",
    email: "george.clark.cand@mail.com",
    position: "Product Manager",
    experienceYears: 5,
    stage: "hired",
    rating: 5,
    source: "Indeed",
    appliedAt: "2026-07-10",
  },
  {
    code: "CAN022",
    name: "Isha Patel",
    email: "isha.patel.cand@mail.com",
    position: "Financial Analyst",
    experienceYears: 4,
    stage: "hired",
    rating: 4.6,
    source: "Career Portal",
    appliedAt: "2026-07-15",
  },
  {
    code: "CAN023",
    name: "Noah Kim",
    email: "noah.kim.cand@mail.com",
    position: "DevOps Engineer",
    experienceYears: 6,
    stage: "hired",
    rating: 4.4,
    source: "LinkedIn",
    appliedAt: "2026-06-20",
  },
  // Rejected (still count toward sources / history)
  {
    code: "CAN024",
    name: "Raj Gupta",
    email: "raj.gupta.cand@mail.com",
    position: "Backend Engineer",
    experienceYears: 2,
    stage: "rejected",
    rating: 2.5,
    source: "Indeed",
    appliedAt: "2026-08-01",
  },
  {
    code: "CAN025",
    name: "Emily Watson",
    email: "emily.watson.cand@mail.com",
    position: "Account Executive",
    experienceYears: 3,
    stage: "rejected",
    rating: 2.8,
    source: "Agency",
    appliedAt: "2026-08-05",
  },
  {
    code: "CAN026",
    name: "Carlos Mendes",
    email: "carlos.mendes.cand@mail.com",
    position: "Marketing Manager",
    experienceYears: 4,
    stage: "rejected",
    rating: 3,
    source: "Career Portal",
    appliedAt: "2026-07-01",
  },
  {
    code: "CAN027",
    name: "Zara Ahmed",
    email: "zara.ahmed.cand@mail.com",
    position: "UX Designer",
    experienceYears: 3,
    stage: "applied",
    rating: 3.9,
    source: "LinkedIn",
    appliedAt: "2026-09-04",
  },
  {
    code: "CAN028",
    name: "Ben Carter",
    email: "ben.carter.cand@mail.com",
    position: "DevOps Engineer",
    experienceYears: 5,
    stage: "screening",
    rating: 4,
    source: "Referrals",
    appliedAt: "2026-07-25",
  },
  {
    code: "CAN029",
    name: "Lara Costa",
    email: "lara.costa.cand@mail.com",
    position: "Marketing Manager",
    experienceYears: 7,
    stage: "interview",
    rating: 4.1,
    source: "LinkedIn",
    appliedAt: "2026-07-05",
    interviewType: "Campaign strategy",
    interviewer: "Sarah Mills",
    interviewAt: "2026-07-18T09:00:00.000Z",
  },
  {
    code: "CAN030",
    name: "Daniel Park",
    email: "daniel.park.cand@mail.com",
    position: "Frontend Engineer",
    experienceYears: 4,
    stage: "applied",
    rating: 3.4,
    source: "Indeed",
    appliedAt: "2026-09-05",
  },
];

export async function seedRecruitment(prisma: PrismaClient, organizationId: string) {
  const jobs = [];
  for (const job of JOBS) {
    const created = await prisma.jobOpening.create({
      data: {
        organizationId,
        code: job.code,
        title: job.title,
        department: job.department,
        description: job.description,
        deadline: dateFromKey(job.deadline),
        status: job.status,
      },
    });
    jobs.push(created);
  }

  const byTitle = Object.fromEntries(jobs.map((j) => [j.title, j.id]));
  const now = new Date();

  for (const row of CANDIDATES) {
    await prisma.candidate.create({
      data: {
        organizationId,
        code: row.code,
        name: row.name,
        email: row.email,
        position: row.position,
        experienceYears: row.experienceYears,
        stage: row.stage,
        rating: row.rating,
        source: row.source,
        appliedAt: dateFromKey(row.appliedAt),
        jobOpeningId: byTitle[row.position] ?? null,
        interviewType: row.interviewType ?? null,
        interviewer: row.interviewer ?? null,
        interviewAt: row.interviewAt ? new Date(row.interviewAt) : null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return { jobs: jobs.length, candidates: CANDIDATES.length };
}
