import type { TeeDesign } from "@/lib/catalog";

const TEE_CLIP =
  "polygon(33% 3%, 41% 3%, 50% 11%, 59% 3%, 67% 3%, 86% 8%, 100% 26%, 84% 40%, 78% 33%, 78% 100%, 22% 100%, 22% 33%, 16% 40%, 0% 26%, 14% 8%)";

/** CSS-rendered tee with the front print — used until a real Printify mockup exists. */
export default function TeeMockup({
  design,
  size = "lg",
  className = "",
}: {
  design: TeeDesign;
  size?: "lg" | "sm";
  className?: string;
}) {
  const white = (design.shirtColor ?? "white") === "white";
  const baseText = white ? "text-blue" : "text-white";
  const lineSize =
    size === "lg"
      ? "text-xl sm:text-2xl md:text-[1.7rem]"
      : "text-[0.62rem] sm:text-[0.7rem]";

  return (
    <div className={`relative mx-auto aspect-[1/1.04] w-full ${className}`}>
      <div
        className="absolute inset-0"
        style={{
          background: white ? "#ffffff" : "var(--blue)",
          clipPath: TEE_CLIP,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.07)",
        }}
      />
      <div className="absolute inset-x-0 top-[36%] flex flex-col items-center px-[14%] text-center">
        {design.lines.map((line, i) => (
          <span
            key={i}
            className={`font-display uppercase leading-[0.94] tracking-tight ${
              i === design.accentLineIndex ? "text-orange" : baseText
            } ${lineSize}`}
          >
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}
