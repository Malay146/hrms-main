import {
  getRecruitmentBoard,
  type RecruitmentBoard,
} from "@/lib/actions/recruitment";
import RecruitmentClient from "./recruitment-client";

const EMPTY_BOARD: RecruitmentBoard = {
  jobs: [],
  candidates: [],
  pipeline: {
    Applied: [],
    Screening: [],
    Interview: [],
    Technical: [],
    Offer: [],
    Hired: [],
  },
  interviews: [],
  sourceData: [{ name: "No data", value: 1, color: "#D4D4D8" }],
  activities: [],
  stats: {
    openPositions: 0,
    totalApplicants: 0,
    interviewRate: "0%",
    offerAcceptance: "0%",
  },
  applicantsPage: 1,
  applicantsPageSize: 15,
  applicantsTotal: 0,
  applicantsTotalPages: 1,
};

export default async function RecruitmentPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; stage?: string; position?: string }>;
}) {
  const params = await searchParams;
  const result = await getRecruitmentBoard({
    page: Number(params.page || "1"),
    pageSize: 15,
    search: params.q,
    stage: params.stage,
    position: params.position,
  });
  return (
    <RecruitmentClient
      initialBoard={result.ok ? result.data : EMPTY_BOARD}
      query={{
        q: params.q ?? "",
        stage: params.stage ?? "All",
        position: params.position ?? "All",
        page: result.ok ? result.data.applicantsPage : 1,
      }}
    />
  );
}
