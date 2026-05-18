
"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { InvoiceRideContent } from '@/components/InvoiceRideContent'; // Componente renombrado internamente o similar
import { InvoiceRideView } from '@/components/InvoiceRideView';

export default function RidePage() {
  const params = useParams();
  const invoiceId = params.id as string;

  return (
    <div className="min-h-screen bg-slate-100 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-5xl shadow-2xl">
        <InvoiceRideView invoiceId={invoiceId} />
      </div>
    </div>
  );
}
