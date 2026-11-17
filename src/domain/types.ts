export type Away = { type: string; from: string; to: string | null } | null;
export type Cert = { name: string; expires: string };
export type Person = {
  id: string; name: string; phone: string; role?: string; since?: string;
  away: Away; vacLeft: number | null; mfa: boolean; certs: Cert[];
};
export type Customer = {
  id: string; name: string; contact?: string; phone?: string;
  address?: string; project?: string; status: "Pågår" | "Väntar" | "Klart" | string;
};
export type Job = { id: string; date: string; customerId: string; title: string; need: number; people: string[] };
export type Sms = { id: string; ts: string; from: string; text: string; done: boolean };
export type Check = { id: string; text: string; done: boolean };
export type Incident = { id: string; ts: string; who: string; text: string; done: boolean };
export type LogEntry = { ts: string; text: string; by?: string };

export type State = {
  rev: number; firm: string;
  people: Person[]; customers: Customer[]; jobs: Job[];
  sms: Sms[]; security: Check[]; incidents: Incident[]; log: LogEntry[];
};
