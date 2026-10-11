/**
 * Sistema de Rastreamento de Origem de Dados (Data Lineage)
 * Permite auditar a origem de qualquer dado no ORBIT
 *
 * Uso:
 *   const lineage = createLineage('insights', 'instagram/overview')
 *   lineage.track('fetch', { source: 'instagram-api', timestamp: Date.now() })
 *   lineage.track('transform', { rule: 'filter-low-engagement', count: 3 })
 *   console.log(lineage.getPath()) // Mostra caminho completo
 */

export interface DataSource {
  id: string;
  name: string;
  type: "api" | "database" | "cache" | "computed" | "user-input" | "external";
  url?: string;
  endpoint?: string;
  timestamp: number;
  confidence: "L0" | "L1" | "L2"; // L0 = confirmado, L1 = fundamentado, L2 = incerto
}

export interface TransformStep {
  id: string;
  name: string;
  type:
    "filter" | "map" | "reduce" | "aggregate" | "join" | "enrich" | "validate";
  description: string;
  inputCount?: number;
  outputCount?: number;
  timestamp: number;
  duration?: number; // em ms
  status: "success" | "warning" | "error";
  errorMessage?: string;
}

export interface DataLineage {
  dataId: string;
  dataType: string;
  source: DataSource;
  transforms: TransformStep[];
  finalValue: unknown;
  createdAt: number;
  updatedAt: number;
  hash: string; // para detectar mudanças
}

export interface LineageTrail {
  path: string;
  confidence: "L0" | "L1" | "L2";
  steps: Array<{
    stage: string;
    description: string;
    timestamp: number;
    status: "success" | "warning" | "error";
  }>;
  totalDuration: number;
  isValid: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CRIADOR DE LINEAGE
// ═══════════════════════════════════════════════════════════════════════════

export class DataLineageTracker {
  private lineage: DataLineage;
  private startTime: number;

  constructor(dataId: string, dataType: string, source: DataSource) {
    this.startTime = Date.now();
    this.lineage = {
      dataId,
      dataType,
      source,
      transforms: [],
      finalValue: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hash: this.generateHash(dataId),
    };
  }

  /**
   * Registra um passo de transformação
   */
  track(
    name: string,
    type: TransformStep["type"],
    description: string,
    options?: {
      inputCount?: number;
      outputCount?: number;
      duration?: number;
      status?: "success" | "warning" | "error";
      errorMessage?: string;
    },
  ): void {
    const step: TransformStep = {
      id: `${this.lineage.dataId}-${this.lineage.transforms.length}`,
      name,
      type,
      description,
      inputCount: options?.inputCount,
      outputCount: options?.outputCount,
      timestamp: Date.now(),
      duration: options?.duration,
      status: options?.status || "success",
      errorMessage: options?.errorMessage,
    };

    this.lineage.transforms.push(step);
    this.lineage.updatedAt = Date.now();
  }

  /**
   * Define o valor final
   */
  setValue(value: unknown): void {
    this.lineage.finalValue = value;
    this.lineage.updatedAt = Date.now();
  }

  /**
   * Obtém o caminho completo (trail)
   */
  getTrail(): LineageTrail {
    const totalDuration = Date.now() - this.startTime;
    const steps = [
      {
        stage: "source",
        description: `${this.lineage.source.type}: ${this.lineage.source.name}`,
        timestamp: this.lineage.source.timestamp,
        status: "success" as const,
      },
      ...this.lineage.transforms.map((t) => ({
        stage: t.type,
        description: t.description,
        timestamp: t.timestamp,
        status: t.status,
      })),
    ];

    const confidence = this.lineage.source.confidence;
    const isValid = this.lineage.transforms.every((t) => t.status !== "error");

    return {
      path: this.generatePath(),
      confidence,
      steps,
      totalDuration,
      isValid,
    };
  }

  /**
   * Obtém o objeto lineage completo
   */
  getLineage(): DataLineage {
    return { ...this.lineage };
  }

