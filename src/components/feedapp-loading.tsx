import Image from "next/image";

type FeedAppLoadingProps = {
  label?: string;
};

export function FeedAppLoading({ label = "Loading" }: FeedAppLoadingProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="flex flex-col items-center gap-3">
        <Image
          src="/feedapp-icon.png"
          alt="FeedApp"
          width={56}
          height={56}
          priority
          className="feedapp-breathe h-14 w-14"
        />
        <div className="text-sm font-medium text-muted">{label}</div>
      </div>
    </main>
  );
}
