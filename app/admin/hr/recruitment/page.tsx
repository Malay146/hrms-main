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
};

export default async function RecruitmentPage() {
  const result = await getRecruitmentBoard();
  return (
    <RecruitmentClient initialBoard={result.ok ? result.data : EMPTY_BOARD} />
  );
}
