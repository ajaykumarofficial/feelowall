import React, { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

/**
 * Icon button that opens a list of actions. A dropdown on desktop, a bottom
 * sheet on phones (see .fw-menu in index.css).
 *
 * items: [{ label, icon, onClick, hint, danger, active, hidden }]
 *        { heading: 'Text' } adds a section label, { divider: true } a rule.
 */
const ActionMenu = ({
  label = 'More options',
  icon: Icon = MoreHorizontal,
  items,
  title,
  triggerClassName = 'fw-icon-btn',
  triggerContent,
  align = 'right'
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();

  const visibleItems = items.filter((item) => item && !item.hidden);

  useEffect(() => {
    if (!open) return undefined;

    const onPointer = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    document.addEventListener('keydown', onKey);
    listRef.current?.querySelector('[role="menuitem"]')?.focus();

    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Arrow keys move between items.
  const onListKeyDown = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nodes = Array.from(listRef.current.querySelectorAll('[role="menuitem"]'));
    const index = nodes.indexOf(document.activeElement);
    let next = 0;
    if (event.key === 'ArrowDown') next = (index + 1) % nodes.length;
    if (event.key === 'ArrowUp') next = (index - 1 + nodes.length) % nodes.length;
    if (event.key === 'End') next = nodes.length - 1;
    nodes[next]?.focus();
  };

  const choose = (item) => {
    setOpen(false);
    item.onClick?.();
  };

  return (
    <div className="fw-menu-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${triggerClassName} ${open ? 'is-open' : ''}`}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {triggerContent || <Icon size={18} aria-hidden="true" />}
      </button>

      {open && (
        <>
          <div className="fw-menu-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            id={menuId}
            ref={listRef}
            className={`fw-menu fw-menu-${align}`}
            role="menu"
            aria-label={title || label}
            onKeyDown={onListKeyDown}
          >
            <div className="fw-menu-handle" aria-hidden="true" />
            {title && <div className="fw-menu-title">{title}</div>}
            {visibleItems.map((item, index) => {
              if (item.divider) return <div key={`d${index}`} className="fw-menu-divider" role="separator" />;
              if (item.heading) return <div key={`h${index}`} className="fw-menu-heading">{item.heading}</div>;
              const ItemIcon = item.icon;
              return (
                <button
                  key={item.key || item.label}
                  type="button"
                  role="menuitem"
                  className={`fw-menu-item ${item.danger ? 'danger' : ''} ${item.active ? 'active' : ''}`}
                  onClick={() => choose(item)}
                >
                  {ItemIcon && <ItemIcon size={17} aria-hidden="true" />}
                  <span className="fw-menu-label">{item.label}</span>
                  {item.hint && <span className="fw-menu-hint">{item.hint}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ActionMenu;
