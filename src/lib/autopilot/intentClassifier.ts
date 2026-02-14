/**
 * ZEREBROX CALYBRA OS - Intent Classifier
 * 
 * Purpose: Prevents ambiguity collapse and malformed command paralysis.
 * Classification is deterministic and context-aware with fallback logic.
 */

export enum IntentCategory {
  EXECUTION_REQUEST = "EXECUTION_REQUEST",
  STRATEGIC_DIRECTIVE = "STRATEGIC_DIRECTIVE",
  CLARIFICATION_REQUIRED = "CLARIFICATION_REQUIRED",
  MALFORMED_INPUT = "MALFORMED_INPUT",
  NO_ACTIONABLE_SIGNAL = "NO_ACTIONABLE_SIGNAL",
}

export interface IntentContext {
  tenantId: string;
  userId: string;
  monthCloseId?: string;
  previousIntent?: IntentCategory;
  sessionMetadata?: Record<string, any>;
}

export interface ClassificationResult {
  category: IntentCategory;
  confidence: number; // 0-100
  reasoning: string;
  suggestedAction?: string;
  contextUsed: boolean;
  timestamp: Date;
}

export interface IntentInput {
  text: string;
  metadata?: Record<string, any>;
}

/**
 * Intent Classifier - Deterministic classification engine
 */
export class IntentClassifier {
  private readonly executionKeywords = [
    'execute', 'run', 'process', 'match', 'reconcile', 'confirm',
    'upload', 'parse', 'export', 'approve', 'reject', 'resolve'
  ];

  private readonly strategicKeywords = [
    'plan', 'strategy', 'implement', 'design', 'architect', 'build',
    'configure', 'setup', 'initialize', 'optimize', 'improve'
  ];

  private readonly clarificationIndicators = [
    '?', 'what', 'which', 'how', 'why', 'when', 'where', 'unclear',
    'explain', 'clarify', 'help', 'more info', 'details'
  ];

  /**
   * Classify input intent using deterministic rules
   */
  classify(input: IntentInput, context: IntentContext): ClassificationResult {
    const normalizedText = input.text.toLowerCase().trim();
    const timestamp = new Date();

    // Rule 1: Empty or extremely short input
    if (normalizedText.length === 0) {
      return {
        category: IntentCategory.MALFORMED_INPUT,
        confidence: 100,
        reasoning: 'Empty input detected',
        contextUsed: false,
        timestamp,
      };
    }

    // Rule 2: Only special characters or gibberish
    if (this.isGibberish(normalizedText)) {
      return {
        category: IntentCategory.MALFORMED_INPUT,
        confidence: 95,
        reasoning: 'Input contains only special characters or non-meaningful text',
        contextUsed: false,
        timestamp,
      };
    }

    // Rule 3: Check for clarification indicators
    if (this.containsClarificationIndicators(normalizedText)) {
      return {
        category: IntentCategory.CLARIFICATION_REQUIRED,
        confidence: 85,
        reasoning: 'Input contains clarification indicators (questions or uncertainty)',
        suggestedAction: 'Request more specific details or switch to PLAN_MODE',
        contextUsed: false,
        timestamp,
      };
    }

    // Rule 4: Check for execution keywords
    const executionScore = this.calculateKeywordScore(normalizedText, this.executionKeywords);
    if (executionScore > 0) {
      return {
        category: IntentCategory.EXECUTION_REQUEST,
        confidence: Math.min(70 + executionScore * 30, 95),
        reasoning: `Execution keywords detected (score: ${executionScore})`,
        suggestedAction: 'Validate against current mode and envelope before execution',
        contextUsed: false,
        timestamp,
      };
    }

    // Rule 5: Check for strategic keywords
    const strategicScore = this.calculateKeywordScore(normalizedText, this.strategicKeywords);
    if (strategicScore > 0) {
      return {
        category: IntentCategory.STRATEGIC_DIRECTIVE,
        confidence: Math.min(70 + strategicScore * 30, 95),
        reasoning: `Strategic keywords detected (score: ${strategicScore})`,
        suggestedAction: 'Switch to PLAN_MODE for structured interpretation',
        contextUsed: false,
        timestamp,
      };
    }

    // Rule 6: Ambiguous but context exists - use fallback logic
    if (this.canInferFromContext(normalizedText, context)) {
      const inferredCategory = this.inferFromContext(normalizedText, context);
      return {
        category: inferredCategory,
        confidence: 60,
        reasoning: 'Intent inferred from contextual metadata',
        suggestedAction: 'Switch to PLAN_MODE for structured interpretation',
        contextUsed: true,
        timestamp,
      };
    }

    // Rule 7: Default to NO_ACTIONABLE_SIGNAL (not passive freeze)
    // Log anomaly and continue with non-destructive analysis
    return {
      category: IntentCategory.NO_ACTIONABLE_SIGNAL,
      confidence: 50,
      reasoning: 'No clear intent pattern detected, insufficient context',
      suggestedAction: 'Log anomaly and continue monitoring for additional context',
      contextUsed: true,
      timestamp,
    };
  }

  /**
   * Check if text is gibberish (only special chars, numbers, or very short)
   */
  private isGibberish(text: string): boolean {
    // Remove all whitespace and alphanumeric characters
    const stripped = text.replace(/[a-z0-9\s]/gi, '');
    
    // If >70% of characters are special chars, it's gibberish
    if (stripped.length / text.length > 0.7) {
      return true;
    }

    // Check if it's just numbers or underscores/dashes (like "why_" or "123")
    if (/^[_\-\d\s]+$/.test(text)) {
      return true;
    }

    // Check for very short ambiguous text with trailing special chars (like "why_")
    if (/^[a-z]{1,4}[_\-]+$/.test(text)) {
      return true;
    }

    return false;
  }

  /**
   * Check if text contains clarification indicators
   */
  private containsClarificationIndicators(text: string): boolean {
    return this.clarificationIndicators.some(indicator => 
      text.includes(indicator)
    );
  }

  /**
   * Calculate keyword match score (0-1)
   */
  private calculateKeywordScore(text: string, keywords: string[]): number {
    const matches = keywords.filter(keyword => text.includes(keyword));
    return matches.length / keywords.length;
  }

  /**
   * Check if we can infer intent from context
   */
  private canInferFromContext(text: string, context: IntentContext): boolean {
    // If we have previous intent and the text is somewhat related
    if (context.previousIntent && text.length >= 3) {
      return true;
    }

    // If we have active month close context
    if (context.monthCloseId) {
      return true;
    }

    // If we have session metadata
    if (context.sessionMetadata && Object.keys(context.sessionMetadata).length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Infer intent from context when input is ambiguous
   */
  private inferFromContext(text: string, context: IntentContext): IntentCategory {
    // If previous intent was execution and text is short, assume continuation
    if (context.previousIntent === IntentCategory.EXECUTION_REQUEST) {
      return IntentCategory.EXECUTION_REQUEST;
    }

    // If we're in an active month close, default to strategic
    if (context.monthCloseId) {
      return IntentCategory.STRATEGIC_DIRECTIVE;
    }

    // Default fallback
    return IntentCategory.CLARIFICATION_REQUIRED;
  }

  /**
   * Validate classification result
   */
  validate(result: ClassificationResult): boolean {
    return (
      result.confidence >= 0 &&
      result.confidence <= 100 &&
      Object.values(IntentCategory).includes(result.category) &&
      result.reasoning.length > 0
    );
  }
}

/**
 * Factory function for creating intent classifier
 */
export function createIntentClassifier(): IntentClassifier {
  return new IntentClassifier();
}
