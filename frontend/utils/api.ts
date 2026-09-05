export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || 'localhost';
    const protocol = window.location.protocol || 'http:';

    // If running on local network IP, localhost, 127.0.0.1, or local Wi-Fi / hotspot
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${hostname}:8000`;
    }

    // If accessing via any IP address (e.g. 192.168.x.x, 172.x.x.x, 10.x.x.x) or local dev domain (non-vercel)
    if (!hostname.endsWith('.vercel.app') && !hostname.endsWith('.netlify.app')) {
      return `${protocol}//${hostname}:8000`;
    }
  }
  return 'http://localhost:8000';
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
  try {
    const formData = new FormData();
    formData.append('image', imageBlob, 'frame.jpg');
    formData.append('panel', panel);
    formData.append('category', category);

    const apiBase = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${apiBase}/api/inspect/live-check`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const data = await response.json();
    return data as LiveCheckResult;
  } catch (err) {
    // Fail silently in UX polling loop
    return null;
  }
}

export async function fetchPanelExpectations(): Promise<Record<string, string[]>> {
  try {
    const apiBase = getApiBaseUrl();
    const response = await fetch(`${apiBase}/api/config/panel-expectations`);
    if (!response.ok) throw new Error("Failed to fetch expectations");
    return await response.json();
  } catch (err) {
    return {
      front: ["mrp", "net_quantity", "generic_name"],
      back: ["manufacturer_name_address", "mfg_date", "consumer_care"],
      neck: ["mfg_date"]
    };
  }
}
