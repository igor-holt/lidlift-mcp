export interface EdgeCacheMetadata {
  cache_key: string;
  cached_at: string;
  fetched_at: string;
  ttl_seconds: number;
  hit: boolean;
}

export interface WalletBalance {
  address?: string;
  native_eth?: string;
  tokens?: Record<string, { balance_decimal?: string }>;
}

export interface OverviewPayload {
  generated_at?: string;
  latest_cycle_id?: string;
  latest_evidence_created_at?: string;
  edge_cache?: EdgeCacheMetadata;
  capsule?: {
    version?: string;
    hash?: string;
  };
  health?: {
    status?: string;
    proof_required?: boolean;
    emergency_pause?: boolean;
    issues?: string[];
  };
  chain?: {
    chain_name?: string;
    chain_id?: number;
    block_number?: number;
    gas_price_wei?: number;
  };
  herodotus?: {
    status?: string;
    summary?: string;
    satellite?: {
      contract_address?: string;
      safe_reads_required?: boolean;
    };
    indexer?: {
      chain_id?: string;
      status?: string;
    };
  };
  latest_quote?: {
    route_name?: string;
    expected_delta_eth?: number;
    token_in_symbol?: string;
    token_out_symbol?: string;
  };
  latest_proof?: {
    verified?: boolean;
    proof_engine?: string;
  };
  latest_reconciliation?: {
    status?: string;
    delta_source?: string;
    realized_delta_eth?: number;
  };
  wallet_balances?: Record<string, WalletBalance>;
}

export interface EvidencePayload {
  cycle_id: string;
  edge_cache?: EdgeCacheMetadata;
  evidence?: Record<string, unknown>;
  proof?: Record<string, unknown>;
  closing_report?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface BalancePayload {
  monitored_wallet_address: string;
  eth_balance: string;
  wei_balance: string;
  timestamp: string;
  chain: {
    chain_id: number;
    chain_name: string;
    block_number: number;
  };
}

export interface OperatorBriefPayload {
  cycle_id: string | null;
  generated_at: string;
  model: string;
  summary: string;
  evidence_loaded: boolean;
  edge_cache?: EdgeCacheMetadata;
}

export interface SessionPayload {
  authenticated: boolean;
  identity_provider: string;
  user: {
    email: string | null;
    roles: string[];
  } | null;
}

export interface AgentSessionState {
  lastCycleId: string | null;
  lastHealthStatus: string;
  lastHerodotusStatus: string;
  lastProofVerified: boolean | null;
  lastExpectedDeltaEth: number | null;
  lastSummary: string;
  lastSummaryModel: string | null;
  operatorEmail: string | null;
  lastUpdatedAt: string | null;
}

export interface AgentSessionSummary {
  digest: string;
  state: AgentSessionState;
}
