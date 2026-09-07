export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || 'localhost';
    const protocol = window.location.protocol || 'http:';

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${hostname}:8000`;
    }

    if (!hostname.endsWith('.vercel.app') && !hostname.endsWith('.netlify.app')) {
      return `${protocol}//${hostname}:8000`;
    }

    // On Vercel / Netlify hosted app, use relative same-origin paths
    return '';
  }
  return 'http://localhost:8000';
}

export function getN8nWebhookUrl(): string {
  if (process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL) {
    return process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
  }
  return `${getApiBaseUrl()}/api/inspect`;
}

export interface LiveCheckDetectedField {
  field_key: string;
  label: string;
  detected: boolean;
  confidence: number;
  extracted_text?: string;
}

export interface LiveCheckResult {
  quality_passed: boolean;
  quality_message: string;
  panel: string;
  detected_fields: LiveCheckDetectedField[];
  all_expected_detected: boolean;
  expected_fields: string[];
}

export async function performLiveCheck(imageBlob: Blob, panel: string, category: string = 'Packaged Food'): Promise<LiveCheckResult | null> {
  return null; // Disabled live server polling to avoid backend API flooding
}

export async function fetchPanelExpectations(): Promise<Record<string, string[]>> {
  return {
    front: ["mrp", "net_quantity", "generic_name"],
    back: ["manufacturer_name_address", "mfg_date", "consumer_care"],
    neck: ["mfg_date"]
  };
}

export async function fetchReportsList(limit: number = 50): Promise<any> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/reports/list?limit=${limit}`);
    if (res.ok) return await res.json();
  } catch (err) {
    console.error("Fetch reports list error:", err);
  }
  return { total_reports: 0, reports: [] };
}

export async function fetchViolationsDetails(limit: number = 50): Promise<any> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/violations/details?limit=${limit}`);
    if (res.ok) return await res.json();
  } catch (err) {
    console.error("Fetch violations details error:", err);
  }
  return { total_violations: 0, violations: [] };
}

export async function lookupProductMaster(gtin: string): Promise<any> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/api/products/lookup/${gtin}`);
    if (res.ok) return await res.json();
  } catch (err) {
    console.error("GTIN lookup error:", err);
  }
  return null;
}

export async function fetchAllProductsMaster(): Promise<any> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/api/products/master`);
    if (res.ok) return await res.json();
  } catch (err) {
    console.error("Fetch products master error:", err);
  }
  return { total_products: 0, products: [] };
}

export async function submitOfficerOverride(inspectionId: string, overrideData: {
  field_key: string;
  original_text: string;
  corrected_text: string;
  officer_notes: string;
  new_status: string;
}): Promise<any> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/api/inspections/${inspectionId}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrideData)
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.error("Officer override submission error:", err);
  }
  return null;
}

export async function fetchDebugStats(): Promise<any> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/api/debug/stats`);
    if (res.ok) return await res.json();
  } catch (err) {
    console.error("Fetch debug stats error:", err);
  }
  return null;
}
