import { NextResponse } from "next/server";

import { getAppName } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "archivision-ai-web",
    app: getAppName(),
  });
}
