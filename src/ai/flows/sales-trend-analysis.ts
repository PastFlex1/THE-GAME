'use server';
/**
 * @fileOverview Un flujo de Genkit para analizar datos de ventas e identificar tendencias.
 *
 * - salesTrendAnalysis - Función que maneja el proceso de análisis de tendencias.
 * - SalesTrendAnalysisInput - El tipo de entrada para la función salesTrendAnalysis.
 * - SalesTrendAnalysisOutput - El tipo de retorno para la función salesTrendAnalysis.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SalesDataPointSchema = z.object({
  branchName: z.string().describe('El nombre de la sucursal.'),
  date: z.string().describe('La fecha de la venta en formato YYYY-MM-DD.'),
  amount: z.number().describe('El monto de la venta para esa fecha y sucursal.'),
});

const SalesTrendAnalysisInputSchema = z.object({
  salesData: z
    .array(SalesDataPointSchema)
    .describe('Un arreglo de puntos de datos de ventas en diferentes sucursales y fechas.'),
});
export type SalesTrendAnalysisInput = z.infer<typeof SalesTrendAnalysisInputSchema>;

const SalesTrendAnalysisOutputSchema = z.object({
  summary: z
    .string()
    .describe('Un resumen conciso del desempeño general de ventas reciente en todas las sucursales en español.'),
  trends: z
    .array(z.string())
    .describe('Una lista de tendencias de ventas significativas identificadas en los datos, redactadas en español.'),
});
export type SalesTrendAnalysisOutput = z.infer<typeof SalesTrendAnalysisOutputSchema>;

export async function salesTrendAnalysis(
  input: SalesTrendAnalysisInput
): Promise<SalesTrendAnalysisOutput> {
  return salesTrendAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'salesTrendAnalysisPrompt',
  input: {schema: SalesTrendAnalysisInputSchema},
  output: {schema: SalesTrendAnalysisOutputSchema},
  prompt: `Eres un asistente analista de ventas impulsado por IA.
Tu tarea es analizar los datos de ventas proporcionados, resumir el desempeño reciente en todas las sucursales e identificar tendencias de ventas significativas.

IMPORTANTE: Toda tu respuesta debe estar en ESPAÑOL.

Datos de Ventas:
{{#each salesData}}
Sucursal: {{{branchName}}}, Fecha: {{{date}}}, Monto: {{{amount}}}
{{/each}}

Proporciona un resumen ejecutivo conciso del desempeño y destaca las tendencias clave. Si no hay tendencias significativas, indícalo.`,
});

const salesTrendAnalysisFlow = ai.defineFlow(
  {
    name: 'salesTrendAnalysisFlow',
    inputSchema: SalesTrendAnalysisInputSchema,
    outputSchema: SalesTrendAnalysisOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
