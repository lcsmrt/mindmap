export type DbStatus = 'ok' | 'unreachable';

export interface HealthResponse {
  status: 'ok';
  db: DbStatus;
}
