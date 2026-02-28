export type ConvexHttpRoute = {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  handler: string;
};

export const convexHttpRoutes: ConvexHttpRoute[] = [];
