import Link from 'next/link';
import { Plus, FolderOpen, ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { session } from '@/lib/server';
import { Button } from '@/components/ui/button';
import { Notice, Status } from './shared';
import { dateLabel } from '@/lib/client';
export async function Dashboard() {
  const s = await session();
  let rows;
  try {
    rows = await db.case.findMany({
      where: s.role === 'supplier' ? { id: s.caseId ?? '__none__' } : {},
      include: { _count: { select: { reports: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  } catch {
    return (
      <Notice title="La base locale n’est pas disponible" error>
        Démarrez Docker Desktop puis exécutez npm run local:setup. Les dossiers sont conservés dans
        PostgreSQL.
      </Notice>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>Vos dossiers d’évaluation</h1>
          <p className="mt-2 text-muted-foreground">
            Retrouvez les demandes et poursuivez leur examen.
          </p>
        </div>
        {s.role !== 'supplier' ? (
          <Button asChild>
            <Link href="/cases/new">
              <Plus data-icon="inline-start" />
              Nouvelle évaluation
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="flex gap-10 border-y border-border py-5">
        <div>
          <p className="text-2xl font-bold">{rows.length}</p>
          <p className="text-xs text-muted-foreground">Dossiers enregistrés</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{rows.filter((c) => c.vendorSubmitted).length}</p>
          <p className="text-xs text-muted-foreground">Questionnaires fournisseur soumis</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{rows.reduce((n, c) => n + c._count.reports, 0)}</p>
          <p className="text-xs text-muted-foreground">Versions de rapport</p>
        </div>
      </div>
      {rows.length ? (
        <div className="panel table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dossier</th>
                <th>Finalité</th>
                <th>Avancement</th>
                <th>Mis à jour</th>
                <th>
                  <span className="sr-only">Ouvrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link
                      className="font-semibold hover:text-primary"
                      href={`/cases/${c.id}/${s.role === 'supplier' ? 'vendor' : 'need'}`}
                    >
                      {c.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.role === 'supplier' ? 'Fournisseur simulé' : c.department}
                    </p>
                  </td>
                  <td>{c.purpose}</td>
                  <td>
                    <Status>
                      {c.vendorSubmitted
                        ? 'Prêt pour examen'
                        : c.internalSubmitted
                          ? 'Fournisseur à compléter'
                          : 'Besoin à compléter'}
                    </Status>
                  </td>
                  <td className="text-muted-foreground">{dateLabel(c.updatedAt.toISOString())}</td>
                  <td>
                    <Link
                      aria-label={`Ouvrir ${c.title}`}
                      href={`/cases/${c.id}/${s.role === 'supplier' ? 'vendor' : 'need'}`}
                    >
                      <ArrowRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel flex flex-col items-center gap-4 px-6 py-16 text-center">
          <FolderOpen size={36} className="text-primary" />
          <h2>
            {s.role === 'supplier' ? 'Aucun dossier lié' : 'Votre premier dossier commence ici'}
          </h2>
          <p className="max-w-md text-muted-foreground">
            {s.role === 'supplier'
              ? 'Ouvrez un dossier comme demandeur, puis choisissez le rôle fournisseur pour le lier à cette simulation.'
              : 'Décrivez un usage d’IA pour obtenir les questions et les contrôles adaptés.'}
          </p>
          {s.role !== 'supplier' ? (
            <Button asChild>
              <Link href="/cases/new">Créer un dossier</Link>
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
