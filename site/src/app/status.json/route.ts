// /status.json: what the last validator run found (per lib and function), as the site shows it.
// Published so other builds of the site (review deployments) can show the same status, and for
// anyone who wants the data without running the validator.
import { loadStatus } from '@/lib/data';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(loadStatus() ?? { libs: {} });
}
