import { useState } from "react";
import {
  Activity,
  Bell,
  Boxes,
  CircleHelp,
  Command,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Avatar,
  Breadcrumb,
  Button,
  Dropdown,
  DropdownItem,
} from "../components/ui.jsx";
import { useAuth } from "../features/auth/useAuth.js";

const primaryLinks = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: Boxes },
  { to: "/deployments", label: "Deployments", icon: GitBranch },
  { to: "/activity", label: "Activity", icon: Activity },
];

export default function AppLayout({
  children,
  health,
  query,
  onQueryChange,
  onNotify,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const navigationLinks = user.isAdmin
    ? [...primaryLinks, { to: "/admin/projects", label: "Admin", icon: ShieldCheck }]
    : primaryLinks;
  const current = navigationLinks.find(
    (link) => link.to === location.pathname,
  ) || (location.pathname.startsWith("/admin/") ? { label: "Admin" } : location.pathname.startsWith("/projects/new") ? { label: "Add Project" } : location.pathname.startsWith("/projects/") ? { label: "Project" } : location.pathname.startsWith("/deployments/") ? { label: "Deployment" } : { label: "Settings" });
  const online = Boolean(health.data) && !health.error;
  const handleLogout = async () => {
    try {
      await logout();
      onNotify("You have been signed out.");
    } catch {
      onNotify("Sign out failed. Please try again.");
    }
  };
  const nav = (
    <>
      <Link
        to="/dashboard"
        className="brand"
        onClick={() => setMobileOpen(false)}
      >
        <span className="brand-mark">
          <Command size={17} />
        </span>
        <span>DeployHub</span>
      </Link>
      <div className="workspace-switch">
        <span className="workspace-icon">{user.githubUsername.slice(0, 2).toUpperCase()}</span>
        <span className="workspace-label">
          <strong>@{user.githubUsername}</strong>
          <small>GitHub account</small>
        </span>
      </div>
      <p className="side-label">Workspace</p>
      <nav className="nav-list" aria-label="Main navigation">
        {navigationLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <Icon size={15} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <p className="side-label">Preferences</p>
      <nav className="nav-list" aria-label="Preferences">
        <NavLink
          to="/settings"
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          <Settings size={15} strokeWidth={1.8} />
          <span>Settings</span>
        </NavLink>
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-bottom">
        <div
          className="api-indicator"
          title={health.error || health.data?.message || "Checking API"}
        >
          <span
            className={`api-dot ${online ? "online" : health.error ? "offline" : ""}`}
          />
          {health.loading
            ? "API connecting..."
            : health.error
              ? "API unavailable"
              : "API operational"}
        </div>
        <button
          className="user-row"
        >
          <Avatar
            initials={user.githubUsername.slice(0, 2).toUpperCase()}
            src={user.githubAvatarUrl}
            alt={`@${user.githubUsername}`}
          />
          <span className="user-info">
            <strong>{user.githubUsername}</strong>
            <small>GitHub user</small>
          </span>
          <span className="connected">Connected</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileOpen ? " mobile-open" : ""}`}>
        {nav}
      </aside>
      {mobileOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <Button
            className="mobile-menu"
            variant="ghost"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={17} /> : <Menu size={17} />}
          </Button>
          <Breadcrumb
            items={[
              { label: "Workspace", to: "/dashboard" },
              { label: current.label },
            ]}
          />
          <div className="top-actions">
            <label className="search-box">
              <Search size={14} />
              <input
                aria-label="Search workspace"
                placeholder="Search anything..."
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
              />
              <span className="shortcut">/</span>
            </label>
            <Dropdown
              trigger={({ open, toggle }) => (
                <button
                  className="icon-button"
                  aria-label="Notifications"
                  aria-expanded={open}
                  onClick={toggle}
                >
                  <Bell size={16} />
                </button>
              )}
            >
              <div className="dropdown-heading">Notifications</div>
              <div className="dropdown-item" style={{ cursor: "default" }}>
                <span className={`api-dot ${online ? "online" : health.error ? "offline" : ""}`} />
                {health.loading ? "Checking API status..." : online ? "API operational" : "API unavailable"}
              </div>
              <div
                className="dropdown-item"
                style={{ cursor: "default", whiteSpace: "normal" }}
              >
                No workspace notifications.
              </div>
              <div className="dropdown-divider" />
              <DropdownItem
                icon={ShieldCheck}
                onClick={() =>
                  onNotify("Notification preferences are in Settings.")
                }
              >
                Notification settings
              </DropdownItem>
            </Dropdown>
            <Dropdown
              trigger={({ open, toggle }) => (
                <button
                  className="icon-button"
                  aria-label="Open user menu"
                  aria-expanded={open}
                  onClick={toggle}
                >
                  <Avatar
                    initials={user.githubUsername.slice(0, 2).toUpperCase()}
                    src={user.githubAvatarUrl}
                    alt={`@${user.githubUsername}`}
                  />
                </button>
              )}
            >
              <div className="dropdown-heading">@{user.githubUsername}</div>
              <div className="dropdown-item" style={{ cursor: "default" }}>
                Authenticated with GitHub
              </div>
              <div className="dropdown-divider" />
              <DropdownItem
                icon={Settings}
                onClick={() => navigate("/settings")}
              >
                Settings
              </DropdownItem>
              <DropdownItem
                icon={CircleHelp}
                onClick={() => onNotify("Help center coming soon.")}
              >
                Help center
              </DropdownItem>
              <div className="dropdown-divider" />
              <DropdownItem icon={LogOut} danger onClick={handleLogout}>
                Sign out
              </DropdownItem>
            </Dropdown>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
