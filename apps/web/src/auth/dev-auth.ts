import { cache } from "react";
import { UserRole } from "@prisma/client";
import { getPrismaClient } from "@/src/lib/prisma";

const DEFAULT_DEV_USER_EMAIL = "dev.supplier@example.local";
const DEFAULT_DEV_USER_NAME = "Dev Supplier";

export const getCurrentUser = cache(async () => {
  const email = process.env.DEV_AUTH_USER_EMAIL?.trim() || DEFAULT_DEV_USER_EMAIL;
  const name = process.env.DEV_AUTH_USER_NAME?.trim() || DEFAULT_DEV_USER_NAME;
  const prisma = getPrismaClient();

  return prisma.user.upsert({
    where: { email },
    update: { name, role: UserRole.ADMIN },
    create: { email, name, role: UserRole.ADMIN }
  });
});

export async function requireCurrentUser() {
  return getCurrentUser();
}

export async function auth() {
  return requireCurrentUser();
}
