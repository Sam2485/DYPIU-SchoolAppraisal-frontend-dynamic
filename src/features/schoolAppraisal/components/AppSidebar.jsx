import { initialsFromName } from "../../../utils/initials";
import { ClipboardCheck, ChartNoAxesColumn, Mail, LogOut, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getAttachmentUrl } from "../../../utils/attachment";
import { scrollPageToTop } from "../../../utils/scrollToTop";

const ClipboardIcon = () => <ClipboardCheck size={18} strokeWidth={1.8} aria-hidden="true" />;
const SummaryIcon = () => <ChartNoAxesColumn size={18} strokeWidth={1.8} aria-hidden="true" />;
const MailIcon = () => <Mail size={18} strokeWidth={1.8} aria-hidden="true" />;
const LogoutIcon = () => <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />;
const ChevronIcon = () => <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />;


export default function AppSidebar({
  title,
  subtitle,
  badge = "SA",
  roleTitle,
  roleText,
  academicYear = "",
  currentAcademicYear = "",
  availableYears = [],
  supportEmail = sessionStorage.getItem("universitySupportEmail") || sessionStorage.getItem("supportEmail") || "",
  onYearChange,
  items,
  pinnedItems = [],
  standaloneItems = [],
  activeId,
  onChange,
  profile,
  onLogout,
  onOpenProfile,
}) {
  const activeItem = items.find((item) => item.id === activeId);
  const hasYearSelector = Boolean(onYearChange && availableYears?.length);
  const isCurrentAcademicYear = (year) => currentAcademicYear && String(year) === String(currentAcademicYear);
  const actionGroups = standaloneItems.reduce((groups, item) => {
    const groupId = item.group || "review-actions";
    const existingGroup = groups.find((group) => group.id === groupId);
    if (existingGroup) {
      existingGroup.items.push(item);
    } else {
      groups.push({
        id: groupId,
        label: item.groupLabel || "Review Actions",
        items: [item],
      });
    }
    return groups;
  }, []);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!dropdownRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const selectSection = (sectionId) => {
    onChange(sectionId);
    setIsOpen(false);
    scrollPageToTop();
  };

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__mark">{badge}</div>
        <div className="app-sidebar__brand-copy">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </div>

      <div className="app-sidebar__context">
        <div>
          <span className="app-sidebar__eyebrow">Current workspace</span>
          <strong>{roleTitle}</strong>
          <small>{roleText}</small>
        </div>
        {hasYearSelector ? (
          <div className="app-sidebar__year-selector">
            <span>Academic Year</span>
            <select
              value={academicYear}
              onChange={(e) => onYearChange(e.target.value)}
              style={{
                backgroundColor: "#ffffff",
                color: "#1e293b",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                padding: "3px 8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                outline: "none",
              }}
              title="Select Academic Year"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr} style={{ backgroundColor: "#ffffff", color: "#1e293b" }}>
                  {yr}
                </option>
              ))}
            </select>
            {currentAcademicYear && (
              <small>{isCurrentAcademicYear(academicYear) ? "Current workspace" : `Current: ${currentAcademicYear}`}</small>
            )}
          </div>
        ) : (
          <div className="app-sidebar__year-display">
            <span>Academic Year</span>
            <strong>{academicYear}</strong>
          </div>
        )}
      </div>

      <nav className="app-sidebar__nav" aria-label="Appraisal sections" ref={dropdownRef}>
        {items.length > 0 && (
          <>
            <button
              type="button"
              className="app-sidebar__nav-label"
              onClick={() => setIsOpen((open) => !open)}
              aria-expanded={isOpen}
              aria-controls="appraisal-section-menu"
            >
              <span>Appraisal form</span>
            </button>
            <div className={`app-sidebar__dropdown${isOpen ? " is-open" : ""}`}>
              <button
                type="button"
                className={`app-sidebar__select-card${activeItem ? "" : " is-placeholder"}`}
                onClick={() => setIsOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
              >
                <span className="app-sidebar__select-icon">
                  {activeItem?.id === "overview" || activeItem?.id === "summary" ? <SummaryIcon /> : <ClipboardIcon />}
                </span>
                <span className="app-sidebar__select-copy">
                  <small>{activeItem?.number ? `Section ${activeItem.number}` : activeItem ? "Overview" : "Appraisal form"}</small>
                  <strong>{activeItem?.title || "Browse sections"}</strong>
                </span>
                <span className="app-sidebar__chevron"><ChevronIcon /></span>
              </button>

              {isOpen && (
                <div id="appraisal-section-menu" className="app-sidebar__menu" role="listbox" aria-label="Appraisal form sections">
                  {items.map((item) => {
                    const selected = item.id === activeId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`app-sidebar__menu-item${selected ? " is-selected" : ""}`}
                        onClick={() => selectSection(item.id)}
                      >
                        <span className="app-sidebar__menu-number">{item.id === "overview" || item.id === "summary" ? <SummaryIcon /> : <ClipboardIcon />}</span>
                        <span className="app-sidebar__menu-copy">
                          {item.number && <small>Section {item.number}</small>}
                          <span>{item.title}</span>
                        </span>
                        {selected && <span className="app-sidebar__menu-check">{"\u2713"}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
        {pinnedItems.length > 0 && (
          <div className="app-sidebar__pinned-list" aria-label="Pinned appraisal sections">
            {pinnedItems.map((item) => {
              const selected = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`app-sidebar__nav-item app-sidebar__pinned-item${selected ? " is-active" : ""}`}
                  onClick={() => selectSection(item.id)}
                  aria-current={selected ? "page" : undefined}
                >
                  <span className="app-sidebar__nav-icon"><ClipboardIcon /></span>
                  <span className="app-sidebar__nav-text">
                    {item.caption && <small>{item.caption}</small>}
                    <strong>{item.title}</strong>
                  </span>
                  {selected && <span className="app-sidebar__active-dot" />}
                </button>
              );
            })}
          </div>
        )}
        {items.length > 0 && <span className="app-sidebar__nav-hint">Jump to any section at any time</span>}

        {actionGroups.length > 0 && (
          <div className="app-sidebar__action-groups">
            {actionGroups.map((group) => (
              <section className={`app-sidebar__action-group app-sidebar__action-group--${group.id}`} key={group.id}>
                <span className="app-sidebar__action-heading">{group.label}</span>
                <div className="app-sidebar__nav-list" aria-label={group.label}>
                  {group.items.map((item) => {
                    const selected = item.id === activeId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`app-sidebar__nav-item${selected ? " is-active" : ""}`}
                        onClick={() => selectSection(item.id)}
                        aria-current={selected ? "page" : undefined}
                      >
                        <span className="app-sidebar__nav-icon"><ClipboardIcon /></span>
                        <span className="app-sidebar__nav-text">
                          <small>{item.caption || group.label}</small>
                          <strong>{item.title}</strong>
                        </span>
                        {selected && <span className="app-sidebar__active-dot" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </nav>

      {supportEmail && (
        <a className="app-sidebar__support" href={`mailto:${supportEmail}`}>
          <span className="app-sidebar__support-icon"><MailIcon /></span>
          <span><small>Need help?</small><strong>{supportEmail}</strong></span>
        </a>
      )}

      <div
        className="app-sidebar__profile"
        role="button"
        tabIndex={0}
        onClick={() => onOpenProfile?.()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenProfile?.();
          }
        }}
        aria-label="Open your profile"
      >
        <div className="app-sidebar__avatar">
          {profile.avatarUrl ? (
            <img className="app-sidebar__avatar-img" src={getAttachmentUrl(profile.avatarUrl)} alt="" />
          ) : (
            initialsFromName(profile.name) || badge
          )}
        </div>
        <div className="app-sidebar__profile-copy">
          <strong>{profile.name}</strong>
          <span>{profile.designation} - {profile.school}</span>
        </div>
        <button
          type="button"
          className="app-sidebar__logout"
          onClick={(event) => {
            event.stopPropagation();
            onLogout();
          }}
          aria-label="Log out"
          title="Log out"
        >
          <LogoutIcon />
        </button>
      </div>
    </aside>
  );
}
