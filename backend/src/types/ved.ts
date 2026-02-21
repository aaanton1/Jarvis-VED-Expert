// ─── VED Domain Types ───

export type VedIntent =
  | "tn_ved_lookup"
  | "duty_calculation"
  | "certification_check"
  | "invoice_check"
  | "general_question";

export interface TnVedCode {
  code: string;
  description: string;
  section: string;
  dutyRate: number;
  vatRate: number;
  excise: number;
  requiresCertification: boolean;
  certTypes: string[];
  requiresMarking: boolean;
  markingCategory?: string;
  riskNote?: string; // предупреждение о риске переквалификации кода
  keywords: string[];
}

export interface DutyCalculation {
  tnVedCode: string;
  productDescription: string;
  customsValue: number;
  currency: "RUB" | "USD" | "EUR";
  customsValueRub: number;
  dutyRate: number;
  dutyAmount: number;
  vatAmount: number;
  exciseAmount: number;
  totalPayments: number;
  breakdown: string;
}

export interface InvoiceFlag {
  type:
    | "undervaluation"
    | "wrong_code"
    | "missing_docs"
    | "sanctions_risk"
    | "marking_violation";
  severity: number;
  description: string;
  penalty: string;
}

export interface InvoiceCheckResult {
  status: "CLEAN" | "SUSPICIOUS" | "HIGH_RISK";
  flags: InvoiceFlag[];
  recommendation: string;
  legalReferences: string[];
  confidenceScore: number; // 0-100, if <95 → broker review required
  disclaimer: string;
}

export interface InvoiceInput {
  product: string;
  tnVedCode?: string;
  declaredValue: number;
  currency: "USD" | "EUR" | "RUB";
  country: string;
  quantity: number;
  unit: string;
  weight?: number;
}

// ─── Import Navigator Types ───

export interface ImportProfile {
  product: string;
  materials: string[];
  targetAudience: "children" | "adult" | "universal";
  quantity: number;
  pricePerUnit: number;
  currency: "USD" | "EUR" | "RUB" | "CNY";
  totalValue: number;
  country: string;
  logistics: "cargo" | "air" | "sea" | "express";
  hasLicense: boolean;
  hasElectronics: boolean;
  hasFastener: string | null;
  worksViaBuyer: boolean;
  worksViaRfIntermediary: boolean;
  worksDirectWithFactory: boolean;
  sourcePlatform: "1688" | "alibaba" | "factory_direct" | "agent" | "other";
  hasExportLicense: boolean;
  canConfirmOrigin: boolean;
  tnVedCodes: string[];
}

export interface ImportBrief {
  profile: ImportProfile;
  codes: TnVedCode[];
  dutyBreakdown: { code: string; description: string; duty: number; vat: number; total: number }[];
  totalPayments: number;
  certRequirements: string[];
  risks: { level: "HIGH" | "MEDIUM" | "LOW"; text: string }[];
  buyerQuestions: string[];
  firstSteps: string[];
  documentsChecklist: string[];
}

export interface VedRequest {
  intent: VedIntent;
  rawText: string;
  extractedParams: {
    product?: string;
    tnVedCode?: string;
    country?: string;
    value?: number;
    currency?: string;
    quantity?: number;
  };
  confidence: number;
}

export interface VedResponse {
  intent: VedIntent;
  success: boolean;
  data: TnVedCode[] | DutyCalculation | InvoiceCheckResult | string;
  formattedMessage: string;
  followUpSuggestions: string[];
}
