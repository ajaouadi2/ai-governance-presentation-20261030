'use client';
import { Localized } from '@/components/language';

import Link from 'next/link';
import Image from 'next/image';
import { LanguageSwitcher } from './language';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { DraftContext } from './draft-guard';
import { BookOpen, FolderOpen, LayoutDashboard, ArrowUpRight, UserRound } from 'lucide-react';
import { api } from '@/lib/client';
import { roleLabels, type Role } from '@/lib/domain';
import { cn } from '@/lib/utils';
export function Shell({ role, children }: { role: Role; children: React.ReactNode }) {
  const pathname = usePathname();
  const questionnaireV2 =
    !pathname.startsWith('/cases/') &&
    !pathname.startsWith('/reports/') &&
    !pathname.startsWith('/archives/legacy');
  const router = useRouter();
  const draftRef = useRef<(() => Promise<boolean>) | null>(null);
  const register = useCallback((fn: (() => Promise<boolean>) | null) => {
    draftRef.current = fn;
  }, []);
  const flushDraft = useCallback(async () => (draftRef.current ? draftRef.current() : true), []);
  const guard = useMemo(() => ({ register, flush: flushDraft }), [register, flushDraft]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const caseId = pathname.match(/^\/cases\/([^/]+)/)?.[1];
  async function switchRole(next: Role) {
    if (!(await flushDraft())) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/role', {
        method: 'POST',
        body: JSON.stringify({
          role: next,
          caseId: caseId && caseId !== 'new' ? caseId : undefined,
        }),
      });
      window.location.assign(
        next === 'supplier' && caseId && caseId !== 'new'
          ? `/cases/${caseId}/vendor`
          : (pathname.startsWith('/reports') || pathname.startsWith('/checklist')) &&
              next === 'supplier'
            ? '/dashboard'
            : pathname,
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Localized>
      {
        <DraftContext.Provider value={guard}>
          <div
            onClickCapture={async (e) => {
              if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0)
                return;
              const target = (e.target as Element).closest('a');
              if (!target || target.target === '_blank' || target.hasAttribute('download')) return;
              const url = new URL(target.href);
              if (url.origin !== window.location.origin || url.pathname.startsWith('/api/')) return;
              if (!draftRef.current) return;
              e.preventDefault();
              if (await flushDraft()) router.push(url.pathname + url.search + url.hash);
            }}
          >
            <aside className="university-sidebar no-print fixed inset-y-0 left-0 hidden w-[232px] flex-col px-5 py-8 md:flex">
              <Link
                href="/projects"
                className="university-logo"
                aria-label="Université de Lausanne — accueil des projets"
              >
                <Image
                  src="/branding/unil-logo-white.svg"
                  alt="Unil — Université de Lausanne"
                  width={143}
                  height={50}
                  priority
                />
              </Link>
              <div className="university-product">
                <span>Évaluation des outils d’IA</span>
              </div>
              <p className="university-nav-caption">ESPACE DE TRAVAIL</p>
              <nav aria-label="Navigation principale" className="flex flex-col gap-2">
                {[
                  { href: '/projects', label: 'Projets', icon: FolderOpen },
                  { href: '/guide', label: 'Guide du parcours', icon: BookOpen },
                  { href: '/archives', label: 'Archives', icon: LayoutDashboard },
                ].map((x) => (
                  <Link
                    key={x.href}
                    href={x.href}
                    className={cn(
                      'university-nav-link flex items-center gap-3 rounded-lg px-3 py-3 text-sm',
                      pathname.startsWith(x.href) ? 'is-active' : '',
                    )}
                  >
                    <x.icon size={18} />
                    {x.label}
                  </Link>
                ))}
              </nav>
              <div className="university-sidebar-footer mt-auto pt-5 text-xs">
                <p className="font-semibold">Prototype académique</p>
                <p className="mt-2">
                  Données fictives uniquement.
                  <br />
                  Aucun service officiel UNIL.
                </p>
              </div>
            </aside>
            <div className="app-main university-main md:ml-[232px]">
              <header className="university-topbar no-print flex min-h-18 items-center justify-between gap-4 border-b border-border px-5 md:px-9">
                <Link
                  href="/projects"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <span className="university-mobile-mark">
                    <Image src="/branding/unil-logo-white.svg" alt="Unil" width={62} height={22} />
                  </span>
                  <span className="font-semibold text-foreground">Espace d’évaluation</span>
                  <ArrowUpRight size={14} />
                </Link>
                <LanguageSwitcher />
                {questionnaireV2 && (
                  <span className="university-prototype">
                    <span />
                    Projet académique
                  </span>
                )}
                {!questionnaireV2 && (
                  <div className="flex items-center gap-2">
                    <UserRound size={16} className="text-muted-foreground" />
                    <label htmlFor="demo-role" className="sr-only">
                      Rôle simulé
                    </label>
                    <select
                      id="demo-role"
                      className="native-select"
                      value={role}
                      disabled={busy}
                      onChange={(e) => switchRole(e.target.value as Role)}
                    >
                      {Object.entries(roleLabels).map(([id, label]) => (
                        <option value={id} key={id}>
                          {label} · simulé
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </header>
              {error ? (
                <p role="alert" className="p-4 text-destructive">
                  {error}
                </p>
              ) : null}
              {questionnaireV2 ? (
                <nav
                  className="no-print border-b border-border px-5 py-3 text-sm md:hidden"
                  aria-label="Référence / Reference"
                >
                  <Link className="link mr-4" href="/projects">
                    Projets
                  </Link>
                  <Link className="link mr-4" href="/guide">
                    Guide
                  </Link>
                  <Link className="link" href="/archives">
                    Archives
                  </Link>
                </nav>
              ) : null}
              <main className="app-main university-content mx-auto max-w-[1560px] p-5 md:p-9">
                {children}
              </main>
            </div>
          </div>
        </DraftContext.Provider>
      }
    </Localized>
  );
}
