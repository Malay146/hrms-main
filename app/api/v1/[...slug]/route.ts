import { dispatchV1 } from "@/lib/api/v1/dispatch";

type RouteContext = { params: Promise<{ slug: string[] }> };

async function handle(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  return dispatchV1(request, slug ?? []);
}

export async function GET(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return handle(request, context);
}
