import Image from "next/image";

export default function SecondaryHero() {
  return (
    <section className="w-full relative overflow-hidden" style={{ height: "120vh" }}>
      <Image
        src="/images/hero/image.png"
        alt="Poshakh Showcase"
        fill
        className="object-cover object-center"
        sizes="100vw"
      />
    </section>
  );
}
