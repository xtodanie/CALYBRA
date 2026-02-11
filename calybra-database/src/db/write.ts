/**
 * @fileoverview Centralized and validated Firestore write wrappers.
 * All Cloud Functions MUST use these wrappers to write data to ensure
 * that all models conform to their schemas and system-managed fields
 * are set correctly.
 */

import { FieldValue, Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { SCHEMA_VERSION } from "../lib/types";
import { ValidationError, AuthorizationError } from "../errors";

// Helper to get the Firestore instance, allowing for dependency injection in tests.
const db = new Firestore();

interface WriteContext {
  tenantId: string;
  actorUid: string;
}

/**
 * Creates a new document in a collection with validated data.
 * - Enforces schema validation via Zod.
 * - Automatically adds server-managed fields (`tenantId`, `schemaVersion`, `createdAt`, `updatedAt`).
 *
 * @param collectionPath The path to the Firestore collection.
 * @param data The client-provided payload to validate.
 * @param schema The Zod schema for creation.
 * @param context An object containing the actor's UID and tenant ID.
 * @returns The ID of the newly created document.
 * @throws {ValidationError} if the data does not conform to the schema.
 */
export async function createDoc<T extends z.ZodType>(
  collectionPath: string,
  data: unknown,
  schema: T,
  context: WriteContext
): Promise<string> {
  const validationResult = schema.safeParse(data);
  if (!validationResult.success) {
    throw new ValidationError("Invalid data for document creation.", validationResult.error.issues);
  }

  const now = FieldValue.serverTimestamp();

  const docToWrite = {
    ...validationResult.data,
    tenantId: context.tenantId,
    schemaVersion: SCHEMA_VERSION,
    createdBy: context.actorUid,
    createdAt: now,
    updatedAt: now,
    updatedBy: context.actorUid,
  };

  const ref = await db.collection(collectionPath).add(docToWrite);
  return ref.id;
}

/**
 * Updates an existing document with validated data.
 * - Enforces schema validation for the update payload.
 * - Automatically updates the `updatedAt` and `updatedBy` fields.
 * - Prevents modification of immutable fields (`tenantId`, `createdAt`).
 *
 * @param docPath The full path to the Firestore document.
 * @param data The client-provided payload for the update.
 * @param schema The Zod schema for updates (should be partial).
 * @param context An object containing the actor's UID and tenant ID.
 * @throws {ValidationError} if the update data does not conform to the schema.
 * @throws {AuthorizationError} if the actor's tenantId does not match the document's tenantId.
 */
export async function updateDoc<T extends z.ZodType>(
  docPath: string,
  data: unknown,
  schema: T,
  context: WriteContext
): Promise<void> {
  const validationResult = schema.safeParse(data);
  if (!validationResult.success) {
    throw new ValidationError("Invalid data for document update.", validationResult.error.issues);
  }

  const payload = validationResult.data;
  if ("tenantId" in payload || "createdAt" in payload || "createdBy" in payload) {
    throw new ValidationError("Attempted to update immutable fields.", []);
  }

  const docRef = db.doc(docPath);

  // Authorization: Ensure the actor belongs to the same tenant as the document.
  const docSnap = await docRef.get();
  if (!docSnap.exists || docSnap.data()?.tenantId !== context.tenantId) {
    throw new AuthorizationError(`Forbidden: Actor in tenant '${context.tenantId}' cannot write to doc in tenant '${docSnap.data()?.tenantId}'.`);
  }

  const now = FieldValue.serverTimestamp();
  const docToWrite = {
    ...payload,
    updatedAt: now,
    updatedBy: context.actorUid,
  };

  await docRef.update(docToWrite);
}
