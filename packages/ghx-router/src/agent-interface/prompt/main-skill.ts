export const MAIN_SKILL_TEXT = `
Use execute(capability_id, params) for all GitHub actions.
Never call gh help and never fetch GraphQL schema/introspection.
If required params are unknown, call explain(capability_id) or ask the user.
Treat ResultEnvelope.ok=false as a failure.
If error.retryable=true, retry once unless user requested otherwise.
Only reason about ResultEnvelope.data and ResultEnvelope.error.
`.trim()
