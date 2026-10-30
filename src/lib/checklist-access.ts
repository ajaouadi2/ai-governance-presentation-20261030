import type { Role } from './domain';
export const canReadChecklist = (role: Role) => role === 'requester' || role === 'evaluator';
