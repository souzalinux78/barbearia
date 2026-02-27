type SkeletonProps = {
  className?: string;
};

export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={`animate-pulse rounded-xl bg-white/10 ${className ?? ""}`} />
);
