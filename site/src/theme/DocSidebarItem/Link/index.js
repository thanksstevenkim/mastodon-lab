import React from 'react';
import OriginalLink from '@theme-original/DocSidebarItem/Link';

// Preserve the stock link, active state, and mobile sidebar dismissal.
// Only the visual label of incident items is augmented.
export default function DocSidebarItemLink(props) {
  const {item} = props;
  const ticketId = item.customProps?.ticketId;
  if (!ticketId) return <OriginalLink {...props} />;
  const label = (
    <span className="lab-sidebar-incident">
      <span className="lab-sidebar-ticket">{ticketId}</span>
      <span className="lab-sidebar-title">{item.label}</span>
    </span>
  );
  return <OriginalLink {...props} item={{...item, label}} />;
}
