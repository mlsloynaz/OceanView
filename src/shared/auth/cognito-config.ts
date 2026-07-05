export type CognitoConfig = {
  userPoolId: string;
  clientId: string;
  region: string;
};

export function getCognitoConfig(): CognitoConfig | null {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim() ?? "";
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim() ?? "";
  const region = import.meta.env.VITE_AWS_REGION?.trim() ?? "us-east-1";
  if (!userPoolId || !clientId) {
    return null;
  }
  return { userPoolId, clientId, region };
}

export function isAuthConfigured(): boolean {
  return getCognitoConfig() !== null;
}

export function cognitoIdpEndpoint(region: string): string {
  return `https://cognito-idp.${region}.amazonaws.com/`;
}
