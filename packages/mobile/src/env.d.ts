declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL: string;
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
    EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
    [key: string]: string | undefined;
  };
};
