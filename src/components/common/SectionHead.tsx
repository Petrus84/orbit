import React from 'react';

interface SectionHeadProps {
  title: string;
  subtitle?: string;
}

export default function SectionHead({ title, subtitle }: SectionHeadProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <h1 className="font-sans text-xl font-semibold tracking-tight text-white">
        {title}
      </h1>
      {subtitle && (
        <p className="font-sans text-sm text-zinc-400">{subtitle}</p>
      )}
    </div>
  );
}
