import { GET as getPublicLotResponse } from "@/app/api/public-lots/route";

export async function GET(request, { params }) {
  const { token } = await params;
  const url = new URL(request.url);
  url.searchParams.set("token", token);
  return getPublicLotResponse(new Request(url, { headers: request.headers }));
}
