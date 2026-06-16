// Optional, per-symbol management execution config.
// Add entries here to populate the "Management Commitments" and
// "Future Growth Initiatives" panels for any covered symbol.
// All fields are optional — panels gracefully show an empty state.

export type CommitmentStatus = 'Delivered' | 'In Progress' | 'Slipped' | 'Missed';
export type ExpansionStatus = 'Announced' | 'In Progress' | 'Delivered' | 'Cancelled';

export interface Commitment {
  initiative: string;
  promisedDate: string; // free text e.g. "Q4 2024" or "2025"
  status: CommitmentStatus;
  note?: string;
}

export interface Expansion {
  initiative: string;
  investment?: string; // free text e.g. "$10B"
  targetQuarter?: string; // free text e.g. "Q2 2026"
  status: ExpansionStatus;
  note?: string;
}

export interface ExecutionConfig {
  symbol: string;
  commitments?: Commitment[];
  expansion?: Expansion[];
}

const CONFIGS: Record<string, ExecutionConfig> = {
  AAPL: {
    symbol: 'AAPL',
    commitments: [
      { initiative: 'Apple Intelligence rollout', promisedDate: '2024', status: 'Delivered' },
      { initiative: 'Vision Pro international expansion', promisedDate: '2024', status: 'Delivered' },
      { initiative: 'Services revenue growth >10%', promisedDate: 'FY2024', status: 'Delivered' },
      { initiative: 'Carbon neutral product line', promisedDate: '2030', status: 'In Progress' },
    ],
    expansion: [
      { initiative: 'India manufacturing scale-up', investment: '$10B+', targetQuarter: '2026', status: 'In Progress' },
      { initiative: 'Generative AI integration across OS', investment: 'n/a', targetQuarter: '2025', status: 'In Progress' },
    ],
  },
  MSFT: {
    symbol: 'MSFT',
    commitments: [
      { initiative: 'Azure AI capacity expansion', promisedDate: 'FY2024', status: 'Delivered' },
      { initiative: 'Copilot enterprise rollout', promisedDate: '2024', status: 'Delivered' },
      { initiative: 'Activision integration synergies', promisedDate: 'FY2025', status: 'In Progress' },
    ],
    expansion: [
      { initiative: 'Global AI datacenter buildout', investment: '$80B (FY25)', targetQuarter: 'FY2025', status: 'In Progress' },
      { initiative: 'Custom silicon (Maia/Cobalt)', targetQuarter: '2025', status: 'In Progress' },
    ],
  },
};

export function getExecutionConfig(symbol: string): ExecutionConfig | null {
  return CONFIGS[symbol.toUpperCase()] || null;
}
