import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { sources } from '@/config/assessment';
export function Notice({
  title,
  children,
  error = false,
}: {
  title: string;
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <Alert variant={error ? 'destructive' : 'default'}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
export function Status({ children }: { children: React.ReactNode }) {
  return <Badge variant="secondary">{children}</Badge>;
}
export function SourceLink({ id }: { id: string }) {
  const source = sources.find((s) => s.id === id);
  if (!source) return null;
  return source.url ? (
    <a className="link text-xs" href={source.url} target="_blank" rel="noreferrer">
      {source.title} ↗
    </a>
  ) : (
    <span className="text-xs text-muted-foreground">{source.title}</span>
  );
}
