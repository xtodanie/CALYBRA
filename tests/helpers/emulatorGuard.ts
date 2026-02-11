export function shouldRunFirestoreEmulatorTests(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}
