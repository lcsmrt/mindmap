type ErrorBannerProps = {
  message: string;
};

export const ErrorBanner = ({ message }: ErrorBannerProps) => (
  <div
    role="alert"
    className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
  >
    {message}
  </div>
);
