export interface RegData {
  name: string;
  password: string;
}

export interface RegResult {
  name: string;
  index: string;
  error: boolean;
  errorText: string;
}

export interface EventData {
  event: string;
  [key: string]: unknown;
}

export interface EventResult {
  status?: string;
  error?: string;
  [key: string]: unknown;
}

export interface GenericData {
  [key: string]: unknown;
}

export interface GenericResult {
  type?: string;
  data?: unknown;
  id?: number;
  status?: string;
  [key: string]: unknown;
}
