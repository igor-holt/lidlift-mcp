import { getUser, login, logout, onAuthChange, type User } from "@netlify/identity";

export type IdentityUser = User;

export async function initIdentity(): Promise<IdentityUser | null> {
  return getUser();
}

export function collectRoles(user: IdentityUser | null): string[] {
  return Array.isArray(user?.roles) ? user.roles : [];
}

export { login as loginWithPassword, logout as logoutIdentity, onAuthChange };
