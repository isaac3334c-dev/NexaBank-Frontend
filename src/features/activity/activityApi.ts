import { apiFetch } from '@/shared/lib/api';

export const activityApi = {
  markAsRead(id: string) {
    return apiFetch<void>(`/notifications/${id}/read`, { method: 'PATCH' });
  },
};
