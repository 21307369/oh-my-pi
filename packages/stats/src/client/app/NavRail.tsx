import { useTranslation } from "../i18n";
import { type DashboardSection, getRoutes } from "./routes";

export interface NavRailProps {
	activeSection: DashboardSection;
	onSectionChange: (section: DashboardSection) => void;
	className?: string;
}

export function NavRail({ activeSection, onSectionChange, className = "" }: NavRailProps) {
	const { t } = useTranslation();
	const routes = getRoutes(t);

	return (
		<aside className={`stats-nav-rail ${className}`}>
			<div className="stats-nav-rail-header">
				<div className="stats-logo-container">
					<span className="stats-logo-text">OH MY PI</span>
					<span className="stats-logo-subtext">{t("nav.observability")}</span>
				</div>
			</div>

			<nav className="stats-nav-rail-menu">
				{routes.map(route => {
					const isActive = route.id === activeSection;
					const Icon = route.icon;
					return (
						<button
							key={route.id}
							type="button"
							onClick={() => onSectionChange(route.id)}
							className="stats-nav-rail-item"
							data-active={isActive ? "true" : "false"}
							aria-current={isActive ? "page" : undefined}
						>
							<Icon size={16} className="stats-nav-rail-item-icon" />
							<span className="stats-nav-rail-item-label">{route.label}</span>
						</button>
					);
				})}
			</nav>

			<div className="stats-nav-rail-footer">
				<span className="stats-version-tag">{t("nav.version", { version: "1.0.0" })}</span>
			</div>
		</aside>
	);
}
