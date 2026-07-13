import type { LucideIcon } from 'lucide-react';
import { BarChart3, BriefcaseBusiness, Calculator, ClipboardCheck, Database, GitCompareArrows, Layers3, PlayCircle, ShieldCheck } from 'lucide-react';

export type Persona = 'data-engineer' | 'business-analyst';
export type View = 'overview' | 'lob' | 'warehouse' | 'pipeline' | 'dq' | 'rating' | 'requirements' | 'delivery' | 'azure';
export type DeliveryTab = 'traceability' | 'workflow' | 'raci' | 'governance' | 'backlog' | 'uat';

export const defaultDeliveryTab: DeliveryTab = 'traceability';

export type NavItem = { id: View; label: string; group: string; icon: LucideIcon };

const items: Record<View, NavItem> = {
  overview: { id: 'overview', label: 'Portfolio Overview', group: 'Overview', icon: BarChart3 },
  lob: { id: 'lob', label: 'Lines of Business', group: 'Overview', icon: Layers3 },
  warehouse: { id: 'warehouse', label: 'Warehouse Architecture', group: 'Data Engineering', icon: Database },
  pipeline: { id: 'pipeline', label: 'Pipeline Runs', group: 'Data Engineering', icon: PlayCircle },
  dq: { id: 'dq', label: 'Data Quality', group: 'Data Engineering', icon: ShieldCheck },
  azure: { id: 'azure', label: 'Azure Stack Mapping', group: 'Data Engineering', icon: GitCompareArrows },
  delivery: { id: 'delivery', label: 'BA Delivery Hub', group: 'Business Analysis', icon: BriefcaseBusiness },
  rating: { id: 'rating', label: 'Rating Engine', group: 'Business Analysis', icon: Calculator },
  requirements: { id: 'requirements', label: 'Requirements & Tests', group: 'Business Analysis', icon: ClipboardCheck },
};

const order: Record<Persona, View[]> = {
  'data-engineer': ['warehouse', 'pipeline', 'dq', 'overview', 'lob', 'azure', 'rating', 'requirements'],
  'business-analyst': ['delivery', 'requirements', 'rating', 'overview', 'lob', 'warehouse', 'dq', 'azure', 'pipeline'],
};

export function navigationFor(persona: Persona): NavItem[] {
  return order[persona].map((id) => items[id]);
}

export function defaultView(persona: Persona): View {
  return persona === 'data-engineer' ? 'warehouse' : 'delivery';
}

export function isPersona(value: string | null): value is Persona {
  return value === 'data-engineer' || value === 'business-analyst';
}

export function isView(value: string | null): value is View {
  return Boolean(value && value in items);
}

export function isDeliveryTab(value: string | null): value is DeliveryTab {
  return value === 'traceability' || value === 'workflow' || value === 'raci'
    || value === 'governance' || value === 'backlog' || value === 'uat';
}
