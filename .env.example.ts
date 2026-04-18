export const secrets = {
  // Optional: defaults to "sonnet" when omitted.
  model: "sonnet",

  // Fill this to enable the apiKey path.
  apiKey: "",

  // Fill these to enable the authToken + baseUrl path.
  authToken: "",
  baseUrl: "",
} as const;

export default secrets;
