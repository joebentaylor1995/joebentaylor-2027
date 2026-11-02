// NOTE • Matches every other route so a client-side navigation away (Back to
// /projects, the header, a link) empties the slot — an unmatched slot would
// keep showing the last case study. Named [...missing] to share the not-found
// catch-all's pattern: two catch-alls with different names are ambiguous
const CatchAll = () => null;

// Exports
// ------------
export default CatchAll;
