/**
 * Client Module - Main Entry Point
 *
 * Phase 3: UX-Driven Orchestration
 *
 * This module provides the client-side orchestration layer that:
 * - Maps user intents to server workflows
 * - Guards invalid operations before network calls
 * - Tracks workflow progress
 * - Provides structured error handling
 * - Exposes observable state
 */

// Orchestration
export * from "./orchestration";

// Events
export * from "./events";

// State
export * from "./state";

// Workflows
export * from "./workflows";

// UX Flows
export * from "./ui/flows";
