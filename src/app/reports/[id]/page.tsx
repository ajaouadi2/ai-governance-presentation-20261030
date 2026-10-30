import Link from 'next/link';
import { db } from '@/lib/db';
import { session } from '@/lib/server';
import { notFound } from 'next/navigation';
import { ReportDocument } from '@/components/report';
import { PrintButton } from '@/components/print-button';
import { Notice } from '@/components/shared';
import type { ReportSnapshot } from '@/lib/domain';
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { role } = await session();
  if (role === 'supplier')
    return (
      <Notice title="Rapport interne">
        Le rapport n’est accessible qu’aux rôles demandeur et évaluateur.
      </Notice>
    );
  const { id } = await params;
  const report = await db.report.findUnique({ where: { id } });
  if (!report) notFound();
  return (
    <div className="flex flex-col gap-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <Link className="link" href={`/cases/${report.caseId}/report`}>
          ← Retour au dossier
        </Link>
        <PrintButton />
      </div>
      <ReportDocument
        snapshot={report.snapshot as unknown as ReportSnapshot}
        version={report.version}
      />
    </div>
  );
}
