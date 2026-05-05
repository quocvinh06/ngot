'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';

export function PdplConsentCheckbox({
  required = true,
  defaultChecked = false,
  name = 'consent',
  id = 'consent',
}: {
  required?: boolean;
  defaultChecked?: boolean;
  name?: string;
  id?: string;
}) {
  const t = useTranslations('customer');
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm cursor-pointer">
      <Checkbox id={id} name={name} required={required} defaultChecked={defaultChecked} className="mt-1" />
      <span className="text-muted-foreground leading-snug">{t('consent_label')}</span>
    </label>
  );
}
