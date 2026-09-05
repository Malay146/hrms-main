import { requireStaffPage } from "@/lib/auth/session";

export default async function ApiDocsPage() {
  await requireStaffPage();
  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 font-medium">API</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          OpenAPI 3 for every PeoplePay360 operation. Sign in on this origin, then use Try it out —
          requests send your session cookie and still enforce role permissions.
        </p>
      </div>
      <iframe
        title="Swagger UI"
        src="/api/docs"
        className="w-full min-h-[75vh] flex-1 rounded-xl border border-border bg-white"
      />
    </div>
  );
}
