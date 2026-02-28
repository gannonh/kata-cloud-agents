export const CONVEX_DEPLOYMENT_ENV = 'CONVEX_DEPLOYMENT';
export const CONVEX_URL_ENV = 'CONVEX_URL';

export type ConvexClientConfig = {
  deployment?: string;
  url?: string;
};

export function getConvexClientConfig(env: NodeJS.ProcessEnv = process.env): ConvexClientConfig {
  return {
    deployment: env[CONVEX_DEPLOYMENT_ENV],
    url: env[CONVEX_URL_ENV],
  };
}

export function hasConvexClientConfig(env: NodeJS.ProcessEnv = process.env): boolean {
  const config = getConvexClientConfig(env);
  return Boolean(config.deployment || config.url);
}
