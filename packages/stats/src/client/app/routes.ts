import { Activity, AlertCircle, Coins, Cpu, Folder, LayoutDashboard, Smile } from "lucide-react";
import type React from "react";
import type { TranslationFn } from "../i18n";

export type DashboardSection = "overview" | "requests" | "errors" | "models" | "costs" | "behavior" | "projects";

export interface DashboardRoute {
	id: DashboardSection;
	label: string;
	shortLabel?: string;
	icon: React.ComponentType<{ size?: number; className?: string }>;
}

export function getRoutes(t: TranslationFn): DashboardRoute[] {
	return [
		{
			id: "overview",
			label: t("nav.section.overview"),
			icon: LayoutDashboard,
		},
		{
			id: "requests",
			label: t("nav.section.requests"),
			icon: Activity,
		},
		{
			id: "errors",
			label: t("nav.section.errors"),
			icon: AlertCircle,
		},
		{
			id: "models",
			label: t("nav.section.models"),
			icon: Cpu,
		},
		{
			id: "costs",
			label: t("nav.section.costs"),
			icon: Coins,
		},
		{
			id: "behavior",
			label: t("nav.section.behavior"),
			shortLabel: t("nav.section.behavior"),
			icon: Smile,
		},
		{
			id: "projects",
			label: t("nav.section.projects"),
			icon: Folder,
		},
	];
}
