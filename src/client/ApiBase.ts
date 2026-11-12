import { ClientEnv } from "./ClientEnv";

// The account/shop API origin (api.<audience>). Lives apart from Api.ts so
// modules that Api.ts itself depends on (ServerList) can reach it without an
// import cycle; Api.ts re-exports both for its existing importers.

export function getApiBase() {
  // Self-hosted: there is no account API. "invalid" is a reserved TLD, so
  // leftover requests fail at DNS straight away instead of reaching for
  // http://localhost:8787 (which, on a friend's machine opening a tunnel
  // link, would trip the browser's local-network permission prompt).
  if (ClientEnv.selfHosted()) {
    return localStorage.getItem("apiHost") ?? "https://api.invalid";
  }
  const domainname = getAudience();

  if (domainname === "localhost") {
    const apiDomain = process.env.API_DOMAIN;
    if (apiDomain) {
      return `https://${apiDomain}`;
    }
    return localStorage.getItem("apiHost") ?? "http://localhost:8787";
  }

  return `https://api.${domainname}`;
}

export function getAudience() {
  // Sourced from BOOTSTRAP_CONFIG (server/desktop-injected) rather than
  // window.location, so the desktop app (app://openfront) targets real infra.
  return ClientEnv.jwtAudience();
}
