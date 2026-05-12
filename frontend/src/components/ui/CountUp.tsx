import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

interface Props {
  to: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString("pt-BR");

export default function CountUp({ to, format = defaultFormat, duration = 1.2, className }: Props) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));

  useEffect(() => {
    const controls = animate(mv, to, { duration, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [to, duration, mv]);

  return <motion.span className={className}>{text}</motion.span>;
}
