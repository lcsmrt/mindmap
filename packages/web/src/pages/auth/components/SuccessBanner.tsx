type SuccessBannerProps = {
  message: string;
};

export const SuccessBanner = ({ message }: SuccessBannerProps) => (
  <div
    role="status"
    className="rounded-md border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success"
  >
    {message}
  </div>
);
