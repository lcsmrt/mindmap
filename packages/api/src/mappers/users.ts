import type { User } from '@prisma/client';
import type { AuthUser } from '@mindmap/shared';

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}
