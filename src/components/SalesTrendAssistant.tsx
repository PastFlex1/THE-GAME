"use client";

import React, { useState } from 'react';
import { Sparkles, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { salesTrendAnalysis, SalesTrendAnalysisOutput } from '@/ai/flows/sales-trend-analysis';
import { MOCK_INVOICES, MOCK_BRANCHES } from '@/lib/mock-data';

export function SalesTrendAssistant() {
  const [analysis, setAnalysis] = useState<SalesTrendAnalysisOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      // Mapear datos mock al esquema esperado por el flujo
      const salesData = MOCK_INVOICES.map(inv => ({
        branchName: MOCK_BRANCHES.find(b => b.id === inv.branchId)?.name || 'Desconocida',
        date: inv.date,
        amount: inv.total
      }));

      const result = await salesTrendAnalysis({ salesData });
      setAnalysis(result);
    } catch (err) {
      console.error(err);
      setError('Error al analizar los datos de ventas. Inténtelo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Asistente de Ventas IA</CardTitle>
              <CardDescription>Analice el desempeño de las sucursales e identifique tendencias</CardDescription>
            </div>
          </div>
          <Button 
            onClick={runAnalysis} 
            disabled={loading}
            className="bg-accent hover:bg-accent/90 text-white border-none shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analizando...
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4 mr-2" />
                Generar Tendencias
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analysis && !loading && !error && (
          <div className="text-center py-6 text-muted-foreground italic">
            Haga clic en el botón para obtener un resumen impulsado por IA de su desempeño de ventas reciente.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive p-3 bg-destructive/10 rounded-md">
            <AlertCircle className="w-4 h-4" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="p-4 bg-white rounded-lg border border-primary/10">
              <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                Resumen Ejecutivo
              </h4>
              <p className="text-sm leading-relaxed text-foreground/80">
                {analysis.summary}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.trends.map((trend, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-accent/10 rounded-lg border border-accent/20">
                  <div className="mt-1">
                    <TrendingUp className="w-4 h-4 text-accent" />
                  </div>
                  <p className="text-xs font-medium">{trend}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
