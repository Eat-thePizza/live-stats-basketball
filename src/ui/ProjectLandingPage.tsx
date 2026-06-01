import authorPhotoUrl from "@/assets/ethan-v3.png";
import styles from "./ProjectLandingPage.module.css";

const STATS_URL = "https://ethanliu.ccwu.cc";
const GITHUB_URL = "https://github.com/Eat-thePizza/live-stats-basketball";

function BasketballIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3v18" />
      <path d="M5.6 5.6c2.4 2.4 3.7 5.7 3.7 9.1 0 1.6-.3 3.1-.8 4.5" />
      <path d="M18.4 5.6c-2.4 2.4-3.7 5.7-3.7 9.1 0 1.6.3 3.1.8 4.5" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.69.08-.69 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.55C20.22 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

interface CardProps {
  href?: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}

function Card({ href, title, description, icon, comingSoon }: CardProps) {
  const inner = (
    <>
      <div className={styles.cardIcon}>{icon}</div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardDesc}>{description}</p>
      </div>
      {comingSoon && <span className={styles.badge}>Coming Soon</span>}
    </>
  );
  if (href) {
    return (
      <a className={styles.card} href={href}>
        {inner}
      </a>
    );
  }
  return (
    <article
      className={`${styles.card} ${styles.cardDisabled}`}
      aria-disabled="true"
    >
      {inner}
    </article>
  );
}

export default function ProjectLandingPage() {
  return (
    <div className={styles.root}>
      <header className={styles.hero}>
        <img
          className={styles.photo}
          src={authorPhotoUrl}
          alt="Ethan Liu"
        />
        <div className={styles.heroText}>
          <h1 className={styles.title}>
            Live Basketball Stat &amp; Analysis
          </h1>
          <p className={styles.byline}>Built by Ethan Liu</p>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="why">
        <h2 id="why">Why this project exists</h2>
        <p>
          I'm the assistant coach of the Saint Francis boys varsity
          basketball team. The gap between a game ending and the data
          being usable is huge — pure manual logging produces no video,
          and full automated analytics arrive a day late. I wanted
          something a single person can run from the bench laptop that
          produces useful numbers immediately and richer video-backed
          analysis within a short turnaround.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="core-idea">
        <h2 id="core-idea">Core idea</h2>
        <p>
          Stop trying to make the computer understand basketball from
          scratch. A scorekeeper at the bench already understands the
          game — if they type one short command per event, the computer
          gets a clean, time-stamped semantic timeline for free. That
          timeline drives both the live stats and the targeted video
          analysis, so CV only has to look at the seconds that actually
          matter.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="building">
        <h2 id="building">What I am building</h2>
        <p>
          A live game logger (web + Python CLI), a video pipeline that
          slices clips around shot events and runs open-source detectors
          on them, and a unified UI that ties everything back to the
          original logged play. I'm building it incrementally as a high
          school project — the goal is a tool I'd actually want to use
          at my own school's games.
        </p>
      </section>

      <section className={styles.entries} aria-label="Project entries">
        <Card
          href={STATS_URL}
          title="Live Basketball Stats"
          description="Track games live and export stats."
          icon={<BasketballIcon />}
        />
        <Card
          href={GITHUB_URL}
          title="GitHub"
          description="View the source code and implementation."
          icon={<GitHubIcon />}
        />
        <Card
          title="YouTube Demo"
          description="Demo video (upcoming)."
          icon={<PlayIcon />}
          comingSoon
        />
      </section>

      <footer className={styles.footer}>
        <p>© Ethan Liu</p>
      </footer>
    </div>
  );
}
