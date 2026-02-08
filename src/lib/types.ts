import { Timestamp } from "firebase/firestore";

export type UserRole = "OWNER" | "MANAGER" | "ACCOUNTANT" | "VIEWER";

export type User = {
  uid: string;
  email: string;
  tenantId: string;
  role: UserRole;
  locale: 'en' | 'es';
  displayName?: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Tenant = {
  id: string;
  name: string;
  ownerId: string;
  timezone: string;
  currency: 'EUR';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  settings?: {
    csvMappings?: any;
  };
};

export type MonthCloseStatus = "PENDING" | "PROCESSING" | "REVIEW" | "READY" | "LOCKED";

export type MonthClose = {
  id: string;
  tenantId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: MonthCloseStatus;
  summary?: any;
};

export type JobType = 
  | "PARSE_BANK_CSV" 
  | "PARSE_INVOICE_PDF" 
  | "NORMALIZE" 
  | "MATCH" 
  | "SUMMARIZE" 
  | "EXPORT";
  
export type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type Job = {
  id: string;
  tenantId: string;
  monthCloseId: string;
  type: JobType;
  status: JobStatus;
  progress?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
};
