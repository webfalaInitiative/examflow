import prisma from '../config/prismaClient.js';

export async function logModeration({ actorId, entityType, entityId, action, details }) {
  return prisma.moderationLog.create({
    data: {
      actorId,
      entityType,
      entityId,
      action,
      details: details ?? undefined,
    },
  });
}
