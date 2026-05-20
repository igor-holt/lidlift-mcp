import type { Context } from "@netlify/functions";

import { getOperatorIdentity } from "./lib/auth";
import { jsonResponse, noStoreHeaders } from "./lib/http";

export default async (_request: Request, context: Context): Promise<Response> => {
  const identity = getOperatorIdentity(context);
  return jsonResponse(
    {
      authenticated: Boolean(identity),
      identity_provider: "netlify-identity",
      user: identity,
    },
    noStoreHeaders(),
  );
};
