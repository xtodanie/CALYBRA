'use server';
/**
 * @fileOverview An invoice parsing AI agent that uses AI to extract data from invoices when the parsing confidence is low.
 *
 * - invoiceParsingWithAi - A function that handles the invoice parsing process.
 * - InvoiceParsingWithAiInput - The input type for the invoiceParsingWithAi function.
 * - InvoiceParsingWithAiOutput - The return type for the invoiceParsingWithAi function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const InvoiceParsingWithAiInputSchema = z.object({
  textSnippets: z.string().describe('Text snippets extracted from the invoice PDF.'),
  confidence: z.number().describe('The confidence level of the deterministic parsing (0-100).'),
});
export type InvoiceParsingWithAiInput = z.infer<typeof InvoiceParsingWithAiInputSchema>;

const InvoiceParsingWithAiOutputSchema = z.object({
  supplierName: z.string().optional().describe('The name of the supplier.'),
  invoiceNumber: z.string().optional().describe('The invoice number.'),
  issueDate: z.string().optional().describe('The issue date of the invoice.'),
  totalGross: z.string().optional().describe('The total gross amount of the invoice.'),
  reasoningBrief: z.string().optional().describe('Brief reasoning for the extracted information.'),
});
export type InvoiceParsingWithAiOutput = z.infer<typeof InvoiceParsingWithAiOutputSchema>;

export async function invoiceParsingWithAi(input: InvoiceParsingWithAiInput): Promise<InvoiceParsingWithAiOutput> {
  return invoiceParsingWithAiFlow(input);
}

const prompt = ai.definePrompt({
  name: 'invoiceParsingWithAiPrompt',
  input: {schema: InvoiceParsingWithAiInputSchema},
  output: {schema: InvoiceParsingWithAiOutputSchema},
  prompt: `Given the following text snippets extracted from an invoice PDF, extract the supplier name, invoice number, issue date, and total gross amount. Also, provide a brief reasoning for your extraction.
  Text Snippets: {{{textSnippets}}}
  
  Return a JSON object with the following schema:
  {
    supplierName: string,
    invoiceNumber: string,
    issueDate: string,
    totalGross: string,
    reasoningBrief: string
  }`,
});

const invoiceParsingWithAiFlow = ai.defineFlow(
  {
    name: 'invoiceParsingWithAiFlow',
    inputSchema: InvoiceParsingWithAiInputSchema,
    outputSchema: InvoiceParsingWithAiOutputSchema,
  },
  async input => {
    if (input.confidence >= 70) {
      return {}; // Skip AI parsing if confidence is high enough
    }

    try {
      const {output} = await prompt(input);
      return output!;
    } catch (error) {
      console.error('Error during AI parsing:', error);
      return {}; // Return empty object on error to avoid crashing the process
    }
  }
);
