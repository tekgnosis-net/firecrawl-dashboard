// src/components/metrics/CreditsTokensCard.jsx
import { useStore } from '../../store';
import { formatUnlimited } from '../../lib/format';
import { format as formatDate, parseISO } from 'date-fns';

function isUnlimited(n) {
  return n !== null && n !== undefined && Number(n) >= 1e8;
}

function ProgressRow({ label, remaining, total, fillColor }) {
  const unlimited = isUnlimited(total);
  const pct = unlimited || !total ? null : Math.max(0, Math.min(1, remaining / total));

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ fontSize: 13, color: 'var(--apple-text-secondary)' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {unlimited
            ? 'Unlimited'
            : `${formatUnlimited(remaining)} / ${formatUnlimited(total)}`}
        </div>
      </div>
      {!unlimited && pct !== null && (
        <div style={{ height: 4, background: 'var(--apple-separator)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${pct * 100}%`, height: '100%', background: fillColor, transition: 'width 0.3s ease' }} />
        </div>
      )}
    </div>
  );
}

function formatBillingRange(start, end) {
  try {
    const s = formatDate(parseISO(start), 'MMM d');
    const e = formatDate(parseISO(end), 'MMM d, yyyy');
    return `${s} \u2192 ${e}`;
  } catch (_) {
    return null;
  }
}

function UnavailableRow({ label }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ fontSize: 13, color: 'var(--apple-text-secondary)' }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--apple-text-tertiary, var(--apple-text-secondary))' }}>
          Not available
        </div>
      </div>
    </div>
  );
}

export function CreditsTokensCard() {
  const credit = useStore(s => s.serverMetrics.creditUsage);
  const token = useStore(s => s.serverMetrics.tokenUsage);
  const creditReason = useStore(s => s.serverMetrics.creditUsageReason);
  const tokenReason = useStore(s => s.serverMetrics.tokenUsageReason);

  const billingRange = credit?.billing_period_start && credit?.billing_period_end
    ? formatBillingRange(credit.billing_period_start, credit.billing_period_end)
    : null;

  const bothUnavailable = creditReason && tokenReason;

  return (
    <div className="apple-card">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Credits &amp; tokens</h3>
      <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginBottom: 16 }}>
        /v1/team/credit-usage · /v1/team/token-usage
      </div>
      {creditReason ? (
        <UnavailableRow label="Credits" />
      ) : (
        <ProgressRow
          label="Credits"
          remaining={credit?.remaining_credits}
          total={credit?.plan_credits}
          fillColor="var(--apple-blue)"
        />
      )}
      {tokenReason ? (
        <UnavailableRow label="Tokens" />
      ) : (
        <ProgressRow
          label="Tokens"
          remaining={token?.remaining_tokens}
          total={token?.plan_tokens}
          fillColor="var(--apple-green)"
        />
      )}
      {billingRange && (
        <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginTop: 8 }}>
          Billing period: {billingRange}
        </div>
      )}
      {bothUnavailable && (
        <div style={{ fontSize: 11, color: 'var(--apple-text-secondary)', marginTop: 8 }}>
          These endpoints require Firecrawl's billing integration; not available on this self-hosted deployment.
        </div>
      )}
    </div>
  );
}
