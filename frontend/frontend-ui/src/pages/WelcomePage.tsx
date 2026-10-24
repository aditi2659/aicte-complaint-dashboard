
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  Network,
  ShieldCheck,
  GitMerge,
  Clock3,
} from 'lucide-react';
import { InteractivePixelNetwork } from '../components/welcome/InteractivePixelNetwork';

const features = [
  {
    number: '01',
    icon: Network,
    title: 'One institution. One view.',
    shortTitle: 'Unified institution profiles',
    description:
      'Bring institution profiles and related complaints together across bureaus and cells.',
    detail:
      'View an institution as a single profile, with its AICTE Permanent ID, related complaints, assigned owners and case history in one place.',
    color: 'text-[#FF69B4]',
  },
  {
    number: '02',
    icon: GitMerge,
    title: 'See the connections.',
    shortTitle: 'Potential-overlap detection',
    description:
      'Surface potentially overlapping cases for human review before any action is taken.',
    detail:
      'Identify cases that may concern the same institution or issue across different bureaus. Review the suggested relationship before deciding whether any action is appropriate.',
    color: 'text-[#C4F279]',
  },
  {
    number: '03',
    icon: Clock3,
    title: 'Follow every case.',
    shortTitle: 'Case status and timelines',
    description:
      'Track ownership, status changes, timelines and progress from a central workspace.',
    detail:
      'Follow case status, assigned responsibility and recorded updates through a central monitoring workflow, making progress easier to understand.',
    color: 'text-[#FF8BCB]',
  },
];

export function WelcomePage() {
  return (
    <main className="min-h-screen bg-[#000000] text-[#F5F5F5]">
      {/* HERO: the animated canvas stays confined to this section */}
      <div className="relative overflow-hidden bg-black">
        <div className="pointer-events-none absolute inset-0">
          <InteractivePixelNetwork />
        </div>

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 38%, rgba(255,105,180,0.07), transparent 48%), radial-gradient(ellipse at 82% 65%, rgba(196,242,121,0.035), transparent 36%)',
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-12">
          <header className="flex h-20 items-center justify-between border-b border-[#292929]">
            <Link to="/welcome" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-[#FF69B4]/50 bg-[#FF69B4]/10">
                <Network size={21} className="text-[#FF69B4]" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide">
                  AICTE <span className="text-[#FF69B4]">/</span> IICMD
                </p>
                <p className="mt-0.5 text-[10px] tracking-[0.2em] text-[#B5B5B5]">
                  CASE MONITORING SYSTEM
                </p>
              </div>
            </Link>

            <div className="hidden items-center gap-2 text-xs text-[#B5B5B5] sm:flex">
              <span className="h-2 w-2 bg-[#FF69B4]" />
              INTEGRATED WORKSPACE
            </div>
          </header>

          <section className="relative flex min-h-[570px] flex-col justify-center py-20 md:min-h-[620px]">
            <div className="mb-8 flex items-center gap-3">
              <span className="h-px w-8 bg-[#FF69B4]" />
              <p className="text-xs font-medium tracking-[0.24em] text-[#FF8BCB]">
                CONNECTING THE BIGGER PICTURE
              </p>
            </div>

            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-6xl md:text-8xl">
              Every case.
              <br />
              <span className="text-[#C4F279]">One connected</span>
              <br />
              view.
            </h1>

            <p className="mt-8 max-w-xl text-base leading-7 text-[#B5B5B5] md:text-lg">
              A unified workspace to monitor institution-related complaints,
              discover potential overlaps across bureaus, and follow every case
              through its journey.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-5">
              <Link
                to="/"
                className="group inline-flex items-center gap-3 bg-[#C4F279] px-6 py-4 text-sm font-semibold text-black transition hover:bg-[#D5FFA0]"
              >
                Enter the dashboard
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>

              <a
                href="#how-it-connects"
                className="inline-flex items-center gap-2 text-sm text-[#FF8BCB] transition hover:text-[#FF69B4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF69B4] focus-visible:outline-offset-4"
              >
                Explore the system
                <ArrowDownRight size={16} />
              </a>
            </div>
          </section>
        </div>

        <div className="absolute bottom-0 left-0 z-10 h-px w-full bg-gradient-to-r from-transparent via-[#FF69B4]/50 to-transparent" />
      </div>

      {/* FEATURES: solid black, no canvas */}
      <div id="how-it-connects" className="relative z-20 scroll-mt-8 bg-black">
        <div className="mx-auto max-w-7xl px-6 md:px-12">
          <section className="py-20 md:py-28">
            <div className="mb-12 grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-end">
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <span className="h-px w-8 bg-[#FF69B4]" />
                  <p className="text-xs font-semibold tracking-[0.24em] text-[#FF69B4]">
                    THE SYSTEM
                  </p>
                </div>

                <h2 className="text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl md:text-5xl">
                  From scattered cases
                  <br className="hidden sm:block" />
                  <span className="text-[#C4F279]">
                    {' '}to connected intelligence.
                  </span>
                </h2>
              </div>
              <p className="max-w-md text-sm leading-7 text-[#A8A8A8] md:justify-self-end">
                Designed to give administrators a clearer picture of cases,
                institutions and cross-bureau activity.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                const accent =
                  feature.number === '01'
                    ? '#FF69B4'
                    : feature.number === '02'
                      ? '#C4F279'
                      : '#FF8BCB';

                return (
                  <article
                    key={feature.number}
                    className="group relative flex min-h-[270px] flex-col overflow-hidden border border-[#292929] bg-[#050505] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#FF69B4]/60 sm:p-7"
                  >
                    <span
                      className="absolute left-0 top-0 h-[2px] w-0 transition-all duration-300 group-hover:w-full"
                      style={{ backgroundColor: accent }}
                    />

                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs tracking-wider text-[#777777]">
                        / {feature.number}
                      </span>
                      <Icon
                        size={22}
                        strokeWidth={1.5}
                        style={{ color: accent }}
                      />
                    </div>

                    <h3 className="mt-12 text-xl font-medium tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[#A8A8A8]">
                      {feature.description}
                    </p>

                    <div className="mt-auto flex items-center gap-3 pt-8">
                      <span
                        className="h-px w-7"
                        style={{ backgroundColor: accent }}
                      />
                      <span className="text-[10px] tracking-[0.16em] text-[#777777]">
                        CAPABILITY {feature.number}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <footer className="flex flex-col justify-between gap-3 border-t border-[#292929] py-6 text-xs text-[#888888] sm:flex-row">
            <span className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-[#FF69B4]" />
              Prototype workspace · Illustrative sample data
            </span>
            <span>AICTE Integrated Institution Complaint Monitoring</span>
          </footer>
        </div>
      </div>

    </main>
  );
}
