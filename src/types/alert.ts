// ============================================================================
// src/types/alert.ts
// ============================================================================

export type AlertSeverity = "critical" | "warning" | "info";

export type FetchStatus = "idle" | "loading" | "success" | "error";

export interface AsyncState<T> {
  data: T;
  status: FetchStatus;
  error: string | null;
}

export interface AlertAction {
  label: string;
  onClick: () => void;
  variant: "primary" | "secondary" | "danger";
}

export interface Alert {
  id: string;
  clientId: string;
  clientName: string;
  clientHandle: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  createdAt: Date;
}
