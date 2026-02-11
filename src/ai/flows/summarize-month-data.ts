'use server';
/**
 * @fileOverview This file defines a Genkit flow for summarizing month data, including totals, differences, and exception counts.
 *
 * - summarizeMonthData - A function that takes monthCloseId and tenantId as input and returns a summary of the month's financial health.
 * - SummarizeMonthDataInput - The input type for the summarizeMonthData function.
 * - SummarizeMonthDataOutput - The return type for the summarizeMonthData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeMonthDataInputSchema = z.object({
  monthCloseId: z.string().describe('The ID of the month close.'),
  tenantId: z.string().describe('The ID of the tenant.'),
});
export type SummarizeMonthDataInput = z.infer<typeof SummarizeMonthDataInputSchema>;

const SummarizeMonthDataOutputSchema = z.object({
  summary: z.string().describe('A summary of the month\'s financial health.'),
});
export type SummarizeMonthDataOutput = z.infer<typeof SummarizeMonthDataOutputSchema>;

export async function summarizeMonthData(input: SummarizeMonthDataInput): Promise<SummarizeMonthDataOutput> {
  return summarizeMonthDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeMonthDataPrompt',
  input: {schema: SummarizeMonthDataInputSchema},
  output: {schema: SummarizeMonthDataOutputSchema},
  prompt: `You are an expert financial analyst.

  Given the following month close ID: {{{monthCloseId}}} and tenant ID: {{{tenantId}}}, generate a concise summary of the month\'s financial health, including totals, differences, and exception counts by type.
  Focus on providing key insights and potential areas of concern.
  Return the summary in a readable format.
  `,
});

const summarizeMonthDataFlow = ai.defineFlow(
  {
    name: 'summarizeMonthDataFlow',
    inputSchema: SummarizeMonthDataInputSchema,
    outputSchema: SummarizeMonthDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
