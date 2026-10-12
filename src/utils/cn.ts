/**
 * Joins class names, skipping falsy values — for combining module classes,
 * global utility classes (t-*) and an optional className prop.
 *
 * @example
 * <h2 className={cn(s.title, 't-headlineL', isActive && s.active, className)} />
 */
export const cn = (...classes: (string | false | null | undefined)[]): string => classes.filter(Boolean).join(' ');
