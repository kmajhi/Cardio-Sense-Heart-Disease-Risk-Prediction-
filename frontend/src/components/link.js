// Works with a plain <a> (href) and with react-router's <Link> (to).
export const linkProps = (LinkComponent, to) =>
  LinkComponent === 'a' ? { href: to } : { to };
