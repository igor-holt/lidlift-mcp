interface IdentityUser {
  email?: string;
  app_metadata?: { roles?: unknown };
}

export interface OperatorIdentity {
  email: string | null;
  roles: string[];
}

function parseRoles(user: IdentityUser | null | undefined): string[] {
  const roles = user?.app_metadata?.roles;
  return Array.isArray(roles) ? roles.filter((value): value is string => typeof value === "string") : [];
}

interface IdentityContext {
  clientContext?: {
    user?: IdentityUser | null;
  };
}

export function getOperatorIdentity(context: unknown): OperatorIdentity | null {
  const user = ((context as IdentityContext | null)?.clientContext?.user ?? null) as IdentityUser | null;
  if (!user) {
    return null;
  }

  return {
    email: user.email ?? null,
    roles: parseRoles(user),
  };
}

export function requireOperator(context: unknown): OperatorIdentity {
  const identity = getOperatorIdentity(context);
  if (!identity) {
    throw new Response(JSON.stringify({ error: "Operator login required" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  if (!identity.roles.some((role) => role === "operator" || role === "admin")) {
    throw new Response(JSON.stringify({ error: "Operator role required" }), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  return identity;
}
