import Image from "next/image";

export function OrdinoraEmblem({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/ordinora-logo-white.png"
      alt=""
      aria-hidden="true"
      width={512}
      height={512}
      className={className}
    />
  );
}
