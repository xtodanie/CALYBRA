/**
 * ZEREBROX CALYBRA OS - Intent Classifier Tests
 * Tests for ambiguity handling, malformed inputs, and context fallback
 */

import {
  IntentClassifier,
  IntentCategory,
  IntentInput,
  IntentContext,
  createIntentClassifier,
} from '../../src/lib/autopilot/intentClassifier';

describe('IntentClassifier', () => {
  let classifier: IntentClassifier;
  let baseContext: IntentContext;

  beforeEach(() => {
    classifier = createIntentClassifier();
    baseContext = {
      tenantId: 'tenant-123',
      userId: 'user-456',
    };
  });

  describe('Malformed Input Detection', () => {
    test('should detect empty input as MALFORMED_INPUT', () => {
      const input: IntentInput = { text: '' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.MALFORMED_INPUT);
      expect(result.confidence).toBe(100);
      expect(result.contextUsed).toBe(false);
    });

    test('should detect gibberish (special chars only) as MALFORMED_INPUT', () => {
      const input: IntentInput = { text: '!@#$%^&*()_+' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.MALFORMED_INPUT);
      expect(result.confidence).toBeGreaterThanOrEqual(95);
      expect(result.contextUsed).toBe(false);
    });

    test('should detect "why_" as MALFORMED_INPUT', () => {
      const input: IntentInput = { text: 'why_' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.MALFORMED_INPUT);
      expect(result.confidence).toBeGreaterThanOrEqual(95);
      expect(result.reasoning).toContain('special characters');
    });

    test('should detect number-only input as MALFORMED_INPUT', () => {
      const input: IntentInput = { text: '12345' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.MALFORMED_INPUT);
      expect(result.confidence).toBeGreaterThanOrEqual(95);
    });
  });

  describe('Clarification Required Detection', () => {
    test('should detect questions as CLARIFICATION_REQUIRED', () => {
      const input: IntentInput = { text: 'What should I do next?' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.CLARIFICATION_REQUIRED);
      expect(result.confidence).toBeGreaterThanOrEqual(85);
      expect(result.suggestedAction).toContain('PLAN_MODE');
    });

    test('should detect "why" questions as CLARIFICATION_REQUIRED', () => {
      const input: IntentInput = { text: 'Why did this happen?' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.CLARIFICATION_REQUIRED);
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });

    test('should detect help requests as CLARIFICATION_REQUIRED', () => {
      const input: IntentInput = { text: 'I need help with this' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.CLARIFICATION_REQUIRED);
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });
  });

  describe('Execution Request Detection', () => {
    test('should detect execution commands', () => {
      const input: IntentInput = { text: 'Execute the reconciliation process' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.EXECUTION_REQUEST);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.suggestedAction).toContain('mode');
    });

    test('should detect match command', () => {
      const input: IntentInput = { text: 'Match bank transactions with invoices' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.EXECUTION_REQUEST);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    test('should detect upload command', () => {
      const input: IntentInput = { text: 'Upload the CSV file' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.EXECUTION_REQUEST);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    test('should detect confirm/approve commands', () => {
      const input: IntentInput = { text: 'Confirm all proposed matches' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.EXECUTION_REQUEST);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });
  });

  describe('Strategic Directive Detection', () => {
    test('should detect planning directives', () => {
      const input: IntentInput = { text: 'Plan the implementation strategy' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.STRATEGIC_DIRECTIVE);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.suggestedAction).toContain('PLAN_MODE');
    });

    test('should detect design directives', () => {
      const input: IntentInput = { text: 'Design the autopilot architecture' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.STRATEGIC_DIRECTIVE);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    test('should detect implementation directives', () => {
      const input: IntentInput = { text: 'Implement the core modules' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.STRATEGIC_DIRECTIVE);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    test('should detect configuration directives', () => {
      const input: IntentInput = { text: 'Configure the system settings' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.STRATEGIC_DIRECTIVE);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });
  });

  describe('Context Fallback Logic', () => {
    test('should use context when input is ambiguous but context exists', () => {
      const contextWithMonthClose: IntentContext = {
        ...baseContext,
        monthCloseId: 'month-789',
      };
      const input: IntentInput = { text: 'proceed' };
      const result = classifier.classify(input, contextWithMonthClose);

      expect(result.contextUsed).toBe(true);
      expect(result.confidence).toBeLessThan(70); // Lower confidence when using context
      expect(result.category).not.toBe(IntentCategory.MALFORMED_INPUT);
    });

    test('should infer execution from previous execution context', () => {
      const contextWithPrevious: IntentContext = {
        ...baseContext,
        previousIntent: IntentCategory.EXECUTION_REQUEST,
      };
      const input: IntentInput = { text: 'continue' };
      const result = classifier.classify(input, contextWithPrevious);

      expect(result.category).toBe(IntentCategory.EXECUTION_REQUEST);
      expect(result.contextUsed).toBe(true);
    });

    test('should default to strategic when monthClose is active', () => {
      const contextWithMonthClose: IntentContext = {
        ...baseContext,
        monthCloseId: 'month-789',
      };
      const input: IntentInput = { text: 'next step' };
      const result = classifier.classify(input, contextWithMonthClose);

      expect(result.category).toBe(IntentCategory.STRATEGIC_DIRECTIVE);
      expect(result.contextUsed).toBe(true);
    });

    test('should use session metadata for context inference', () => {
      const contextWithMetadata: IntentContext = {
        ...baseContext,
        sessionMetadata: { lastAction: 'upload', phase: 'processing' },
      };
      const input: IntentInput = { text: 'ok' };
      const result = classifier.classify(input, contextWithMetadata);

      expect(result.contextUsed).toBe(true);
      expect(result.category).not.toBe(IntentCategory.MALFORMED_INPUT);
    });
  });

  describe('No Actionable Signal', () => {
    test('should default to NO_ACTIONABLE_SIGNAL for unclear input without context', () => {
      const input: IntentInput = { text: 'hmm' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.NO_ACTIONABLE_SIGNAL);
      expect(result.confidence).toBeLessThanOrEqual(50);
      expect(result.suggestedAction).toContain('Log anomaly');
    });

    test('should not freeze system on ambiguous input', () => {
      const input: IntentInput = { text: 'interesting' };
      const result = classifier.classify(input, baseContext);

      // System should continue, not freeze
      expect(result.category).toBe(IntentCategory.NO_ACTIONABLE_SIGNAL);
      expect(result.suggestedAction).toContain('continue monitoring');
    });
  });

  describe('Validation', () => {
    test('should validate correct classification results', () => {
      const input: IntentInput = { text: 'Execute now' };
      const result = classifier.classify(input, baseContext);

      expect(classifier.validate(result)).toBe(true);
    });

    test('should validate confidence bounds', () => {
      const input: IntentInput = { text: 'Upload file' };
      const result = classifier.classify(input, baseContext);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    test('should have reasoning for all classifications', () => {
      const inputs = [
        { text: '' },
        { text: 'Execute' },
        { text: 'What?' },
        { text: 'Plan this' },
        { text: 'hmm' },
      ];

      inputs.forEach(input => {
        const result = classifier.classify(input, baseContext);
        expect(result.reasoning.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Ambiguity Stress Tests', () => {
    test('should handle very ambiguous input gracefully', () => {
      const ambiguousInputs = [
        'abc',
        'test',
        'thing',
        'stuff',
        'do it',
        'go',
        'yes',
        'no',
      ];

      ambiguousInputs.forEach(text => {
        const input: IntentInput = { text };
        const result = classifier.classify(input, baseContext);

        // Should not crash and should produce valid result
        expect(classifier.validate(result)).toBe(true);
        expect(result.category).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
      });
    });

    test('should handle mixed-case and spacing', () => {
      const input1: IntentInput = { text: '  ExEcUtE   NoW  ' };
      const result1 = classifier.classify(input1, baseContext);

      expect(result1.category).toBe(IntentCategory.EXECUTION_REQUEST);
    });

    test('should handle unicode and special characters in valid text', () => {
      const input: IntentInput = { text: 'Execute payment → supplier #123' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.EXECUTION_REQUEST);
    });
  });

  describe('Deterministic Behavior', () => {
    test('should produce same result for same input', () => {
      const input: IntentInput = { text: 'Execute reconciliation' };
      
      const result1 = classifier.classify(input, baseContext);
      const result2 = classifier.classify(input, baseContext);

      expect(result1.category).toBe(result2.category);
      expect(result1.confidence).toBe(result2.confidence);
      expect(result1.reasoning).toBe(result2.reasoning);
    });

    test('should not depend on LLM for core classification', () => {
      // All tests should pass without any external API calls
      const input: IntentInput = { text: 'Run the matching engine' };
      const result = classifier.classify(input, baseContext);

      expect(result.category).toBe(IntentCategory.EXECUTION_REQUEST);
      // If this passes without network calls, classification is deterministic
    });
  });
});
