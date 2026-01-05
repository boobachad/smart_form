export interface SupportedMetric {
    key: string;
    label: string;
    type: 'number' | 'string';
}

export interface PlatformFeature {
    client_fetch_supported: boolean;
}

export interface SystemCapability {
    display_name: string;
    status: 'OPERATIONAL' | 'PARTIAL_OUTAGE' | 'UNAVAILABLE';
    features: PlatformFeature;
    unavailable_reason?: string;
    supported_metrics: SupportedMetric[];
}

export type SystemCapabilities = Record<string, SystemCapability>;
