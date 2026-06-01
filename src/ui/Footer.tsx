import styles from "./Footer.module.css";
import ethanUrl from "@/assets/ethan-v3.png";

// Relative link to the Project Information page on the same host.
// The hash route `#/project` is matched inside MainApp (src/ui/App.tsx)
// and renders ProjectLandingPage regardless of host.
// See matchProjectRoute() in src/ui/useHashRoute.ts.
const PROJECT_DETAILS_URL = "#/project";

function ProjectInfoIcon() {
  // Document with sparkle: "more about this project" — reads as
  // "details / story / extra info" rather than a generic ⓘ.
  return (
    <svg
      className={styles.infoIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Document outline */}
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      {/* Folded corner */}
      <path d="M14 3v5h5" />
      {/* Body lines */}
      <line x1="8" y1="13" x2="14" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
      {/* Sparkle */}
      <path
        d="M17.5 11.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className={styles.root}>
      <img className={styles.portrait} src={ethanUrl} alt="Ethan Liu" />
      <span className={styles.text}>Built by Ethan Liu</span>
      <a
        className={styles.link}
        href={PROJECT_DETAILS_URL}
        title="Open the project information page"
      >
        <ProjectInfoIcon />
        <span className={styles.linkLabel}>Project Information</span>
      </a>
    </footer>
  );
}