  /**
   * Gera um caminho legível
   */
  private generatePath(): string {
    const source = `[${this.lineage.source.type.toUpperCase()}] ${this.lineage.source.name}`;
    const transforms = this.lineage.transforms
      .map((t) => `→ ${t.type}(${t.name})`)
      .join(" ");
    return `${source} ${transforms}`;
  }

  /**
   * Gera hash para detectar mudanças
   */
  private generateHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Exporta para JSON (para logging/auditoria)
   */
  toJSON(): string {
    return JSON.stringify(this.lineage, null, 2);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function createLineage(
  dataId: string,
  dataType: string,
  source: Omit<DataSource, "timestamp">,
): DataLineageTracker {
  return new DataLineageTracker(dataId, dataType, {
    ...source,
    timestamp: Date.now(),
  });
}

export function createInstagramAPILineage(
  endpoint: string,
  clientId: string,
): DataLineageTracker {
  return createLineage(`ig-${clientId}-${Date.now()}`, "instagram-insight", {
    id: `instagram-api-${endpoint}`,
    name: `Instagram API: ${endpoint}`,
    type: "api",
    url: "https://graph.instagram.com",
    endpoint,
    confidence: "L0",
  });
}

export function createDatabaseLineage(
  table: string,
  query: string,
  clientId: string,
): DataLineageTracker {
  return createLineage(`db-${clientId}-${Date.now()}`, "database-record", {
    id: `database-${table}`,
    name: `Database: ${table}`,
    type: "database",
    endpoint: query,
    confidence: "L0",
  });
}

export function createComputedLineage(
  computation: string,
  clientId: string,
): DataLineageTracker {
  return createLineage(`computed-${clientId}-${Date.now()}`, "computed-value", {
    id: `computed-${computation}`,
    name: `Computed: ${computation}`,
    type: "computed",
    confidence: "L1",
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTO REACT PARA COMPARTILHAR LINEAGE
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";

export const LineageContext = React.createContext<{
  lineages: Map<string, DataLineage>;
  addLineage: (lineage: DataLineage) => void;
  getLineage: (dataId: string) => DataLineage | undefined;
  getAllLineages: () => DataLineage[];
} | null>(null);

export function useLineageContext() {
  const context = React.useContext(LineageContext);
  if (!context) {
    throw new Error(
      "useLineageContext deve ser usado dentro de LineageProvider",
    );
  }
  return context;
}

export function LineageProvider({ children }: { children: React.ReactNode }) {
  const [lineages] = React.useState(new Map<string, DataLineage>());

  const value = {
    lineages,
    addLineage: (lineage: DataLineage) => {
      lineages.set(lineage.dataId, lineage);
    },
    getLineage: (dataId: string) => lineages.get(dataId),
    getAllLineages: () => Array.from(lineages.values()),
  };

  return (
    <LineageContext.Provider value={value}>{children}</LineageContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGGER DE AUDITORIA
// ═══════════════════════════════════════════════════════════════════════════

export class AuditLogger {
  private logs: Array<{
    timestamp: number;
    level: "info" | "warning" | "error";
    dataId: string;
    message: string;
    lineage?: DataLineage;
  }> = [];

  log(
    level: "info" | "warning" | "error",
    dataId: string,
    message: string,
    lineage?: DataLineage,
  ): void {
    this.logs.push({
      timestamp: Date.now(),
      level,
      dataId,
      message,
      lineage,
    });

    // Log para console em desenvolvimento
    if (process.env.NODE_ENV === "development") {
      const icon = level === "error" ? "❌" : level === "warning" ? "⚠️" : "ℹ️";
      console.log(`${icon} [${dataId}] ${message}`, lineage?.source.name);
    }
  }

  getLogs() {
    return [...this.logs];
  }

  exportCSV(): string {
    const headers = ["timestamp", "level", "dataId", "message", "source"];
    const rows = this.logs.map((log) => [
      new Date(log.timestamp).toISOString(),
      log.level,
      log.dataId,
      log.message,
      log.lineage?.source.name || "N/A",
    ]);
    return [headers, ...rows].map((r) => r.join(",")).join("\n");
  }

  exportJSON() {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const auditLogger = new AuditLogger();
