import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getContractAction,
  getContractFormOptions,
} from "@/lib/actions/people/contracts";
import { ContractDetailClient } from "./contract-detail-client";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await getContractAction(id);
  if (!contract.ok) {
    notFound();
  }

  const options = await getContractFormOptions({
    employeeCode: contract.data.employeeCode,
  });

  if (!options.ok) {
    return (
      <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-4">
        <p className="text-sm text-zinc-500">{options.error}</p>
        <Link href="/admin/people/contracts" className="text-sm font-semibold underline">
          Back to contracts
        </Link>
      </div>
    );
  }

  return <ContractDetailClient contract={contract.data} options={options.data} />;
}
